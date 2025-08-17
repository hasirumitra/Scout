import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';

import { Farm } from '../entities/farm.entity';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { GeospatialService } from './geospatial.service';

@Injectable()
export class FarmAnalyticsService {
  private readonly logger = new Logger(FarmAnalyticsService.name);

  constructor(
    @InjectRepository(Farm)
    private readonly farmRepository: Repository<Farm>,
    private readonly geospatialService: GeospatialService,
    private readonly configService: ConfigService,
  ) {}

  async generateFarmAnalytics(farmId: string, currentUser: User): Promise<{
    basicInfo: any;
    locationAnalysis: any;
    soilAnalysis: any;
    certificationAnalysis: any;
    recommendations: any;
    sustainability: any;
  }> {
    const farm = await this.farmRepository.findOne({
      where: { id: farmId },
      relations: ['owner'],
    });

    if (!farm) {
      throw new NotFoundException('Farm not found');
    }

    if (
      currentUser.role === UserRole.FARMER &&
      farm.ownerId !== currentUser.id
    ) {
      throw new NotFoundException('Farm not found');
    }

    const [
      basicInfo,
      locationAnalysis,
      soilAnalysis,
      certificationAnalysis,
      recommendations,
      sustainability,
    ] = await Promise.all([
      this.generateBasicInfo(farm),
      this.generateLocationAnalysis(farm),
      this.generateSoilAnalysis(farm),
      this.generateCertificationAnalysis(farm),
      this.generateRecommendations(farm),
      this.generateSustainabilityMetrics(farm),
    ]);

    return {
      basicInfo,
      locationAnalysis,
      soilAnalysis,
      certificationAnalysis,
      recommendations,
      sustainability,
    };
  }

