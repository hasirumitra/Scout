import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT, 10) || 5432,
  username: process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'password',
  name: process.env.DATABASE_NAME || 'hasiru_mitra',
  
  // Connection Pool Configuration
  connectionPool: {
    max: parseInt(process.env.DB_POOL_MAX, 10) || 10,
    min: parseInt(process.env.DB_POOL_MIN, 10) || 1,
    idle: parseInt(process.env.DB_POOL_IDLE, 10) || 10000,
    acquire: parseInt(process.env.DB_POOL_ACQUIRE, 10) || 60000,
    evict: parseInt(process.env.DB_POOL_EVICT, 10) || 1000,
  },
  
  // Migration Configuration
  migrations: {
    tableName: 'migrations',
    directory: './src/database/migrations',
  },
  
  // Seed Configuration
  seeds: {
    directory: './src/database/seeds',
  },
  
  // Logging
  logging: process.env.DATABASE_LOGGING === 'true' || process.env.NODE_ENV === 'development',
  logger: 'advanced-console',
  
  // SSL Configuration (for production)
  ssl: process.env.NODE_ENV === 'production' && process.env.DATABASE_SSL !== 'false',
  
  // Additional Options
  extra: {
    // Connection timeout
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT, 10) || 2000,
    // Query timeout
    query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT, 10) || 20000,
    // Statement timeout
    statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT, 10) || 20000,
    // Idle timeout
    idle_in_transaction_session_timeout: parseInt(process.env.DB_IDLE_TIMEOUT, 10) || 10000,
  },
}));