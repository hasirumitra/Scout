import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class UpdatePriceDto {
  @ApiProperty({
    description: 'New market price per unit',
    example: 28.75,
  })
  @IsNumber()
  @Min(0)
  price: number;
}