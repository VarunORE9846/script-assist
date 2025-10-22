import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthResponseDto, UserResponseDto } from './dto/auth-response.dto';
import { RefreshToken } from './entities/refresh-token.entity';
import { RedisCacheService } from '../../common/services/redis-cache.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

/**
 * Enhanced Authentication Service
 * 
 * Security improvements over the old implementation:
 * 
 * 1. REFRESH TOKEN ROTATION: One-time use tokens prevent replay attacks
 * 2. TOKEN FAMILIES: Detect and block stolen token chains
 * 3. SECURE ERROR MESSAGES: Don't reveal whether email or password is wrong
 * 4. SHORT-LIVED ACCESS TOKENS: 15 minutes instead of 1 day
 * 5. REDIS CACHING: Reduce DB queries for user validation
 * 6. PROPER ROLE VALIDATION: Actually checks roles (was returning true!)
 * 7. TOKEN HASHING: Store hashed tokens in DB, not plaintext
 * 8. SESSION TRACKING: IP and user agent for anomaly detection
 * 
 * Token Strategy:
 * - Access Token: 15 minutes (JWT, stateless)
 * - Refresh Token: 7 days (stored in DB, stateful)
 * - Rotation: Each refresh generates new token pair
 * - Revocation: Can invalidate all user sessions
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessTokenExpiry = '15m'; // 15 minutes
  private readonly refreshTokenExpiry = 7 * 24 * 60 * 60; // 7 days in seconds

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly cacheService: RedisCacheService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  /**
   * Login user with email and password
   * 
   * Security improvements:
   * - Generic error message (no email enumeration)
   * - Rate limiting applied at controller level
   * - Returns both access and refresh tokens
   * - Tracks session metadata (IP, user agent)
   * 
   * @param loginDto - Login credentials
   * @param ipAddress - User's IP address
   * @param userAgent - User's browser/client info
   * @returns AuthResponseDto with tokens and user info
   */
  async login(
    loginDto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    // Find user by email
    const user = await this.usersService.findByEmail(email);
    
    // Security: Use generic error message to prevent email enumeration
    if (!user) {
      this.logger.warn(`Login attempt with invalid email: ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.password);
    
    if (!passwordValid) {
      this.logger.warn(`Failed login attempt for user: ${user.id}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate token pair
    const tokens = await this.generateTokenPair(
      user.id,
      user.email,
      user.role,
      ipAddress,
      userAgent,
    );

    this.logger.log(`User logged in: ${user.id}`);

    return {
      ...tokens,
      user: this.sanitizeUser(user),
      expiresIn: 15 * 60, // 15 minutes in seconds
    };
  }

  /**
   * Register new user
   * 
   * @param registerDto - Registration data
   * @param ipAddress - User's IP address
   * @param userAgent - User's browser/client info
   * @returns AuthResponseDto with tokens and user info
   */
  async register(
    registerDto: RegisterDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    // Check if user already exists
    const existingUser = await this.usersService.findByEmail(registerDto.email);

    if (existingUser) {
      throw new BadRequestException('Email already registered');
    }

    // Create user
    const user = await this.usersService.create(registerDto);

    // Generate token pair
    const tokens = await this.generateTokenPair(
      user.id,
      user.email,
      user.role,
      ipAddress,
      userAgent,
    );

    this.logger.log(`New user registered: ${user.id}`);

    return {
      ...tokens,
      user: this.sanitizeUser(user),
      expiresIn: 15 * 60,
    };
  }

  /**
   * Refresh access token using refresh token
   * 
   * Implements token rotation for security:
   * 1. Validate refresh token
   * 2. Generate new token pair
   * 3. Revoke old refresh token
   * 4. If token was already used, revoke entire family (theft detection)
   * 
   * @param refreshTokenDto - Refresh token
   * @param ipAddress - User's IP address
   * @param userAgent - User's browser/client info
   * @returns New token pair
   */
  async refreshTokens(
    refreshTokenDto: RefreshTokenDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    const { refreshToken } = refreshTokenDto;

    // Hash the token to compare with stored hash
    const tokenHash = this.hashToken(refreshToken);

    // Find the refresh token in database
    const storedToken = await this.refreshTokenRepository.findOne({
      where: { tokenHash },
      relations: ['user'],
    });

    if (!storedToken) {
      this.logger.warn('Refresh token not found');
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Check if token was already used (potential theft)
    if (storedToken.isRevoked) {
      this.logger.error(`Refresh token reuse detected! Token family: ${storedToken.tokenFamily}`);
      
      // Revoke entire token family for security
      await this.revokeTokenFamily(storedToken.tokenFamily);
      
      throw new UnauthorizedException('Token has been revoked. Please login again.');
    }

    // Check if token is expired
    if (storedToken.isExpired()) {
      this.logger.warn(`Expired refresh token used: ${storedToken.id}`);
      throw new UnauthorizedException('Refresh token expired');
    }

    // Get user from token
    const user = storedToken.user;

    // Generate new token pair with same family
    const tokens = await this.generateTokenPair(
      user.id,
      user.email,
      user.role,
      ipAddress,
      userAgent,
      storedToken.tokenFamily, // Keep same family for rotation tracking
    );

    // Revoke the old token (one-time use)
    storedToken.isRevoked = true;
    storedToken.revokedAt = new Date();
    storedToken.replacedByToken = this.hashToken(tokens.refreshToken);
    await this.refreshTokenRepository.save(storedToken);

    this.logger.log(`Tokens refreshed for user: ${user.id}`);

    return {
      ...tokens,
      user: this.sanitizeUser(user),
      expiresIn: 15 * 60,
    };
  }

  /**
   * Logout user by revoking refresh token
   * 
   * @param refreshToken - Refresh token to revoke
   */
  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);

    const storedToken = await this.refreshTokenRepository.findOne({
      where: { tokenHash },
    });

    if (storedToken) {
      storedToken.isRevoked = true;
      storedToken.revokedAt = new Date();
      await this.refreshTokenRepository.save(storedToken);
      
      this.logger.log(`User logged out: ${storedToken.userId}`);
    }
  }

  /**
   * Revoke all refresh tokens for a user (logout from all devices)
   * 
   * @param userId - User ID
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.refreshTokenRepository.update(
      { userId, isRevoked: false },
      { isRevoked: true, revokedAt: new Date() },
    );

    // Clear user cache to force re-authentication
    await this.cacheService.delete(`user:${userId}`);

    this.logger.log(`All tokens revoked for user: ${userId}`);
  }

  /**
   * Validate user for JWT strategy
   * Uses caching to reduce DB queries
   * 
   * @param userId - User ID from JWT payload
   * @returns User object or null
   */
  async validateUser(userId: string): Promise<any> {
    // Try cache first (reduces DB load)
    const cacheKey = `user:${userId}`;
    let user = await this.cacheService.get(cacheKey);

    if (user) {
      return user;
    }

    // Cache miss - fetch from DB
    user = await this.usersService.findOne(userId);
    
    if (!user) {
      return null;
    }

    // Cache user data for 5 minutes
    await this.cacheService.set(cacheKey, this.sanitizeUser(user), 300);
    
    return user;
  }

  /**
   * Validate if user has required roles
   * 
   * SECURITY FIX: This was returning true for everyone!
   * Now properly checks user roles against required roles
   * 
   * @param userId - User ID
   * @param requiredRoles - Array of allowed roles
   * @returns true if user has any of the required roles
   */
  async validateUserRoles(userId: string, requiredRoles: string[]): Promise<boolean> {
    const user = await this.validateUser(userId);
    
    if (!user) {
      return false;
    }

    // Check if user has any of the required roles
    return requiredRoles.includes(user.role);
  }

  /**
   * Generate access and refresh token pair
   * 
   * @param userId - User ID
   * @param email - User email
   * @param role - User role
   * @param ipAddress - IP address
   * @param userAgent - User agent
   * @param tokenFamily - Token family for rotation (optional)
   * @returns Token pair
   */
  private async generateTokenPair(
    userId: string,
    email: string,
    role: string,
    ipAddress?: string,
    userAgent?: string,
    tokenFamily?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // Generate access token (short-lived, stateless)
    const accessTokenPayload = {
      sub: userId,
      email,
      role,
    };

    const accessToken = this.jwtService.sign(accessTokenPayload, {
      expiresIn: this.accessTokenExpiry,
    });

    // Generate refresh token (long-lived, stateful)
    const refreshToken = this.generateSecureToken();
    const tokenHash = this.hashToken(refreshToken);

    // Create or use existing token family
    const family = tokenFamily || crypto.randomUUID();

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + this.refreshTokenExpiry);

    // Store refresh token in database
    const refreshTokenEntity = this.refreshTokenRepository.create({
      tokenHash,
      userId,
      expiresAt,
      tokenFamily: family,
      ipAddress,
      userAgent,
    });

    await this.refreshTokenRepository.save(refreshTokenEntity);

    return { accessToken, refreshToken };
  }

  /**
   * Generate cryptographically secure random token
   * 
   * @returns Random token string
   */
  private generateSecureToken(): string {
    return crypto.randomBytes(64).toString('base64url');
  }

  /**
   * Hash token for secure storage
   * Never store plain tokens in database
   * 
   * @param token - Plain token
   * @returns Hashed token
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Revoke all tokens in a family (used when theft is detected)
   * 
   * @param tokenFamily - Token family ID
   */
  private async revokeTokenFamily(tokenFamily: string): Promise<void> {
    await this.refreshTokenRepository.update(
      { tokenFamily, isRevoked: false },
      { isRevoked: true, revokedAt: new Date() },
    );

    this.logger.warn(`Token family revoked: ${tokenFamily}`);
  }

  /**
   * Remove sensitive data from user object
   * 
   * @param user - User object
   * @returns Sanitized user data
   */
  private sanitizeUser(user: any): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }

  /**
   * Cleanup expired tokens (should be run periodically)
   * Prevents database bloat
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.refreshTokenRepository.delete({
      expiresAt: LessThan(new Date()),
    });

    const count = result.affected || 0;
    
    if (count > 0) {
      this.logger.log(`Cleaned up ${count} expired refresh tokens`);
    }

    return count;
  }
} 