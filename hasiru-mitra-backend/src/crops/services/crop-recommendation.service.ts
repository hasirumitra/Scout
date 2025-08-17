import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Crop } from '../entities/crop.entity';
import { Farm } from '../../farms/entities/farm.entity';
import { CropCultivation } from '../entities/crop-cultivation.entity';

@Injectable()
export class CropRecommendationService {
  private readonly logger = new Logger(CropRecommendationService.name);

  constructor(
    @InjectRepository(Crop)
    private readonly cropRepository: Repository<Crop>,
    @InjectRepository(Farm)
    private readonly farmRepository: Repository<Farm>,
    @InjectRepository(CropCultivation)
    private readonly cropCultivationRepository: Repository<CropCultivation>,
  ) {}

  async getRecommendations(params: {
    farmId?: string;
    soilType?: string;
    soilPh?: number;
    season?: string;
    area?: number;
  }): Promise<{
    recommendations: any[];
    criteria: any;
    totalRecommendations: number;
  }> {
    const { farmId, soilType, soilPh, season, area } = params;

    let farmData: Farm | null = null;
    if (farmId) {
      farmData = await this.farmRepository.findOne({
        where: { id: farmId },
      });
    }

    const criteria = this.buildCriteria(farmData, params);
    const suitableCrops = await this.findSuitableCrops(criteria);
    const scoredCrops = await this.scoreCrops(suitableCrops, criteria, farmData);
    const recommendations = this.formatRecommendations(scoredCrops, criteria);

    this.logger.log(`Generated ${recommendations.length} crop recommendations`);

    return {
      recommendations: recommendations.slice(0, 10), // Top 10 recommendations
      criteria,
      totalRecommendations: recommendations.length,
    };
  }

  private buildCriteria(farm: Farm | null, params: any): any {
    const currentMonth = new Date().getMonth() + 1;
    const currentSeason = this.getCurrentSeason(currentMonth);

    return {
      soilType: farm?.soilType || params.soilType,
      soilPh: farm?.soilPh || params.soilPh,
      season: params.season || currentSeason,
      area: params.area || farm?.area || 1,
      areaUnit: farm?.areaUnit || 'acres',
      climate: this.getClimateFromLocation(farm),
      previousCrops: farm ? [] : [], // Will be populated with historical data
      farmingMethod: farm?.farmingMethods || [],
      organicCertified: farm?.organicCertified || false,
    };
  }

  private getCurrentSeason(month: number): string {
    if (month >= 6 && month <= 10) return 'kharif';
    if (month >= 11 || month <= 3) return 'rabi';
    return 'zaid';
  }

  private getClimateFromLocation(farm: Farm | null): string {
    if (!farm) return 'temperate';
    
    // Basic climate inference based on location
    // In a real implementation, this would use weather data APIs
    const state = farm.state?.toLowerCase();
    
    if (['rajasthan', 'gujarat', 'maharashtra'].includes(state || '')) {
      return 'semi-arid';
    } else if (['kerala', 'karnataka', 'tamil nadu'].includes(state || '')) {
      return 'tropical';
    } else if (['punjab', 'haryana', 'uttar pradesh'].includes(state || '')) {
      return 'subtropical';
    }
    
    return 'temperate';
  }

  private async findSuitableCrops(criteria: any): Promise<Crop[]> {
    const queryBuilder = this.cropRepository.createQueryBuilder('crop');

    queryBuilder.where('crop.isActive = true');

    if (criteria.season) {
      queryBuilder.andWhere(
        '(crop.season = :season OR crop.season = :yearRound)',
        { season: criteria.season, yearRound: 'year-round' }
      );
    }

    if (criteria.soilType) {
      queryBuilder.andWhere(
        `(crop.suitableSoilTypes @> :soilType OR crop.suitableSoilTypes IS NULL)`,
        { soilType: JSON.stringify([criteria.soilType]) }
      );
    }

    if (criteria.soilPh) {
      queryBuilder.andWhere(
        '(crop.idealSoilPhMin IS NULL OR crop.idealSoilPhMin <= :soilPh) AND (crop.idealSoilPhMax IS NULL OR crop.idealSoilPhMax >= :soilPh)',
        { soilPh: criteria.soilPh }
      );
    }

    if (criteria.organicCertified) {
      queryBuilder.andWhere('crop.organicSuitable = true');
    }

    return queryBuilder.getMany();
  }

