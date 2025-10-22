import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * Refresh Token Entity
 * 
 * Stores refresh tokens for secure token rotation strategy:
 * - Allows users to stay logged in without frequent re-authentication
 * - Implements token rotation (one-time use) for security
 * - Tracks token families to detect token theft/replay attacks
 * - Supports token revocation and session management
 * 
 * Security features:
 * - Hashed token storage (never store plain tokens)
 * - Expiration tracking
 * - Device/IP tracking for anomaly detection
 * - Token family for rotation tracking
 */
@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'token_hash', unique: true })
  tokenHash: string; // Hashed version of the token for security

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'expires_at' })
  expiresAt: Date;

  @Column({ name: 'is_revoked', default: false })
  isRevoked: boolean;

  @Column({ name: 'token_family', nullable: true })
  tokenFamily: string; // Links rotated tokens together to detect theft

  @Column({ name: 'replaced_by_token', nullable: true })
  replacedByToken: string; // Points to the new token after rotation

  @Column({ name: 'user_agent', nullable: true, length: 500 })
  userAgent: string; // Browser/client information

  @Column({ name: 'ip_address', nullable: true })
  ipAddress: string; // IP address for security tracking

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'revoked_at', nullable: true })
  revokedAt: Date;

  /**
   * Check if the token is valid (not expired and not revoked)
   */
  isValid(): boolean {
    return (
      !this.isRevoked &&
      this.expiresAt > new Date()
    );
  }

  /**
   * Check if the token is expired
   */
  isExpired(): boolean {
    return this.expiresAt <= new Date();
  }
}

