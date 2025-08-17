import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  // JWT Secrets
  accessTokenSecret: process.env.JWT_ACCESS_SECRET || 'hasiru-mitra-access-secret-key',
  refreshTokenSecret: process.env.JWT_REFRESH_SECRET || 'hasiru-mitra-refresh-secret-key',
  
  // Token Expiration
  accessTokenExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  refreshTokenExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  
  // JWT Options
  issuer: process.env.JWT_ISSUER || 'hasiru-mitra',
  audience: process.env.JWT_AUDIENCE || 'hasiru-mitra-users',
  
  // Algorithm
  algorithm: 'HS256',
  
  // Verification Options
  verifyOptions: {
    ignoreExpiration: false,
    ignoreNotBefore: false,
    clockTolerance: 5, // 5 seconds
  },
  
  // Refresh Token Configuration
  refreshToken: {
    length: parseInt(process.env.REFRESH_TOKEN_LENGTH, 10) || 32,
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
    revokeOnUse: process.env.REFRESH_TOKEN_REVOKE_ON_USE === 'true',
  },
  
  // OTP Configuration
  otp: {
    length: parseInt(process.env.OTP_LENGTH, 10) || 6,
    expiresIn: parseInt(process.env.OTP_EXPIRES_IN, 10) || 300, // 5 minutes in seconds
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS, 10) || 3,
    resendCooldown: parseInt(process.env.OTP_RESEND_COOLDOWN, 10) || 60, // 1 minute
  },
  
  // Password Reset Configuration
  passwordReset: {
    tokenLength: parseInt(process.env.RESET_TOKEN_LENGTH, 10) || 32,
    expiresIn: parseInt(process.env.RESET_TOKEN_EXPIRES_IN, 10) || 3600, // 1 hour
    maxAttempts: parseInt(process.env.RESET_MAX_ATTEMPTS, 10) || 3,
  },
}));