  private async scoreCrops(crops: Crop[], criteria: any, farm: Farm | null): Promise<any[]> {
    const scoredCrops = [];

    for (const crop of crops) {
      const score = await this.calculateCropScore(crop, criteria, farm);
      const economicAnalysis = this.calculateEconomicAnalysis(crop, criteria);
      const riskAnalysis = this.calculateRiskAnalysis(crop, criteria, farm);

      scoredCrops.push({
        crop,
        score,
        economicAnalysis,
        riskAnalysis,
        suitabilityReasons: this.getSuitabilityReasons(crop, criteria),
      });
    }

    return scoredCrops.sort((a, b) => b.score - a.score);
  }

  private async calculateCropScore(crop: Crop, criteria: any, farm: Farm | null): Promise<number> {
    let score = 50; // Base score

    // Season match
    if (crop.season === criteria.season || crop.season === 'year-round') {
      score += 20;
    }

    // Soil type compatibility
    if (crop.suitableSoilTypes?.includes(criteria.soilType) || !crop.suitableSoilTypes) {
      score += 15;
    }

    // Soil pH compatibility
    if (criteria.soilPh && crop.idealSoilPhMin && crop.idealSoilPhMax) {
      if (criteria.soilPh >= crop.idealSoilPhMin && criteria.soilPh <= crop.idealSoilPhMax) {
        score += 15;
      } else {
        const phDeviation = Math.min(
          Math.abs(criteria.soilPh - crop.idealSoilPhMin),
          Math.abs(criteria.soilPh - crop.idealSoilPhMax)
        );
        score += Math.max(0, 15 - phDeviation * 5);
      }
    }

    // Organic suitability
    if (criteria.organicCertified && crop.organicSuitable) {
      score += 10;
    }

    // Cultivation difficulty (easier crops get higher scores for beginners)
    if (crop.cultivationDifficulty === 'easy') score += 8;
    else if (crop.cultivationDifficulty === 'moderate') score += 5;
    else if (crop.cultivationDifficulty === 'difficult') score -= 2;

    // Market price consideration
    if (crop.marketPricePerUnit && crop.marketPricePerUnit > 20) {
      score += 5;
    }

    // Growing period (shorter periods can be better for quick returns)
    if (crop.growingPeriodDays <= 90) score += 3;
    else if (crop.growingPeriodDays <= 120) score += 1;

    return Math.min(100, Math.max(0, score));
  }

  private calculateEconomicAnalysis(crop: Crop, criteria: any): any {
    const area = criteria.area || 1;
    const expectedYield = crop.expectedYieldPerAcre ? crop.expectedYieldPerAcre * area : 0;
    const marketPrice = crop.marketPricePerUnit || 0;
    const grossRevenue = expectedYield * marketPrice;

    // Estimated costs (simplified calculation)
    const seedCost = (crop.seedRatePerAcre || 0) * area * 50; // Assuming ₹50 per kg seed
    const laborCost = area * 5000; // ₹5000 per acre labor
    const inputCost = area * 3000; // ₹3000 per acre for inputs
    const totalCost = seedCost + laborCost + inputCost;

    const netProfit = grossRevenue - totalCost;
    const profitMargin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;
    const roi = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;

    return {
      area,
      areaUnit: criteria.areaUnit,
      expectedYield,
      yieldUnit: crop.yieldUnit,
      marketPrice,
      grossRevenue,
      totalCost: Math.round(totalCost),
      netProfit: Math.round(netProfit),
      profitMargin: Math.round(profitMargin * 100) / 100,
      roi: Math.round(roi * 100) / 100,
      breakEvenPrice: expectedYield > 0 ? Math.round((totalCost / expectedYield) * 100) / 100 : 0,
    };
  }

