import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for refresh token requests
 */
export class RefreshTokenDto {
  @ApiProperty({ 
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'The refresh token to exchange for a new access token'
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

/**
 * DTO for logout requests
 */
export class LogoutDto {
  @ApiProperty({ 
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'The refresh token to revoke'
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

