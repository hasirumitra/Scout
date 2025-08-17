import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

import { User } from '../users/entities/user.entity';
import { OtpService } from './services/otp.service';
import { SmsService } from './services/sms.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { AuthResponse } from './interfaces/auth-response.interface';
import { UserRole } from '../users/enums/user-role.enum';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly otpService: OtpService,
    private readonly smsService: SmsService,
    @InjectQueue('notifications')
    private readonly notificationQueue: Queue,
  ) {}

  async register(registerDto: RegisterDto): Promise<{ message: string; userId: string }> {
    const { phone, email, password, fullName, role, language } = registerDto;

    const existingUser = await this.userRepository.findOne({
      where: [{ phone }, { email }],
    });

    if (existingUser) {
      throw new ConflictException('User with this phone or email already exists');
    }

    const saltRounds = this.configService.get<number>('auth.saltRounds', 12);
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const user = this.userRepository.create({
      phone,
      email,
      password: hashedPassword,
      fullName,
      role: role || UserRole.FARMER,
      preferredLanguage: language || 'hi',
      isVerified: false,
      isActive: true,
    });

    const savedUser = await this.userRepository.save(user);

    const otp = await this.otpService.generateOtp(savedUser.id, 'phone_verification');
    
    await this.smsService.sendOtp(phone, otp, language || 'hi');

    await this.notificationQueue.add('send_welcome_notification', {
      userId: savedUser.id,
      phone,
      email,
      language: language || 'hi',
    });

    this.logger.log(`User registered successfully: ${savedUser.id}`);

    return {
      message: 'Registration successful. Please verify your phone number with the OTP sent.',
      userId: savedUser.id,
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { identifier, password } = loginDto;

    const user = await this.userRepository.findOne({
      where: [
        { phone: identifier },
        { email: identifier },
      ],
      select: ['id', 'phone', 'email', 'password', 'fullName', 'role', 'isVerified', 'isActive'],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isVerified) {
      const otp = await this.otpService.generateOtp(user.id, 'phone_verification');
      await this.smsService.sendOtp(user.phone, otp, 'hi');
      
      throw new UnauthorizedException(
        'Phone number not verified. OTP has been sent to your phone.',
      );
    }

    const tokens = await this.generateTokens(user);

    await this.updateLastLoginAt(user.id);

    this.logger.log(`User logged in successfully: ${user.id}`);

    return {
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isVerified: user.isVerified,
      },
      ...tokens,
    };
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto): Promise<AuthResponse> {
    const { userId, otp, type } = verifyOtpDto;

    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const isOtpValid = await this.otpService.verifyOtp(userId, otp, type);
    if (!isOtpValid) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    if (type === 'phone_verification') {
      user.isVerified = true;
      await this.userRepository.save(user);
    }

    const tokens = await this.generateTokens(user);

    this.logger.log(`OTP verified successfully for user: ${userId}`);

    return {
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isVerified: user.isVerified,
      },
      ...tokens,
    };
  }

  async refreshTokens(refreshTokenDto: RefreshTokenDto): Promise<AuthResponse> {
    const { refreshToken } = refreshTokenDto;

    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });

      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const tokens = await this.generateTokens(user);

      return {
        user: {
          id: user.id,
          phone: user.phone,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          isVerified: user.isVerified,
        },
        ...tokens,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async resendOtp(userId: string, type: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const otp = await this.otpService.generateOtp(userId, type);
    await this.smsService.sendOtp(user.phone, otp, user.preferredLanguage || 'hi');

    return {
      message: 'OTP sent successfully',
    };
  }

  async requestPasswordReset(phone: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { phone },
    });

    if (!user) {
      return { message: 'If the phone number exists, a reset OTP has been sent.' };
    }

    const otp = await this.otpService.generateOtp(user.id, 'password_reset');
    await this.smsService.sendOtp(phone, otp, user.preferredLanguage || 'hi');

    return {
      message: 'If the phone number exists, a reset OTP has been sent.',
    };
  }

  async resetPassword(
    phone: string,
    otp: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { phone },
    });

    if (!user) {
      throw new BadRequestException('Invalid phone number');
    }

    const isOtpValid = await this.otpService.verifyOtp(user.id, otp, 'password_reset');
    if (!isOtpValid) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    const saltRounds = this.configService.get<number>('auth.saltRounds', 12);
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    user.password = hashedPassword;
    await this.userRepository.save(user);

    this.logger.log(`Password reset successfully for user: ${user.id}`);

    return {
      message: 'Password reset successfully',
    };
  }

  async validateUser(payload: JwtPayload): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return user;
  }

  private async generateTokens(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      phone: user.phone,
      email: user.email,
      role: user.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.secret'),
        expiresIn: this.configService.get<string>('jwt.accessTokenExpiresIn'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: this.configService.get<string>('jwt.refreshTokenExpiresIn'),
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.configService.get<string>('jwt.accessTokenExpiresIn'),
    };
  }

  private async updateLastLoginAt(userId: string): Promise<void> {
    await this.userRepository.update(userId, {
      lastLoginAt: new Date(),
    });
  }
}