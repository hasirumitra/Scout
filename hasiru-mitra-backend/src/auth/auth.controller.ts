import {
  Controller,
  Post,
  Body,
  HttpStatus,
  HttpCode,
  UseGuards,
  Get,
  Request,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthResponse } from './interfaces/auth-response.interface';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle(5, 300)
  @ApiOperation({ 
    summary: 'Register a new user',
    description: 'Register a new user account. OTP will be sent for phone verification.'
  })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully. OTP sent for phone verification.',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid input data.',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - User with phone or email already exists.',
  })
  @ApiBody({ type: RegisterDto })
  async register(@Body() registerDto: RegisterDto) {
    this.logger.log(`Registration attempt for phone: ${registerDto.phone}`);
    return await this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle(10, 300)
  @ApiOperation({ 
    summary: 'User login',
    description: 'Authenticate user with phone/email and password.'
  })
  @ApiResponse({
    status: 200,
    description: 'User logged in successfully.',
    type: AuthResponse,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid credentials or unverified account.',
  })
  @ApiBody({ type: LoginDto })
  async login(@Body() loginDto: LoginDto): Promise<AuthResponse> {
    this.logger.log(`Login attempt for identifier: ${loginDto.identifier}`);
    return await this.authService.login(loginDto);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle(10, 300)
  @ApiOperation({ 
    summary: 'Verify OTP',
    description: 'Verify OTP for phone verification, password reset, etc.'
  })
  @ApiResponse({
    status: 200,
    description: 'OTP verified successfully.',
    type: AuthResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid or expired OTP.',
  })
  @ApiBody({ type: VerifyOtpDto })
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto): Promise<AuthResponse> {
    this.logger.log(`OTP verification attempt for user: ${verifyOtpDto.userId}`);
    return await this.authService.verifyOtp(verifyOtpDto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle(20, 300)
  @ApiOperation({ 
    summary: 'Refresh access token',
    description: 'Generate new access token using refresh token.'
  })
  @ApiResponse({
    status: 200,
    description: 'Tokens refreshed successfully.',
    type: AuthResponse,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid refresh token.',
  })
  @ApiBody({ type: RefreshTokenDto })
  async refreshTokens(@Body() refreshTokenDto: RefreshTokenDto): Promise<AuthResponse> {
    return await this.authService.refreshTokens(refreshTokenDto);
  }

  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle(3, 300)
  @ApiOperation({ 
    summary: 'Resend OTP',
    description: 'Resend OTP for verification purposes.'
  })
  @ApiResponse({
    status: 200,
    description: 'OTP sent successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - User not found.',
  })
  @ApiBody({ type: ResendOtpDto })
  async resendOtp(@Body() resendOtpDto: ResendOtpDto) {
    this.logger.log(`OTP resend request for user: ${resendOtpDto.userId}`);
    return await this.authService.resendOtp(resendOtpDto.userId, resendOtpDto.type);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle(3, 300)
  @ApiOperation({ 
    summary: 'Request password reset',
    description: 'Request password reset OTP for the given phone number.'
  })
  @ApiResponse({
    status: 200,
    description: 'Password reset OTP sent if phone number exists.',
  })
  @ApiBody({ type: RequestPasswordResetDto })
  async requestPasswordReset(@Body() requestPasswordResetDto: RequestPasswordResetDto) {
    this.logger.log(`Password reset request for phone: ${requestPasswordResetDto.phone}`);
    return await this.authService.requestPasswordReset(requestPasswordResetDto.phone);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle(5, 300)
  @ApiOperation({ 
    summary: 'Reset password',
    description: 'Reset password using OTP verification.'
  })
  @ApiResponse({
    status: 200,
    description: 'Password reset successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid OTP or phone number.',
  })
  @ApiBody({ type: ResetPasswordDto })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    const { phone, otp, newPassword } = resetPasswordDto;
    this.logger.log(`Password reset attempt for phone: ${phone}`);
    return await this.authService.resetPassword(phone, otp, newPassword);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Get user profile',
    description: 'Get authenticated user profile information.'
  })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token.',
  })
  async getProfile(@Request() req) {
    return {
      user: {
        id: req.user.id,
        phone: req.user.phone,
        email: req.user.email,
        fullName: req.user.fullName,
        role: req.user.role,
        isVerified: req.user.isVerified,
        createdAt: req.user.createdAt,
        lastLoginAt: req.user.lastLoginAt,
      },
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Logout user',
    description: 'Logout the authenticated user.'
  })
  @ApiResponse({
    status: 200,
    description: 'User logged out successfully.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token.',
  })
  async logout(@Request() req) {
    this.logger.log(`User logged out: ${req.user.id}`);
    return {
      message: 'Logged out successfully',
    };
  }
}