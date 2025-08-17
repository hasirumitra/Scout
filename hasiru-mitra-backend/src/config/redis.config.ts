import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  database: parseInt(process.env.REDIS_DATABASE, 10) || 0,
  
  // Connection Configuration
  connection: {
    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT, 10) || 10000,
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    maxLoadingTimeout: 1000,
  },
  
  // Cluster Configuration (if using Redis Cluster)
  cluster: {
    enabled: process.env.REDIS_CLUSTER_ENABLED === 'true',
    nodes: process.env.REDIS_CLUSTER_NODES?.split(',') || [],
    options: {
      enableOfflineQueue: false,
      redisOptions: {
        password: process.env.REDIS_PASSWORD,
      },
    },
  },
  
  // Cache Configuration
  cache: {
    ttl: parseInt(process.env.REDIS_CACHE_TTL, 10) || 300, // 5 minutes default
    max: parseInt(process.env.REDIS_CACHE_MAX, 10) || 100, // Maximum items
  },
  
  // Session Configuration
  session: {
    prefix: 'hasiru:session:',
    ttl: parseInt(process.env.REDIS_SESSION_TTL, 10) || 86400, // 24 hours
  },
  
  // Queue Configuration
  queue: {
    prefix: 'hasiru:queue:',
    defaultJobOptions: {
      removeOnComplete: parseInt(process.env.QUEUE_REMOVE_ON_COMPLETE, 10) || 50,
      removeOnFail: parseInt(process.env.QUEUE_REMOVE_ON_FAIL, 10) || 100,
      attempts: parseInt(process.env.QUEUE_ATTEMPTS, 10) || 3,
      backoff: {
        type: 'exponential',
        delay: parseInt(process.env.QUEUE_BACKOFF_DELAY, 10) || 2000,
      },
    },
  },
  
  // Pub/Sub Configuration
  pubsub: {
    publisher: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT, 10) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
    },
    subscriber: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT, 10) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
    },
  },
}));