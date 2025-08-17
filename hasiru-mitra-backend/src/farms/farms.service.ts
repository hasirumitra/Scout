import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Point as TypeOrmPoint } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Point, Polygon } from 'geojson';

import { Farm } from './entities/farm.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { CreateFarmDto } from './dto/create-farm.dto';
import { UpdateFarmDto } from './dto/update-farm.dto';
import { QueryFarmsDto } from './dto/query-farms.dto';
import { GeospatialQueryDto } from './dto/geospatial-query.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { GeospatialService } from './services/geospatial.service';

@Injectable()
export class FarmsService {
  private readonly logger = new Logger(FarmsService.name);

  constructor(
    @InjectRepository(Farm)
    private readonly farmRepository: Repository<Farm>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly geospatialService: GeospatialService,
    @InjectQueue('geospatial-processing')
    private readonly geospatialQueue: Queue,
    @InjectQueue('farm-analytics')
    private readonly analyticsQueue: Queue,
  ) {}

  async create(createFarmDto: CreateFarmDto, userId: string): Promise<Farm> {
    const { latitude, longitude, boundaryCoordinates, ...farmData } = createFarmDto;

    const owner = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!owner) {
      throw new NotFoundException('User not found');
    }

    const locationPoint: Point = {
      type: 'Point',
      coordinates: [longitude, latitude],
    };

    let boundaryPolygon: Polygon | undefined;
    if (boundaryCoordinates && boundaryCoordinates.length >= 3) {
      boundaryPolygon = {
        type: 'Polygon',
        coordinates: [boundaryCoordinates],
      };

      const calculatedArea = await this.geospatialService.calculatePolygonArea(boundaryPolygon);
      if (Math.abs(calculatedArea - farmData.area) > calculatedArea * 0.1) {
        this.logger.warn(
          `Area mismatch for farm: declared ${farmData.area}, calculated ${calculatedArea}`,
        );
      }
    }

    const farm = this.farmRepository.create({
      ...farmData,
      ownerId: userId,
      locationPoint,
      boundaryPolygon,
      isActive: true,
    });

    const savedFarm = await this.farmRepository.save(farm);

    await Promise.all([
      this.geospatialQueue.add('validate-farm-boundaries', {
        farmId: savedFarm.id,
        locationPoint,
        boundaryPolygon,
      }),
      this.analyticsQueue.add('generate-farm-insights', {
        farmId: savedFarm.id,
        location: { latitude, longitude },
        area: farmData.area,
        soilType: farmData.soilType,
      }),
    ]);

    this.logger.log(`Farm created successfully: ${savedFarm.id}`);

