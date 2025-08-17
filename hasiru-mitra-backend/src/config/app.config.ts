import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  name: 'Hasiru Mitra API',
  version: '1.0.0',
  description: 'AI-powered organic farming platform',
  port: parseInt(process.env.PORT, 10) || 3000,
  environment: process.env.NODE_ENV || 'development',
  
  // API Configuration
  globalPrefix: 'api/v1',
  corsOrigins: process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3001',
  
  // File Upload Configuration
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 10 * 1024 * 1024, // 10MB
  allowedImageTypes: ['jpeg', 'jpg', 'png', 'webp'],
  allowedDocumentTypes: ['pdf', 'doc', 'docx'],
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  
  // External Service URLs
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8000',
  voiceServiceUrl: process.env.VOICE_SERVICE_URL || 'http://localhost:8001',
  
  // Feature Flags
  features: {
    voiceEnabled: process.env.VOICE_ENABLED === 'true' || true,
    marketplaceEnabled: process.env.MARKETPLACE_ENABLED === 'true' || true,
    certificationEnabled: process.env.CERTIFICATION_ENABLED === 'true' || true,
    analyticsEnabled: process.env.ANALYTICS_ENABLED === 'true' || true,
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    enableConsole: process.env.ENABLE_CONSOLE_LOGS !== 'false',
    enableFile: process.env.ENABLE_FILE_LOGS === 'true',
    logDir: process.env.LOG_DIR || './logs',
  },
  
  // Security
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT, 10) || 24 * 60 * 60 * 1000, // 24 hours
  },
  
  // Pagination
  pagination: {
    defaultLimit: parseInt(process.env.DEFAULT_PAGE_SIZE, 10) || 20,
    maxLimit: parseInt(process.env.MAX_PAGE_SIZE, 10) || 100,
  },
  
  // Cache TTL values (in seconds)
  cache: {
    userProfile: parseInt(process.env.CACHE_USER_PROFILE_TTL, 10) || 300, // 5 minutes
    cropData: parseInt(process.env.CACHE_CROP_DATA_TTL, 10) || 3600, // 1 hour
    marketPrices: parseInt(process.env.CACHE_MARKET_PRICES_TTL, 10) || 600, // 10 minutes
    weatherData: parseInt(process.env.CACHE_WEATHER_DATA_TTL, 10) || 1800, // 30 minutes
  },
}));