  private calculateRiskAnalysis(crop: Crop, criteria: any, farm: Farm | null): any {
    let riskScore = 50; // Base risk score (lower is better)

    // Weather dependency
    if (crop.waterRequirement === 'high') riskScore += 10;
    else if (crop.waterRequirement === 'low') riskScore -= 5;

    // Pest and disease risk
    const pestRisk = (crop.commonPests?.length || 0) * 2;
    const diseaseRisk = (crop.commonDiseases?.length || 0) * 2;
    riskScore += pestRisk + diseaseRisk;

    // Market price volatility (simplified)
    if (crop.category === 'vegetables') riskScore += 15; // High price volatility
    else if (crop.category === 'cereals') riskScore -= 5; // Stable prices

    // Cultivation difficulty risk
    if (crop.cultivationDifficulty === 'difficult') riskScore += 15;
    else if (crop.cultivationDifficulty === 'easy') riskScore -= 10;

    // Storage and perishability
    if (crop.category === 'fruits' || crop.category === 'vegetables') {
      riskScore += 10; // Perishable crops
    }

    riskScore = Math.min(100, Math.max(0, riskScore));

    let riskLevel = 'Medium';
    if (riskScore < 30) riskLevel = 'Low';
    else if (riskScore > 70) riskLevel = 'High';

    return {
      riskScore,
      riskLevel,
      factors: this.getRiskFactors(crop, riskScore),
      mitigationStrategies: this.getMitigationStrategies(crop),
    };
  }

  private getSuitabilityReasons(crop: Crop, criteria: any): string[] {
    const reasons = [];

    if (crop.season === criteria.season) {
      reasons.push(`Perfect for ${criteria.season} season`);
    }

    if (crop.suitableSoilTypes?.includes(criteria.soilType)) {
      reasons.push(`Well-suited for ${criteria.soilType} soil`);
    }

    if (criteria.organicCertified && crop.organicSuitable) {
      reasons.push('Excellent for organic farming');
    }

    if (crop.cultivationDifficulty === 'easy') {
      reasons.push('Easy to cultivate for beginners');
    }

    if (crop.expectedYieldPerAcre && crop.expectedYieldPerAcre > 2000) {
      reasons.push('High yield potential');
    }

    if (crop.marketPricePerUnit && crop.marketPricePerUnit > 25) {
      reasons.push('Good market price');
    }

    return reasons;
  }

  private getRiskFactors(crop: Crop, riskScore: number): string[] {
    const factors = [];

    if (crop.waterRequirement === 'high') {
      factors.push('High water dependency');
    }

    if (crop.commonPests && crop.commonPests.length > 3) {
      factors.push('Multiple pest threats');
    }

    if (crop.commonDiseases && crop.commonDiseases.length > 2) {
      factors.push('Disease susceptibility');
    }

    if (crop.cultivationDifficulty === 'difficult') {
      factors.push('Complex cultivation requirements');
    }

    if (crop.category === 'vegetables') {
      factors.push('Price volatility');
    }

    return factors;
  }

  private getMitigationStrategies(crop: Crop): string[] {
    const strategies = [];

    if (crop.waterRequirement === 'high') {
      strategies.push('Install drip irrigation system');
      strategies.push('Mulching to retain moisture');
    }

    if (crop.commonPests && crop.commonPests.length > 0) {
      strategies.push('Integrated pest management');
      strategies.push('Regular monitoring and scouting');
    }

    if (crop.cultivationDifficulty === 'difficult') {
      strategies.push('Seek expert guidance');
      strategies.push('Start with smaller area');
    }

    strategies.push('Weather-based crop insurance');
    strategies.push('Diversify with multiple crops');

    return strategies;
  }

  private formatRecommendations(scoredCrops: any[], criteria: any): any[] {
    return scoredCrops.map((item, index) => ({
      rank: index + 1,
      crop: {
        id: item.crop.id,
        name: item.crop.name,
        scientificName: item.crop.scientificName,
        category: item.crop.category,
        season: item.crop.season,
        growingPeriodDays: item.crop.growingPeriodDays,
        cultivationDifficulty: item.crop.cultivationDifficulty,
        organicSuitable: item.crop.organicSuitable,
        cropImageUrl: item.crop.cropImageUrl,
      },
      suitabilityScore: Math.round(item.score),
      suitabilityGrade: this.getGrade(item.score),
      suitabilityReasons: item.suitabilityReasons,
      economicAnalysis: item.economicAnalysis,
      riskAnalysis: item.riskAnalysis,
      recommendedArea: Math.min(criteria.area * 0.3, 2), // Start with 30% of total area or 2 acres, whichever is smaller
      bestPractices: item.crop.cultivationTips || [],
      companionCrops: item.crop.companionCrops || [],
    }));
  }

  private getGrade(score: number): string {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B+';
    if (score >= 60) return 'B';
    if (score >= 50) return 'C+';
    if (score >= 40) return 'C';
    return 'D';
  }
}