    return savedFarm;
  }

  async findAll(
    queryDto: QueryFarmsDto,
    paginationDto: PaginationDto,
    currentUser: User,
  ): Promise<PaginatedResult<Farm>> {
    const { ownerId, certificationStatus, organicCertified, soilType, state, district, search } = queryDto;
    const { page = 1, limit = 20 } = paginationDto;

    const queryBuilder = this.farmRepository.createQueryBuilder('farm')
      .leftJoinAndSelect('farm.owner', 'owner');

    if (currentUser.role === UserRole.FARMER) {
      queryBuilder.andWhere('farm.ownerId = :userId', { userId: currentUser.id });
    } else if (ownerId) {
      queryBuilder.andWhere('farm.ownerId = :ownerId', { ownerId });
    }

    if (certificationStatus) {
      queryBuilder.andWhere('farm.certificationStatus = :certificationStatus', { certificationStatus });
    }

    if (organicCertified !== undefined) {
      queryBuilder.andWhere('farm.organicCertified = :organicCertified', { organicCertified });
    }

    if (soilType) {
      queryBuilder.andWhere('farm.soilType = :soilType', { soilType });
    }

    if (state) {
      queryBuilder.andWhere('farm.state ILIKE :state', { state: `%${state}%` });
    }

    if (district) {
      queryBuilder.andWhere('farm.district ILIKE :district', { district: `%${district}%` });
    }

    if (search) {
      queryBuilder.andWhere(
        '(farm.name ILIKE :search OR farm.address ILIKE :search OR farm.village ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    queryBuilder.andWhere('farm.isActive = :isActive', { isActive: true });

    queryBuilder
      .orderBy('farm.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [farms, total] = await queryBuilder.getManyAndCount();

    return {
      data: farms,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, currentUser: User): Promise<Farm> {
    const farm = await this.farmRepository.findOne({
      where: { id },
      relations: ['owner'],
    });

    if (!farm) {
      throw new NotFoundException(`Farm with ID ${id} not found`);
    }

    if (
      currentUser.role === UserRole.FARMER &&
      farm.ownerId !== currentUser.id
    ) {
      throw new ForbiddenException('You can only access your own farms');
    }

    return farm;
  }

  async findNearbyFarms(
    geospatialQuery: GeospatialQueryDto,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<Farm & { distance: number }>> {
    const { latitude, longitude, radius = 10 } = geospatialQuery;
    const { page = 1, limit = 20 } = paginationDto;

    const point = `POINT(${longitude} ${latitude})`;
    const radiusInMeters = radius * 1000;

    const query = this.farmRepository
      .createQueryBuilder('farm')
      .leftJoinAndSelect('farm.owner', 'owner')
      .addSelect(
        `ST_Distance(farm.location_point::geography, ST_GeogFromText('${point}'))`,
        'distance',
      )
      .where(
        `ST_DWithin(farm.location_point::geography, ST_GeogFromText('${point}'), ${radiusInMeters})`,
      )
      .andWhere('farm.isActive = true')
      .orderBy('distance', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [farmsWithDistance, total] = await Promise.all([
      query.getRawAndEntities(),
      query.getCount(),
    ]);

    const data = farmsWithDistance.entities.map((farm, index) => ({
      ...farm,
      distance: Math.round(farmsWithDistance.raw[index].distance),
    }));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async update(id: string, updateFarmDto: UpdateFarmDto, currentUser: User): Promise<Farm> {
    const farm = await this.findOne(id, currentUser);

    if (
      currentUser.role === UserRole.FARMER &&
      farm.ownerId !== currentUser.id
    ) {
      throw new ForbiddenException('You can only update your own farms');
    }

    const { latitude, longitude, boundaryCoordinates, ...farmData } = updateFarmDto;

    if (latitude && longitude) {
      farm.locationPoint = {
        type: 'Point',
        coordinates: [longitude, latitude],
      };
    }

    if (boundaryCoordinates && boundaryCoordinates.length >= 3) {
      farm.boundaryPolygon = {
        type: 'Polygon',
        coordinates: [boundaryCoordinates],
      };

      const calculatedArea = await this.geospatialService.calculatePolygonArea(farm.boundaryPolygon);
      if (farmData.area && Math.abs(calculatedArea - farmData.area) > calculatedArea * 0.1) {
        this.logger.warn(
          `Area mismatch for updated farm: declared ${farmData.area}, calculated ${calculatedArea}`,
        );
      }
    }

    Object.assign(farm, farmData);

    const updatedFarm = await this.farmRepository.save(farm);

    await this.analyticsQueue.add('update-farm-insights', {
      farmId: updatedFarm.id,
      changes: farmData,
    });

    this.logger.log(`Farm updated successfully: ${updatedFarm.id}`);

    return updatedFarm;
  }

  async uploadFarmImages(
    id: string,
    images: Express.Multer.File[],
    currentUser: User,
  ): Promise<Farm> {
    const farm = await this.findOne(id, currentUser);

    if (
      currentUser.role === UserRole.FARMER &&
      farm.ownerId !== currentUser.id
    ) {
      throw new ForbiddenException('You can only update your own farms');
    }

    const imageUrls: string[] = [];
    for (const image of images) {
      await this.geospatialQueue.add('process-farm-image', {
        farmId: farm.id,
        imageBuffer: image.buffer,
        fileName: image.originalname,
      });
      
      imageUrls.push(`/uploads/farms/${farm.id}/${image.originalname}`);
    }

    farm.farmImages = [...(farm.farmImages || []), ...imageUrls];

    const updatedFarm = await this.farmRepository.save(farm);

    this.logger.log(`Farm images uploaded for farm: ${farm.id}`);

    return updatedFarm;
  }

  async addSoilTestReport(
    id: string,
    report: {
      date: Date;
      reportUrl: string;
      nutrientLevels: Record<string, number>;
    },
    currentUser: User,
  ): Promise<Farm> {
    const farm = await this.findOne(id, currentUser);

    if (
      currentUser.role === UserRole.FARMER &&
      farm.ownerId !== currentUser.id
    ) {
      throw new ForbiddenException('You can only update your own farms');
    }

    farm.soilTestReports = [...(farm.soilTestReports || []), report];

    const updatedFarm = await this.farmRepository.save(farm);

    await this.analyticsQueue.add('analyze-soil-test', {
      farmId: farm.id,
      nutrientLevels: report.nutrientLevels,
    });

    this.logger.log(`Soil test report added for farm: ${farm.id}`);

    return updatedFarm;
  }

  async getFarmStatistics(currentUser: User): Promise<{
    totalFarms: number;
    organicCertifiedFarms: number;
    totalArea: number;
    certificationStatusBreakdown: Record<string, number>;
    soilTypeBreakdown: Record<string, number>;
    stateDistribution: Record<string, number>;
  }> {
    const baseQuery = this.farmRepository.createQueryBuilder('farm');

    if (currentUser.role === UserRole.FARMER) {
      baseQuery.where('farm.ownerId = :userId', { userId: currentUser.id });
    }

    const [
      totalFarms,
      organicCertifiedFarms,
      totalAreaResult,
      certificationStats,
      soilTypeStats,
      stateStats,
    ] = await Promise.all([
      baseQuery.clone().andWhere('farm.isActive = true').getCount(),
      baseQuery.clone().andWhere('farm.organicCertified = true').andWhere('farm.isActive = true').getCount(),
      baseQuery.clone().select('SUM(farm.area)', 'total').andWhere('farm.isActive = true').getRawOne(),
      baseQuery
        .clone()
        .select('farm.certificationStatus', 'status')
        .addSelect('COUNT(*)', 'count')
        .andWhere('farm.isActive = true')
        .groupBy('farm.certificationStatus')
        .getRawMany(),
      baseQuery
        .clone()
        .select('farm.soilType', 'type')
        .addSelect('COUNT(*)', 'count')
        .andWhere('farm.isActive = true')
        .andWhere('farm.soilType IS NOT NULL')
        .groupBy('farm.soilType')
        .getRawMany(),
      baseQuery
        .clone()
        .select('farm.state', 'state')
        .addSelect('COUNT(*)', 'count')
        .andWhere('farm.isActive = true')
        .andWhere('farm.state IS NOT NULL')
        .groupBy('farm.state')
        .getRawMany(),
    ]);

    const certificationStatusBreakdown = {};
    certificationStats.forEach(({ status, count }) => {
      certificationStatusBreakdown[status] = parseInt(count);
    });

    const soilTypeBreakdown = {};
    soilTypeStats.forEach(({ type, count }) => {
      soilTypeBreakdown[type] = parseInt(count);
    });

    const stateDistribution = {};
    stateStats.forEach(({ state, count }) => {
      stateDistribution[state] = parseInt(count);
    });

    return {
      totalFarms,
      organicCertifiedFarms,
      totalArea: parseFloat(totalAreaResult?.total || '0'),
      certificationStatusBreakdown,
      soilTypeBreakdown,
      stateDistribution,
    };
  }

  async deactivate(id: string, currentUser: User): Promise<Farm> {
    const farm = await this.findOne(id, currentUser);

    if (
      currentUser.role === UserRole.FARMER &&
      farm.ownerId !== currentUser.id
    ) {
      throw new ForbiddenException('You can only deactivate your own farms');
    }

    farm.isActive = false;

    const updatedFarm = await this.farmRepository.save(farm);

    this.logger.log(`Farm deactivated: ${updatedFarm.id}`);

    return updatedFarm;
  }

  async remove(id: string, currentUser: User): Promise<void> {
    const farm = await this.findOne(id, currentUser);

    if (currentUser.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only super admin can permanently delete farms');
    }

    await this.farmRepository.remove(farm);

    this.logger.log(`Farm permanently deleted: ${id}`);
  }
}