import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { CompanyProfileController } from './company-profile.controller';
import { PublicProfileController } from './public-profile.controller';
import { CompanyProfileService } from './company-profile.service';

@Module({
  imports: [
    MulterModule.register({
      limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB for team photos
    }),
  ],
  controllers: [CompanyProfileController, PublicProfileController],
  providers: [CompanyProfileService],
  exports: [CompanyProfileService],
})
export class CompanyProfileModule {}
