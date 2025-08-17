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
  UploadedFiles,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
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
import { FilesInterceptor } from '@nestjs/platform-express';

import { FarmsService } from './farms.service';
import { FarmAnalyticsService } from './services/farm-analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { CreateFarmDto } from './dto/create-farm.dto';
import { UpdateFarmDto } from './dto/update-farm.dto';
import { QueryFarmsDto } from './dto/query-farms.dto';
import { GeospatialQueryDto } from './dto/geospatial-query.dto';
import { AddSoilTestReportDto } from './dto/add-soil-test-report.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('Farms')
@Controller('farms')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FarmsController {
  constructor(
    private readonly farmsService: FarmsService,
    private readonly farmAnalyticsService: FarmAnalyticsService,
  ) {}

  @Post()
  @ApiOperation({ 
    summary: 'Create a new farm',
    description: 'Register a new farm with location and boundary information'
  })
  @ApiResponse({
    status: 201,
    description: 'Farm created successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid farm data.',
  })
  async create(@Body() createFarmDto: CreateFarmDto, @Request() req) {
    return this.farmsService.create(createFarmDto, req.user.id);
  }

  @Get()
  @ApiOperation({ 
    summary: 'Get all farms',
    description: 'Get paginated list of farms with filtering options'
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'ownerId', required: false, type: String })
  @ApiQuery({ name: 'certificationStatus', required: false, type: String })
  @ApiQuery({ name: 'organicCertified', required: false, type: Boolean })
  @ApiQuery({ name: 'soilType', required: false, type: String })
  @ApiQuery({ name: 'state', required: false, type: String })
  @ApiQuery({ name: 'district', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Farms retrieved successfully.',
  })
  async findAll(
    @Query() queryDto: QueryFarmsDto,
    @Query() paginationDto: PaginationDto,
    @Request() req,
  ) {
    return this.farmsService.findAll(queryDto, paginationDto, req.user);
  }

  @Get('nearby')
  @ApiOperation({ 
    summary: 'Find nearby farms',
    description: 'Find farms within specified radius from given coordinates'
  })
  @ApiQuery({ name: 'latitude', required: true, type: Number })
  @ApiQuery({ name: 'longitude', required: true, type: Number })
  @ApiQuery({ name: 'radius', required: false, type: Number, description: 'Radius in kilometers' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Nearby farms retrieved successfully.',
  })
  async findNearbyFarms(
    @Query() geospatialQuery: GeospatialQueryDto,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.farmsService.findNearbyFarms(geospatialQuery, paginationDto);
  }

  @Get('statistics')
  @ApiOperation({ 
    summary: 'Get farm statistics',
    description: 'Get comprehensive farm statistics for the current user'
  })
  @ApiResponse({
    status: 200,
    description: 'Farm statistics retrieved successfully.',
  })
  async getFarmStatistics(@Request() req) {
    return this.farmsService.getFarmStatistics(req.user);
  }

  @Get(':id/analytics')
  @ApiOperation({ 
    summary: 'Get farm analytics',
    description: 'Get detailed analytics for a specific farm'
  })
  @ApiResponse({
    status: 200,
    description: 'Farm analytics retrieved successfully.',
  })
  @ApiResponse({
    status: 404,
    description: 'Farm not found.',
  })
  async getFarmAnalytics(@Param('id') id: string, @Request() req) {
    return this.farmAnalyticsService.generateFarmAnalytics(id, req.user);
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Get farm by ID',
    description: 'Get specific farm information by ID'
  })
  @ApiResponse({
    status: 200,
    description: 'Farm retrieved successfully.',
  })
  @ApiResponse({
    status: 404,
    description: 'Farm not found.',
  })
  async findOne(@Param('id') id: string, @Request() req) {
    return this.farmsService.findOne(id, req.user);
  }

  @Patch(':id')
  @ApiOperation({ 
    summary: 'Update farm',
    description: 'Update farm information'
  })
  @ApiResponse({
    status: 200,
    description: 'Farm updated successfully.',
  })
  @ApiResponse({
    status: 404,
    description: 'Farm not found.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - You can only update your own farms.',
  })
  async update(
    @Param('id') id: string,
    @Body() updateFarmDto: UpdateFarmDto,
    @Request() req,
  ) {
    return this.farmsService.update(id, updateFarmDto, req.user);
  }

  @Post(':id/images')
  @UseInterceptors(FilesInterceptor('images', 10))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ 
    summary: 'Upload farm images',
    description: 'Upload multiple images for a farm'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        images: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Farm images uploaded successfully.',
  })
  async uploadImages(
    @Param('id') id: string,
    @UploadedFiles(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB per file
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|gif)$/ }),
        ],
      }),
    )
    files: Express.Multer.File[],
    @Request() req,
  ) {
    return this.farmsService.uploadFarmImages(id, files, req.user);
  }

  @Post(':id/soil-test')
  @ApiOperation({ 
    summary: 'Add soil test report',
    description: 'Add soil test report to a farm'
  })
  @ApiResponse({
    status: 200,
    description: 'Soil test report added successfully.',
  })
  async addSoilTestReport(
    @Param('id') id: string,
    @Body() addSoilTestReportDto: AddSoilTestReportDto,
    @Request() req,
  ) {
    return this.farmsService.addSoilTestReport(id, addSoilTestReportDto, req.user);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ 
    summary: 'Deactivate farm',
    description: 'Deactivate a farm (soft delete)'
  })
  @ApiResponse({
    status: 200,
    description: 'Farm deactivated successfully.',
  })
  async deactivate(@Param('id') id: string, @Request() req) {
    return this.farmsService.deactivate(id, req.user);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ 
    summary: 'Delete farm',
    description: 'Permanently delete a farm (Super Admin only)'
  })
  @ApiResponse({
    status: 200,
    description: 'Farm deleted successfully.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Super Admin access required.',
  })
  async remove(@Param('id') id: string, @Request() req) {
    return this.farmsService.remove(id, req.user);
  }
}