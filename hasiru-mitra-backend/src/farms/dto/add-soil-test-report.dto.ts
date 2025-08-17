import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsString, IsObject, IsUrl, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class NutrientLevelsDto {
  @ApiProperty({ description: 'Nitrogen level (ppm)', example: 250 })
  nitrogen?: number;

  @ApiProperty({ description: 'Phosphorus level (ppm)', example: 35 })
  phosphorus?: number;

  @ApiProperty({ description: 'Potassium level (ppm)', example: 180 })
  potassium?: number;

  @ApiProperty({ description: 'Organic carbon percentage', example: 1.2 })
  organicCarbon?: number;

  @ApiProperty({ description: 'pH level', example: 6.8 })
  ph?: number;

  @ApiProperty({ description: 'Electrical conductivity (dS/m)', example: 0.45 })
  electricalConductivity?: number;

  @ApiProperty({ description: 'Zinc level (ppm)', example: 1.8 })
  zinc?: number;

  @ApiProperty({ description: 'Iron level (ppm)', example: 12.5 })
  iron?: number;

  @ApiProperty({ description: 'Manganese level (ppm)', example: 8.2 })
  manganese?: number;

  @ApiProperty({ description: 'Copper level (ppm)', example: 2.1 })
  copper?: number;

  @ApiProperty({ description: 'Boron level (ppm)', example: 0.8 })
  boron?: number;

  @ApiProperty({ description: 'Sulphur level (ppm)', example: 15.5 })
  sulphur?: number;
}

export class AddSoilTestReportDto {
  @ApiProperty({
    description: 'Date of soil test',
    example: '2024-03-15',
  })
  @IsDateString()
  date: Date;

  @ApiProperty({
    description: 'URL to the soil test report document',
    example: 'https://example.com/reports/soil-test-123.pdf',
  })
  @IsUrl()
  reportUrl: string;

  @ApiProperty({
    description: 'Nutrient levels and soil properties',
    type: NutrientLevelsDto,
  })
  @ValidateNested()
  @Type(() => NutrientLevelsDto)
  nutrientLevels: Record<string, number>;
}