import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';

import { CropsService } from './crops.service';
import { CropRecommendationService } from './services/crop-recommendation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { CreateCropDto } from './dto/create-crop.dto';
import { UpdateCropDto } from './dto/update-crop.dto';
import { QueryCropsDto } from './dto/query-crops.dto';
import { UpdatePriceDto } from './dto/update-price.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('Crops')
@Controller('crops')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CropsController {
  constructor(
    private readonly cropsService: CropsService,
    private readonly cropRecommendationService: CropRecommendationService,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ 
    summary: 'Create a new crop',
    description: 'Add a new crop to the system (Admin only)'
  })
  @ApiResponse({
    status: 201,
    description: 'Crop created successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Crop with this name already exists.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required.',
  })
  async create(@Body() createCropDto: CreateCropDto) {
    return this.cropsService.create(createCropDto);
  }

  @Get()
  @ApiOperation({ 
    summary: 'Get all crops',
    description: 'Get paginated list of crops with filtering options'
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'season', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'organicSuitable', required: false, type: Boolean })
  @ApiQuery({ name: 'difficulty', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Crops retrieved successfully.',
  })
  async findAll(
    @Query() queryDto: QueryCropsDto,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.cropsService.findAll(queryDto, paginationDto);
  }

  @Get('categories')
  @ApiOperation({ 
    summary: 'Get crop categories',
    description: 'Get list of all crop categories with counts'
  })
  @ApiResponse({
    status: 200,
    description: 'Crop categories retrieved successfully.',
  })
  async getCategories() {
    return this.cropsService.getCategories();
  }

  @Get('seasons')
  @ApiOperation({ 
    summary: 'Get crop seasons',
    description: 'Get list of all crop seasons with counts'
  })
  @ApiResponse({
    status: 200,
    description: 'Crop seasons retrieved successfully.',
  })
  async getSeasons() {
    return this.cropsService.getSeasons();
  }

  @Get('statistics')
  @ApiOperation({ 
    summary: 'Get crop statistics',
    description: 'Get comprehensive crop statistics'
  })
  @ApiResponse({
    status: 200,
    description: 'Crop statistics retrieved successfully.',
  })
  async getCropStatistics() {
    return this.cropsService.getCropStatistics();
  }

  @Get('search')
  @ApiOperation({ 
    summary: 'Search crops',
    description: 'Search crops by name or scientific name'
  })
  @ApiQuery({ name: 'q', required: true, type: String, description: 'Search term' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Result limit' })
  @ApiResponse({
    status: 200,
    description: 'Search results retrieved successfully.',
  })
  async searchCrops(
    @Query('q') searchTerm: string,
    @Query('limit') limit?: number,
  ) {
    return this.cropsService.searchCrops(searchTerm, limit);
  }

  @Get('recommendations')
  @ApiOperation({ 
    summary: 'Get crop recommendations',
    description: 'Get personalized crop recommendations based on farm conditions'
  })
  @ApiQuery({ name: 'farmId', required: false, type: String })
  @ApiQuery({ name: 'soilType', required: false, type: String })
  @ApiQuery({ name: 'soilPh', required: false, type: Number })
  @ApiQuery({ name: 'season', required: false, type: String })
  @ApiQuery({ name: 'area', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Crop recommendations retrieved successfully.',
  })
  async getCropRecommendations(
    @Query('farmId') farmId?: string,
    @Query('soilType') soilType?: string,
    @Query('soilPh') soilPh?: number,
    @Query('season') season?: string,
    @Query('area') area?: number,
  ) {
    return this.cropRecommendationService.getRecommendations({
      farmId,
      soilType,
      soilPh,
      season,
      area,
    });
  }

  @Get('category/:category')
  @ApiOperation({ 
    summary: 'Get crops by category',
    description: 'Get all crops in a specific category'
  })
  @ApiResponse({
    status: 200,
    description: 'Crops retrieved successfully.',
  })
  async findByCategory(@Param('category') category: string) {
    return this.cropsService.findByCategory(category);
  }

  @Get('season/:season')
  @ApiOperation({ 
    summary: 'Get crops by season',
    description: 'Get all crops suitable for a specific season'
  })
  @ApiResponse({
    status: 200,
    description: 'Crops retrieved successfully.',
  })
  async findBySeason(@Param('season') season: string) {
    return this.cropsService.findBySeason(season);
  }

  @Get('suitable-for-soil')
  @ApiOperation({ 
    summary: 'Get crops suitable for soil conditions',
    description: 'Get crops suitable for specific soil type and pH'
  })
  @ApiQuery({ name: 'soilType', required: true, type: String })
  @ApiQuery({ name: 'soilPh', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Suitable crops retrieved successfully.',
  })
  async findSuitableForSoil(
    @Query('soilType') soilType: string,
    @Query('soilPh') soilPh?: number,
  ) {
    return this.cropsService.findSuitableForSoil(soilType, soilPh);
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Get crop by ID',
    description: 'Get specific crop information by ID'
  })
  @ApiResponse({
    status: 200,
    description: 'Crop retrieved successfully.',
  })
  @ApiResponse({
    status: 404,
    description: 'Crop not found.',
  })
  async findOne(@Param('id') id: string) {
    return this.cropsService.findOne(id);
  }

  @Get(':id/companions')
  @ApiOperation({ 
    summary: 'Get companion crops',
    description: 'Get crops that grow well together with the specified crop'
  })
  @ApiResponse({
    status: 200,
    description: 'Companion crops retrieved successfully.',
  })
  async findCompanionCrops(@Param('id') id: string) {
    return this.cropsService.findCompanionCrops(id);
  }

  @Get(':id/incompatible')
  @ApiOperation({ 
    summary: 'Get incompatible crops',
    description: 'Get crops that should not be grown together with the specified crop'
  })
  @ApiResponse({
    status: 200,
    description: 'Incompatible crops retrieved successfully.',
  })
  async findIncompatibleCrops(@Param('id') id: string) {
    return this.cropsService.findIncompatibleCrops(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ 
    summary: 'Update crop',
    description: 'Update crop information (Admin only)'
  })
  @ApiResponse({
    status: 200,
    description: 'Crop updated successfully.',
  })
  @ApiResponse({
    status: 404,
    description: 'Crop not found.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required.',
  })
  async update(@Param('id') id: string, @Body() updateCropDto: UpdateCropDto) {
    return this.cropsService.update(id, updateCropDto);
  }

  @Patch(':id/price')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ 
    summary: 'Update crop market price',
    description: 'Update market price for a specific crop (Admin only)'
  })
  @ApiResponse({
    status: 200,
    description: 'Crop price updated successfully.',
  })
  async updatePrice(@Param('id') id: string, @Body() updatePriceDto: UpdatePriceDto) {
    return this.cropsService.updateMarketPrice(id, updatePriceDto.price);
  }

  @Patch(':id/deactivate')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ 
    summary: 'Deactivate crop',
    description: 'Deactivate a crop (Admin only)'
  })
  @ApiResponse({
    status: 200,
    description: 'Crop deactivated successfully.',
  })
  async deactivate(@Param('id') id: string) {
    return this.cropsService.deactivate(id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ 
    summary: 'Delete crop',
    description: 'Permanently delete a crop (Super Admin only)'
  })
  @ApiResponse({
    status: 200,
    description: 'Crop deleted successfully.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Super Admin access required.',
  })
  async remove(@Param('id') id: string) {
    return this.cropsService.remove(id);
  }
}