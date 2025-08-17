import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import * as crypto from 'crypto';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly otpLength: number;
  private readonly otpExpiryMinutes: number;

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {
    this.otpLength = this.configService.get<number>('otp.length', 6);
    this.otpExpiryMinutes = this.configService.get<number>('otp.expiryMinutes', 10);
  }

  async generateOtp(userId: string, type: string): Promise<string> {
    const otp = this.generateRandomOtp();
    const key = this.getRedisKey(userId, type);
    const expirySeconds = this.otpExpiryMinutes * 60;

    await this.redis.setex(key, expirySeconds, otp);

    this.logger.log(`OTP generated for user ${userId}, type: ${type}`);
    
    return otp;
  }

  async verifyOtp(userId: string, otp: string, type: string): Promise<boolean> {
    const key = this.getRedisKey(userId, type);
    const storedOtp = await this.redis.get(key);

    if (!storedOtp || storedOtp !== otp) {
      this.logger.warn(`Invalid OTP attempt for user ${userId}, type: ${type}`);
      return false;
    }

    await this.redis.del(key);

    this.logger.log(`OTP verified successfully for user ${userId}, type: ${type}`);
    
    return true;
  }

  async checkOtpAttempts(userId: string, type: string): Promise<boolean> {
    const attemptsKey = this.getAttemptsKey(userId, type);
    const attempts = await this.redis.get(attemptsKey);
    const maxAttempts = this.configService.get<number>('otp.maxAttempts', 5);

    if (attempts && parseInt(attempts) >= maxAttempts) {
      return false;
    }

    return true;
  }

  async incrementOtpAttempts(userId: string, type: string): Promise<void> {
    const attemptsKey = this.getAttemptsKey(userId, type);
    const lockoutMinutes = this.configService.get<number>('otp.lockoutMinutes', 30);
    
    await this.redis.incr(attemptsKey);
    await this.redis.expire(attemptsKey, lockoutMinutes * 60);
  }

  async getRemainingAttempts(userId: string, type: string): Promise<number> {
    const attemptsKey = this.getAttemptsKey(userId, type);
    const attempts = await this.redis.get(attemptsKey);
    const maxAttempts = this.configService.get<number>('otp.maxAttempts', 5);

    return maxAttempts - (attempts ? parseInt(attempts) : 0);
  }

  async getOtpExpiry(userId: string, type: string): Promise<number> {
    const key = this.getRedisKey(userId, type);
    const ttl = await this.redis.ttl(key);
    
    return ttl > 0 ? ttl : 0;
  }

  private generateRandomOtp(): string {
    const digits = '0123456789';
    let otp = '';
    
    for (let i = 0; i < this.otpLength; i++) {
      const randomByte = crypto.randomBytes(1)[0];
      otp += digits[randomByte % digits.length];
    }
    
    return otp;
  }

  private getRedisKey(userId: string, type: string): string {
    return `otp:${userId}:${type}`;
  }

  private getAttemptsKey(userId: string, type: string): string {
    return `otp_attempts:${userId}:${type}`;
  }
}