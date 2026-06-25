import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateMatchPreferencesDto {
  @IsOptional()
  @IsInt()
  @Min(18)
  @Max(90)
  minAge?: number;

  @IsOptional()
  @IsInt()
  @Min(18)
  @Max(90)
  maxAge?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredProvinces?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredCities?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredReligions?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredCastes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredEducationKeywords?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredOccupationKeywords?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredInterests?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredHobbies?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredMaritalStatuses?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dealBreakers?: string[];
}
