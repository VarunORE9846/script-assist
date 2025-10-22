import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto, LogoutDto } from './dto/refresh-token.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RedisRateLimit, RateLimitPresets } from '../../common/decorators/rate-limit-redis.decorator';
import { RedisRateLimitGuard } from '../../common/guards/redis-rate-limit.guard';
import { Request } from 'express';

/**
 * Authentication Controller
 * 
 * Handles user authentication and token management:
 * - Login with email/password
 * - Register new users
 * - Refresh access tokens
 * - Logout and token revocation
 * 
 * Security features:
 * - Rate limiting on all endpoints (especially strict on login)
 * - IP and user agent tracking
 * - Secure token rotation
 */
@ApiTags('auth')
@Controller('auth')
@UseGuards(RedisRateLimitGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Login endpoint
   * 
   * Strict rate limiting to prevent brute force attacks
   * Returns access token (15min) and refresh token (7 days)
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @RedisRateLimit(RateLimitPresets.AUTH) // 5 requests per 5 minutes
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async login(
    @Body() loginDto: LoginDto,
    @Req() request: Request,
  ): Promise<AuthResponseDto> {
    const ipAddress = this.getIpAddress(request);
    const userAgent = request.headers['user-agent'];

    return this.authService.login(loginDto, ipAddress, userAgent);
  }

  /**
   * Register endpoint
   * 
   * Creates new user account
   * Moderate rate limiting to prevent spam
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @RedisRateLimit(RateLimitPresets.MODERATE) // 100 requests per minute
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiResponse({
    status: 201,
    description: 'Registration successful',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Email already registered' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async register(
    @Body() registerDto: RegisterDto,
    @Req() request: Request,
  ): Promise<AuthResponseDto> {
    const ipAddress = this.getIpAddress(request);
    const userAgent = request.headers['user-agent'];

    return this.authService.register(registerDto, ipAddress, userAgent);
  }

  /**
   * Refresh token endpoint
   * 
   * Exchange refresh token for new access token
   * Implements token rotation for security
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @RedisRateLimit(RateLimitPresets.MODERATE)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async refresh(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Req() request: Request,
  ): Promise<AuthResponseDto> {
    const ipAddress = this.getIpAddress(request);
    const userAgent = request.headers['user-agent'];

    return this.authService.refreshTokens(refreshTokenDto, ipAddress, userAgent);
  }

  /**
   * Logout endpoint
   * 
   * Revokes refresh token to prevent further use
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @RedisRateLimit(RateLimitPresets.MODERATE)
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async logout(@Body() logoutDto: LogoutDto): Promise<{ message: string }> {
    await this.authService.logout(logoutDto.refreshToken);
    return { message: 'Logged out successfully' };
  }

  /**
   * Extract IP address from request
   * Handles proxy headers (X-Forwarded-For, X-Real-IP)
   * 
   * @param request - Express request
   * @returns IP address
   */
  private getIpAddress(request: Request): string {
    return (
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (request.headers['x-real-ip'] as string) ||
      request.ip ||
      request.socket?.remoteAddress ||
      'unknown'
    );
  }
} 