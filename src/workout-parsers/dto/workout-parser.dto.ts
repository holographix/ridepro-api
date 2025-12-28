import { IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';

export class ParseWorkoutDto {
  @IsString()
  content: string;

  @IsString()
  filename: string;

  @IsOptional()
  @IsNumber()
  @Min(100)
  @Max(500)
  ftp?: number;
}

export class ImportWorkoutDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsNumber()
  @Min(100)
  @Max(500)
  ftp?: number;
}
