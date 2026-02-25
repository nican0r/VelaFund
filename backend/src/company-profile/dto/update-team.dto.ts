import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  ValidateNested,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TeamMemberItemDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsString()
  @MaxLength(100)
  title: string;

  @IsOptional()
  @IsUrl()
  photoUrl?: string;

  @IsOptional()
  @IsString()
  @Matches(/^https:\/\/(www\.)?linkedin\.com\//, {
    message: 'LinkedIn URL must start with https://linkedin.com/ or https://www.linkedin.com/',
  })
  linkedinUrl?: string;

  @Type(() => Number)
  @IsInt()
  order: number;
}

export class UpdateTeamDto {
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMaxSize(10)
  @Type(() => TeamMemberItemDto)
  teamMembers: TeamMemberItemDto[];
}
