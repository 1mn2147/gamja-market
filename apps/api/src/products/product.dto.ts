import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';

const pricePattern = /^\d+$/;

export class ProductImageDto {
  @IsString()
  @MaxLength(7_000_000)
  dataBase64!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  altText!: string;
}

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2_000)
  description!: string;

  @IsString()
  @Matches(pricePattern)
  priceKrw!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  category!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => ProductImageDto)
  images!: ProductImageDto[];
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2_000)
  description?: string;

  @IsOptional()
  @IsString()
  @Matches(pricePattern)
  priceKrw?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  category?: string;
}

export class ProductStatusDto {
  @IsIn(['ACTIVE', 'HIDDEN'])
  status!: 'ACTIVE' | 'HIDDEN';
}

export class ProductQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  query?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @IsOptional()
  @Matches(pricePattern)
  minPrice?: string;

  @IsOptional()
  @Matches(pricePattern)
  maxPrice?: string;

  @IsOptional()
  @IsIn(['latest', 'price_asc', 'price_desc'])
  sort?: 'latest' | 'price_asc' | 'price_desc';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsIn([10, 20, 30])
  limit?: 10 | 20 | 30;
}
