import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

import { Crop } from './entities/crop.entity';
import { CreateCropDto } from './dto/create-crop.dto';
import { UpdateCropDto } from './dto/update-crop.dto';
import { QueryCropsDto } from './dto/query-crops.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';

@Injectable()
export class CropsService {
  private readonly logger = new Logger(CropsService.name);

  constructor(
    @InjectRepository(Crop)
    private readonly cropRepository: Repository<Crop>,
    @InjectQueue('crop-analytics')
    private readonly analyticsQueue: Queue,
  ) {}

  async create(createCropDto: CreateCropDto): Promise<Crop> {
    const existingCrop = await this.cropRepository.findOne({
      where: { name: createCropDto.name },
    });

    if (existingCrop) {
      throw new BadRequestException(`Crop with name '${createCropDto.name}' already exists`);
    }

    const crop = this.cropRepository.create({
      ...createCropDto,
      isActive: true,
    });

    const savedCrop = await this.cropRepository.save(crop);

    await this.analyticsQueue.add('index-new-crop', {
      cropId: savedCrop.id,
      cropData: savedCrop,
    });

    this.logger.log(`Crop created successfully: ${savedCrop.id} - ${savedCrop.name}`);

    return savedCrop;
  }

  async findAll(
    queryDto: QueryCropsDto,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<Crop>> {
    const { category, season, search, organicSuitable, difficulty, isActive = true } = queryDto;
    const { page = 1, limit = 20 } = paginationDto;

    const queryBuilder = this.cropRepository.createQueryBuilder('crop');

    if (category) {
      queryBuilder.andWhere('crop.category = :category', { category });
    }

    if (season) {
      queryBuilder.andWhere('crop.season = :season', { season });
    }

    if (organicSuitable !== undefined) {
      queryBuilder.andWhere('crop.organicSuitable = :organicSuitable', { organicSuitable });
    }

    if (difficulty) {
      queryBuilder.andWhere('crop.cultivationDifficulty = :difficulty', { difficulty });
    }

    if (search) {
      queryBuilder.andWhere(
        '(crop.name ILIKE :search OR crop.scientificName ILIKE :search OR crop.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    queryBuilder.andWhere('crop.isActive = :isActive', { isActive });

    queryBuilder
      .orderBy('crop.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [crops, total] = await queryBuilder.getManyAndCount();

    return {
      data: crops,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<Crop> {
    const crop = await this.cropRepository.findOne({
      where: { id, isActive: true },
    });

    if (!crop) {
      throw new NotFoundException(`Crop with ID ${id} not found`);
    }

    return crop;
  }

  async findByCategory(category: string): Promise<Crop[]> {
    return this.cropRepository.find({
      where: { category, isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findBySeason(season: string): Promise<Crop[]> {
    return this.cropRepository.find({
      where: { season, isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findSuitableForSoil(soilType: string, soilPh?: number): Promise<Crop[]> {
    const queryBuilder = this.cropRepository.createQueryBuilder('crop');

    queryBuilder.where('crop.isActive = true');

    if (soilType) {
      queryBuilder.andWhere(
        `crop.suitableSoilTypes @> :soilType OR crop.suitableSoilTypes IS NULL`,
        { soilType: JSON.stringify([soilType]) },
      );
    }

    if (soilPh) {
      queryBuilder.andWhere(
        '(crop.idealSoilPhMin IS NULL OR crop.idealSoilPhMin <= :soilPh) AND (crop.idealSoilPhMax IS NULL OR crop.idealSoilPhMax >= :soilPh)',
        { soilPh },
      );
    }

    return queryBuilder.orderBy('crop.name', 'ASC').getMany();
  }

  async findCompanionCrops(cropId: string): Promise<Crop[]> {
    const crop = await this.findOne(cropId);

    if (!crop.companionCrops || crop.companionCrops.length === 0) {
      return [];
    }

    return this.cropRepository.find({
      where: {
        name: In(crop.companionCrops),
        isActive: true,
      },
      order: { name: 'ASC' },
    });
  }

  async findIncompatibleCrops(cropId: string): Promise<Crop[]> {
    const crop = await this.findOne(cropId);

    if (!crop.incompatibleCrops || crop.incompatibleCrops.length === 0) {
      return [];
    }

    return this.cropRepository.find({
      where: {
        name: In(crop.incompatibleCrops),
        isActive: true,
      },
      order: { name: 'ASC' },
    });
  }

  async update(id: string, updateCropDto: UpdateCropDto): Promise<Crop> {
    const crop = await this.findOne(id);

    if (updateCropDto.name && updateCropDto.name !== crop.name) {
      const existingCrop = await this.cropRepository.findOne({
        where: { name: updateCropDto.name },
      });

      if (existingCrop && existingCrop.id !== id) {
        throw new BadRequestException(`Crop with name '${updateCropDto.name}' already exists`);
      }
    }

    Object.assign(crop, updateCropDto);

    const updatedCrop = await this.cropRepository.save(crop);

    await this.analyticsQueue.add('update-crop-index', {
      cropId: updatedCrop.id,
      changes: updateCropDto,
    });

    this.logger.log(`Crop updated successfully: ${updatedCrop.id} - ${updatedCrop.name}`);

    return updatedCrop;
  }

  async updateMarketPrice(id: string, newPrice: number): Promise<Crop> {
    const crop = await this.findOne(id);
    
    crop.marketPricePerUnit = newPrice;
    
    const updatedCrop = await this.cropRepository.save(crop);

    await this.analyticsQueue.add('price-updated', {
      cropId: id,
      oldPrice: crop.marketPricePerUnit,
      newPrice,
      timestamp: new Date(),
    });

    this.logger.log(`Market price updated for crop: ${crop.name} - ${newPrice} ${crop.priceCurrency}`);

    return updatedCrop;
  }

  async getCategories(): Promise<{ category: string; count: number }[]> {
    const categories = await this.cropRepository
      .createQueryBuilder('crop')
      .select('crop.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .where('crop.isActive = true')
      .groupBy('crop.category')
      .orderBy('crop.category', 'ASC')
      .getRawMany();

    return categories.map(cat => ({
      category: cat.category,
      count: parseInt(cat.count),
    }));
  }

  async getSeasons(): Promise<{ season: string; count: number }[]> {
    const seasons = await this.cropRepository
      .createQueryBuilder('crop')
      .select('crop.season', 'season')
      .addSelect('COUNT(*)', 'count')
      .where('crop.isActive = true')
      .groupBy('crop.season')
      .orderBy('crop.season', 'ASC')
      .getRawMany();

    return seasons.map(season => ({
      season: season.season,
      count: parseInt(season.count),
    }));
  }

  async getCropStatistics(): Promise<{
    totalCrops: number;
    organicSuitableCrops: number;
    categoriesCount: number;
    seasonsCount: number;
    averageGrowingPeriod: number;
    priceRange: { min: number; max: number; currency: string };
  }> {
    const [
      totalCrops,
      organicSuitableCrops,
      uniqueCategories,
      uniqueSeasons,
      avgGrowingPeriod,
      priceStats,
    ] = await Promise.all([
      this.cropRepository.count({ where: { isActive: true } }),
      this.cropRepository.count({ where: { isActive: true, organicSuitable: true } }),
      this.cropRepository
        .createQueryBuilder('crop')
        .select('COUNT(DISTINCT crop.category)', 'count')
        .where('crop.isActive = true')
        .getRawOne(),
      this.cropRepository
        .createQueryBuilder('crop')
        .select('COUNT(DISTINCT crop.season)', 'count')
        .where('crop.isActive = true')
        .getRawOne(),
      this.cropRepository
        .createQueryBuilder('crop')
        .select('AVG(crop.growingPeriodDays)', 'average')
        .where('crop.isActive = true')
        .getRawOne(),
      this.cropRepository
        .createQueryBuilder('crop')
        .select('MIN(crop.marketPricePerUnit)', 'min')
        .addSelect('MAX(crop.marketPricePerUnit)', 'max')
        .where('crop.isActive = true')
        .andWhere('crop.marketPricePerUnit IS NOT NULL')
        .getRawOne(),
    ]);

    return {
      totalCrops,
      organicSuitableCrops,
      categoriesCount: parseInt(uniqueCategories.count),
      seasonsCount: parseInt(uniqueSeasons.count),
      averageGrowingPeriod: Math.round(parseFloat(avgGrowingPeriod.average || '0')),
      priceRange: {
        min: parseFloat(priceStats.min || '0'),
        max: parseFloat(priceStats.max || '0'),
        currency: 'INR',
      },
    };
  }

  async searchCrops(searchTerm: string, limit: number = 10): Promise<Crop[]> {
    return this.cropRepository
      .createQueryBuilder('crop')
      .where('crop.isActive = true')
      .andWhere(
        '(crop.name ILIKE :search OR crop.scientificName ILIKE :search)',
        { search: `%${searchTerm}%` },
      )
      .orderBy('crop.name', 'ASC')
      .limit(limit)
      .getMany();
  }

  async deactivate(id: string): Promise<Crop> {
    const crop = await this.findOne(id);
    crop.isActive = false;

    const updatedCrop = await this.cropRepository.save(crop);

    this.logger.log(`Crop deactivated: ${updatedCrop.id} - ${updatedCrop.name}`);

    return updatedCrop;
  }

  async remove(id: string): Promise<void> {
    const crop = await this.findOne(id);
    await this.cropRepository.remove(crop);

    this.logger.log(`Crop permanently deleted: ${id}`);
  }
}