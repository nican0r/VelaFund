import { IsString, Matches, MinLength, MaxLength } from 'class-validator';

export class UpdateSlugDto {
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'Slug must be lowercase alphanumeric with hyphens, no leading/trailing hyphens',
  })
  slug: string;
}
