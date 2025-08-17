import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Like, In } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import * as bcrypt from 'bcrypt';

import { User } from './entities/user.entity';
import { UserRole } from './enums/user-role.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectQueue('notifications')
    private readonly notificationQueue: Queue,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const { phone, email, password, ...userData } = createUserDto;

    const existingUser = await this.userRepository.findOne({
      where: [{ phone }, { email }],
    });

    if (existingUser) {
      throw new ConflictException('User with this phone or email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = this.userRepository.create({
      phone,
      email,
      password: hashedPassword,
      ...userData,
      isVerified: false,
      isActive: true,
    });

    const savedUser = await this.userRepository.save(user);

    await this.notificationQueue.add('send_welcome_notification', {
      userId: savedUser.id,
      phone: savedUser.phone,
      email: savedUser.email,
      language: savedUser.preferredLanguage,
    });

    this.logger.log(`User created successfully: ${savedUser.id}`);

    return savedUser;
  }

  async findAll(queryDto: QueryUsersDto, paginationDto: PaginationDto): Promise<PaginatedResult<User>> {
    const { role, isActive, isVerified, search } = queryDto;
    const { page = 1, limit = 20 } = paginationDto;

    const queryBuilder = this.userRepository.createQueryBuilder('user');

    if (role) {
      queryBuilder.andWhere('user.role = :role', { role });
    }

    if (isActive !== undefined) {
      queryBuilder.andWhere('user.isActive = :isActive', { isActive });
    }

    if (isVerified !== undefined) {
      queryBuilder.andWhere('user.isVerified = :isVerified', { isVerified });
    }

    if (search) {
      queryBuilder.andWhere(
        '(user.fullName ILIKE :search OR user.phone ILIKE :search OR user.email ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    queryBuilder
      .orderBy('user.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [users, total] = await queryBuilder.getManyAndCount();

    return {
      data: users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { phone },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    if (updateUserDto.phone && updateUserDto.phone !== user.phone) {
      const existingUser = await this.findByPhone(updateUserDto.phone);
      if (existingUser && existingUser.id !== id) {
        throw new ConflictException('Phone number already in use by another user');
      }
    }

    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.findByEmail(updateUserDto.email);
      if (existingUser && existingUser.id !== id) {
        throw new ConflictException('Email already in use by another user');
      }
    }

    Object.assign(user, updateUserDto);

    const updatedUser = await this.userRepository.save(user);

    this.logger.log(`User updated successfully: ${updatedUser.id}`);

    return updatedUser;
  }

  async updateProfile(id: string, updateProfileDto: UpdateProfileDto): Promise<User> {
    const user = await this.findOne(id);

    Object.assign(user, updateProfileDto);

    const updatedUser = await this.userRepository.save(user);

    this.logger.log(`User profile updated: ${updatedUser.id}`);

    return updatedUser;
  }

  async changePassword(id: string, changePasswordDto: ChangePasswordDto): Promise<{ message: string }> {
    const { currentPassword, newPassword } = changePasswordDto;

    const user = await this.userRepository.findOne({
      where: { id },
      select: ['id', 'password'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 12);
    await this.userRepository.update(id, { password: hashedNewPassword });

    this.logger.log(`Password changed successfully for user: ${id}`);

    return { message: 'Password changed successfully' };
  }

  async updateProfileImage(id: string, imageUrl: string): Promise<User> {
    const user = await this.findOne(id);
    user.profileImageUrl = imageUrl;
    
    const updatedUser = await this.userRepository.save(user);

    this.logger.log(`Profile image updated for user: ${id}`);

    return updatedUser;
  }

  async deactivate(id: string): Promise<User> {
    const user = await this.findOne(id);
    user.isActive = false;

    const updatedUser = await this.userRepository.save(user);

    await this.notificationQueue.add('send_account_deactivated_notification', {
      userId: updatedUser.id,
      phone: updatedUser.phone,
      email: updatedUser.email,
      language: updatedUser.preferredLanguage,
    });

    this.logger.log(`User deactivated: ${updatedUser.id}`);

    return updatedUser;
  }

  async activate(id: string): Promise<User> {
    const user = await this.findOne(id);
    user.isActive = true;

    const updatedUser = await this.userRepository.save(user);

    await this.notificationQueue.add('send_account_activated_notification', {
      userId: updatedUser.id,
      phone: updatedUser.phone,
      email: updatedUser.email,
      language: updatedUser.preferredLanguage,
    });

    this.logger.log(`User activated: ${updatedUser.id}`);

    return updatedUser;
  }

  async updateNotificationPreferences(
    id: string,
    preferences: {
      sms: boolean;
      email: boolean;
      push: boolean;
      whatsapp: boolean;
    },
  ): Promise<User> {
    const user = await this.findOne(id);
    user.notificationPreferences = preferences;

    const updatedUser = await this.userRepository.save(user);

    this.logger.log(`Notification preferences updated for user: ${id}`);

    return updatedUser;
  }

  async getUserStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    verifiedUsers: number;
    usersByRole: Record<UserRole, number>;
  }> {
    const [totalUsers, activeUsers, verifiedUsers] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.count({ where: { isActive: true } }),
      this.userRepository.count({ where: { isVerified: true } }),
    ]);

    const roleStats = await this.userRepository
      .createQueryBuilder('user')
      .select('user.role', 'role')
      .addSelect('COUNT(*)', 'count')
      .groupBy('user.role')
      .getRawMany();

    const usersByRole = Object.values(UserRole).reduce((acc, role) => {
      acc[role] = 0;
      return acc;
    }, {} as Record<UserRole, number>);

    roleStats.forEach(({ role, count }) => {
      usersByRole[role] = parseInt(count);
    });

    return {
      totalUsers,
      activeUsers,
      verifiedUsers,
      usersByRole,
    };
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.userRepository.remove(user);

    this.logger.log(`User permanently deleted: ${id}`);
  }
}