  private async generateBasicInfo(farm: Farm): Promise<any> {
    const establishedYears = farm.farmEstablishmentDate
      ? new Date().getFullYear() - farm.farmEstablishmentDate.getFullYear()
      : null;

    const conversionProgress = farm.conversionStartDate
      ? {
          startDate: farm.conversionStartDate,
          totalPeriod: farm.conversionPeriodYears,
          monthsElapsed: Math.floor(
            (new Date().getTime() - farm.conversionStartDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
          ),
          progressPercentage: Math.min(
            100,
            Math.floor(
              ((new Date().getTime() - farm.conversionStartDate.getTime()) /
                (farm.conversionPeriodYears * 365 * 24 * 60 * 60 * 1000)) *
                100
            )
          ),
        }
      : null;

    return {
      farmId: farm.id,
      name: farm.name,
      area: farm.area,
      areaUnit: farm.areaUnit,
      establishedYears,
      ownershipType: farm.ownershipType,
      farmType: farm.farmType,
      conversionProgress,
      mainCrops: farm.mainCrops || [],
      farmingMethods: farm.farmingMethods || [],
      equipmentOwned: farm.equipmentOwned || [],
    };
  }

  private async generateLocationAnalysis(farm: Farm): Promise<any> {
    const nearbyFarms = await this.farmRepository
      .createQueryBuilder('farm')
      .select(['farm.id', 'farm.name', 'farm.organicCertified'])
      .where(
        `ST_DWithin(farm.location_point::geography, ST_GeogFromText('POINT(${farm.locationPoint.coordinates[0]} ${farm.locationPoint.coordinates[1]})'), 5000)`
      )
      .andWhere('farm.id != :farmId', { farmId: farm.id })
      .andWhere('farm.isActive = true')
      .getMany();

    const organicFarmsNearby = nearbyFarms.filter(f => f.organicCertified).length;
    const totalFarmsNearby = nearbyFarms.length;

    return {
      coordinates: {
        latitude: farm.locationPoint.coordinates[1],
        longitude: farm.locationPoint.coordinates[0],
      },
      address: {
        village: farm.village,
        district: farm.district,
        state: farm.state,
        pinCode: farm.pinCode,
        country: farm.country,
      },
      nearbyFarms: {
        total: totalFarmsNearby,
        organic: organicFarmsNearby,
        organicPercentage: totalFarmsNearby > 0 ? Math.round((organicFarmsNearby / totalFarmsNearby) * 100) : 0,
      },
      accessibility: {
        rating: farm.accessibilityRating,
        nearestMarketDistance: farm.nearestMarketDistance,
        laborAvailability: farm.laborAvailability,
      },
      weatherStationId: farm.weatherStationId,
    };
  }

  private async generateSoilAnalysis(farm: Farm): Promise<any> {
    const soilHealth = this.calculateSoilHealthScore(farm);
    const latestSoilTest = farm.soilTestReports && farm.soilTestReports.length > 0
      ? farm.soilTestReports.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
      : null;

    const nutrientStatus = latestSoilTest
      ? this.analyzeNutrientLevels(latestSoilTest.nutrientLevels)
      : null;

    return {
      soilType: farm.soilType,
      soilPh: farm.soilPh,
      soilHealthScore: soilHealth.score,
      soilHealthGrade: soilHealth.grade,
      waterSource: farm.waterSource,
      irrigationType: farm.irrigationType,
      latestSoilTest: latestSoilTest
        ? {
            date: latestSoilTest.date,
            reportUrl: latestSoilTest.reportUrl,
            nutrientLevels: latestSoilTest.nutrientLevels,
          }
        : null,
      nutrientStatus,
      recommendations: this.generateSoilRecommendations(farm, latestSoilTest?.nutrientLevels),
    };
  }

  private async generateCertificationAnalysis(farm: Farm): Promise<any> {
    const certificationProgress = this.calculateCertificationProgress(farm);
    
    return {
      organicCertified: farm.organicCertified,
      certificationStatus: farm.certificationStatus,
      certificationNumber: farm.certificationNumber,
      certificationAuthority: farm.certificationAuthority,
      certificationDate: farm.certificationDate,
      certificationExpiry: farm.certificationExpiry,
      daysUntilExpiry: farm.certificationExpiry
        ? Math.ceil((farm.certificationExpiry.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        : null,
      progress: certificationProgress,
      eligibilityScore: this.calculateCertificationEligibilityScore(farm),
    };
  }

  private async generateRecommendations(farm: Farm): Promise<any> {
    const recommendations = [];

    if (!farm.organicCertified && farm.certificationStatus === 'not_applied') {
      recommendations.push({
        type: 'certification',
        priority: 'high',
        title: 'Consider Organic Certification',
        description: 'Your farm meets basic requirements for organic certification. This can increase your product value by 20-30%.',
        actions: ['Contact certification body', 'Prepare documentation', 'Schedule inspection'],
      });
    }

    if (!farm.soilTestReports || farm.soilTestReports.length === 0) {
      recommendations.push({
        type: 'soil_testing',
        priority: 'medium',
        title: 'Conduct Soil Testing',
        description: 'Regular soil testing helps optimize fertilizer use and improve crop yields.',
        actions: ['Schedule soil test', 'Contact agricultural laboratory', 'Plan nutrient management'],
      });
    }

    if (farm.nearestMarketDistance && farm.nearestMarketDistance > 20) {
      recommendations.push({
        type: 'market_access',
        priority: 'medium',
        title: 'Improve Market Access',
        description: 'Consider joining farmer producer organizations or exploring online marketplaces to reduce market distance.',
        actions: ['Join FPO', 'Explore online platforms', 'Consider value addition'],
      });
    }

    if (!farm.farmingMethods || farm.farmingMethods.length === 0) {
      recommendations.push({
        type: 'farming_methods',
        priority: 'low',
        title: 'Document Farming Practices',
        description: 'Properly documenting your farming methods helps in certification and knowledge sharing.',
        actions: ['Record farming practices', 'Maintain farm diary', 'Document inputs used'],
      });
    }

    return recommendations;
  }

  private async generateSustainabilityMetrics(farm: Farm): Promise<any> {
    return {
      carbonFootprint: {
        estimated: this.calculateCarbonFootprint(farm),
        unit: 'tons CO2/year',
      },
      biodiversityScore: this.calculateBiodiversityScore(farm),
      waterEfficiency: this.calculateWaterEfficiency(farm),
      soilHealth: this.calculateSoilHealthScore(farm),
      sustainabilityRating: this.calculateOverallSustainabilityRating(farm),
    };
  }

  private calculateSoilHealthScore(farm: Farm): { score: number; grade: string } {
    let score = 50; // Base score

    if (farm.soilPh && farm.soilPh >= 6.0 && farm.soilPh <= 7.5) score += 20;
    if (farm.organicCertified) score += 15;
    if (farm.farmingMethods?.includes('organic')) score += 10;
    if (farm.soilTestReports && farm.soilTestReports.length > 0) score += 5;

    score = Math.min(100, score);

    let grade = 'F';
    if (score >= 90) grade = 'A';
    else if (score >= 80) grade = 'B';
    else if (score >= 70) grade = 'C';
    else if (score >= 60) grade = 'D';
    else if (score >= 50) grade = 'E';

    return { score, grade };
  }

  private analyzeNutrientLevels(nutrients: Record<string, number>): any {
    const analysis = {};
    
    const ranges = {
      nitrogen: { low: 0, medium: 200, high: 400 },
      phosphorus: { low: 0, medium: 25, high: 50 },
      potassium: { low: 0, medium: 150, high: 300 },
      ph: { low: 6.0, medium: 6.5, high: 7.5 },
    };

    for (const [nutrient, value] of Object.entries(nutrients)) {
      if (ranges[nutrient]) {
        const range = ranges[nutrient];
        let status = 'low';
        if (value >= range.high) status = 'high';
        else if (value >= range.medium) status = 'medium';
        
        analysis[nutrient] = { value, status };
      }
    }

    return analysis;
  }

  private generateSoilRecommendations(farm: Farm, nutrients?: Record<string, number>): string[] {
    const recommendations = [];

    if (farm.soilPh && farm.soilPh < 6.0) {
      recommendations.push('Apply lime to increase soil pH');
    } else if (farm.soilPh && farm.soilPh > 7.5) {
      recommendations.push('Apply organic matter to reduce soil alkalinity');
    }

    if (nutrients) {
      if (nutrients.nitrogen && nutrients.nitrogen < 200) {
        recommendations.push('Increase nitrogen through organic compost or green manure');
      }
      if (nutrients.phosphorus && nutrients.phosphorus < 25) {
        recommendations.push('Add rock phosphate or bone meal');
      }
      if (nutrients.potassium && nutrients.potassium < 150) {
        recommendations.push('Apply wood ash or organic potassium sources');
      }
    }

    return recommendations;
  }

  private calculateCertificationProgress(farm: Farm): any {
    if (farm.certificationStatus === 'not_applied') {
      return { stage: 'not_started', progress: 0 };
    }

    const stages = {
      'not_applied': 0,
      'in_progress': 50,
      'certified': 100,
      'expired': 100,
      'rejected': 25,
    };

    return {
      stage: farm.certificationStatus,
      progress: stages[farm.certificationStatus] || 0,
    };
  }

  private calculateCertificationEligibilityScore(farm: Farm): number {
    let score = 0;

    if (farm.conversionStartDate && 
        (new Date().getTime() - farm.conversionStartDate.getTime()) >= (farm.conversionPeriodYears * 365 * 24 * 60 * 60 * 1000)) {
      score += 30;
    }

    if (farm.farmingMethods?.includes('organic')) score += 25;
    if (!farm.farmingMethods?.some(method => ['chemical', 'synthetic'].includes(method))) score += 20;
    if (farm.soilTestReports && farm.soilTestReports.length > 0) score += 15;
    if (farm.registrationNumber) score += 10;

    return Math.min(100, score);
  }

  private calculateCarbonFootprint(farm: Farm): number {
    let footprint = farm.area * 0.5;
    
    if (farm.organicCertified) footprint *= 0.7;
    if (farm.farmingMethods?.includes('no-till')) footprint *= 0.9;
    
    return Math.round(footprint * 100) / 100;
  }

  private calculateBiodiversityScore(farm: Farm): number {
    let score = 50;
    
    if (farm.organicCertified) score += 20;
    if (farm.farmingMethods?.includes('agroforestry')) score += 15;
    if ((farm.mainCrops?.length || 0) > 3) score += 10;
    if (farm.farmingMethods?.includes('intercropping')) score += 5;
    
    return Math.min(100, score);
  }

  private calculateWaterEfficiency(farm: Farm): number {
    let efficiency = 50;
    
    if (farm.irrigationType === 'drip') efficiency += 30;
    else if (farm.irrigationType === 'sprinkler') efficiency += 20;
    else if (farm.irrigationType === 'flood') efficiency -= 10;
    
    if (farm.waterSource === 'rainwater_harvesting') efficiency += 20;
    
    return Math.min(100, Math.max(0, efficiency));
  }

  private calculateOverallSustainabilityRating(farm: Farm): string {
    const soilHealth = this.calculateSoilHealthScore(farm).score;
    const biodiversity = this.calculateBiodiversityScore(farm);
    const waterEfficiency = this.calculateWaterEfficiency(farm);
    
    const overall = (soilHealth + biodiversity + waterEfficiency) / 3;
    
    if (overall >= 80) return 'Excellent';
    if (overall >= 70) return 'Good';
    if (overall >= 60) return 'Fair';
    return 'Needs Improvement';
  }
}