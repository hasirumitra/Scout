import { ApiProperty } from '@nestjs/swagger';

export class UserInfo {
  @ApiProperty({ description: 'User ID' })
  id: string;

  @ApiProperty({ description: 'User phone number' })
  phone: string;

  @ApiProperty({ description: 'User email address' })
  email: string;

  @ApiProperty({ description: 'User full name' })
  fullName: string;

  @ApiProperty({ description: 'User role' })
  role: string;

  @ApiProperty({ description: 'Phone verification status' })
  isVerified: boolean;
}

export class AuthResponse {
  @ApiProperty({ type: UserInfo, description: 'User information' })
  user: UserInfo;

  @ApiProperty({ description: 'JWT access token' })
  accessToken: string;

  @ApiProperty({ description: 'JWT refresh token' })
  refreshToken: string;

  @ApiProperty({ description: 'Token expiration time' })
  expiresIn: string;
}