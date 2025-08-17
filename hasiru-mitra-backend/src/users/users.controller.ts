import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';

import { UsersService } from './users.service';
import { UserProfileService } from './services/user-profile.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from './enums/user-role.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly userProfileService: UserProfileService,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ 
    summary: 'Create a new user',
    description: 'Create a new user account (Admin only)'
  })
  @ApiResponse({
    status: 201,
    description: 'User created successfully.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required.',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - User with phone or email already exists.',
  })
  async create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FPO_ADMIN)
  @ApiOperation({ 
    summary: 'Get all users',
    description: 'Get paginated list of users with filtering options'
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'role', required: false, enum: UserRole })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'isVerified', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully.',
  })
  async findAll(
    @Query() queryDto: QueryUsersDto,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.usersService.findAll(queryDto, paginationDto);
  }

  @Get('profile')
  @ApiOperation({ 
    summary: 'Get current user profile',
    description: 'Get authenticated user profile information'
  })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully.',
  })
  async getProfile(@Request() req) {
    return this.usersService.findOne(req.user.id);
  }

  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ 
    summary: 'Get user statistics',
    description: 'Get comprehensive user statistics (Admin only)'
  })
  @ApiResponse({
    status: 200,
    description: 'User statistics retrieved successfully.',
  })
  async getUserStats() {
    return this.usersService.getUserStats();
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FPO_ADMIN)
  @ApiOperation({ 
    summary: 'Get user by ID',
    description: 'Get specific user information by ID'
  })
  @ApiResponse({
    status: 200,
    description: 'User retrieved successfully.',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found.',
  })
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch('profile')
  @ApiOperation({ 
    summary: 'Update current user profile',
    description: 'Update authenticated user profile information'
  })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully.',
  })
  async updateProfile(
    @Request() req,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(req.user.id, updateProfileDto);
  }

  @Patch('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Change password',
    description: 'Change current user password'
  })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Current password is incorrect.',
  })
  async changePassword(
    @Request() req,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(req.user.id, changePasswordDto);
  }

  @Post('profile/image')
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ 
    summary: 'Upload profile image',
    description: 'Upload and update user profile image'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Profile image uploaded successfully.',
  })
  async uploadProfileImage(
    @Request() req,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|gif)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    const imageUrl = await this.userProfileService.uploadProfileImage(
      req.user.id,
      file,
    );
    
    return this.usersService.updateProfileImage(req.user.id, imageUrl);
  }

  @Patch('notification-preferences')
  @ApiOperation({ 
    summary: 'Update notification preferences',
    description: 'Update user notification preferences'
  })
  @ApiResponse({
    status: 200,
    description: 'Notification preferences updated successfully.',
  })
  async updateNotificationPreferences(
    @Request() req,
    @Body() updateNotificationPreferencesDto: UpdateNotificationPreferencesDto,
  ) {
    return this.usersService.updateNotificationPreferences(
      req.user.id,
      updateNotificationPreferencesDto,
    );
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ 
    summary: 'Update user',
    description: 'Update user information (Admin only)'
  })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required.',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found.',
  })
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Patch(':id/deactivate')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ 
    summary: 'Deactivate user',
    description: 'Deactivate user account (Admin only)'
  })
  @ApiResponse({
    status: 200,
    description: 'User deactivated successfully.',
  })
  async deactivate(@Param('id') id: string) {
    return this.usersService.deactivate(id);
  }

  @Patch(':id/activate')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ 
    summary: 'Activate user',
    description: 'Activate user account (Admin only)'
  })
  @ApiResponse({
    status: 200,
    description: 'User activated successfully.',
  })
  async activate(@Param('id') id: string) {
    return this.usersService.activate(id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ 
    summary: 'Delete user',
    description: 'Permanently delete user account (Super Admin only)'
  })
  @ApiResponse({
    status: 200,
    description: 'User deleted successfully.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Super Admin access required.',
  })
  async remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}