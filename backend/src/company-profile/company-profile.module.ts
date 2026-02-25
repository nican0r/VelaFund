import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { CompanyProfileController } from './company-profile.controller';
import { PublicProfileController } from './public-profile.controller';
import { ProfileDocumentController, PublicDocumentController } from './profile-document.controller';
import { CompanyProfileService } from './company-profile.service';
import { ProfileDocumentService } from './profile-document.service';

@Module({
  imports: [
    MulterModule.register({
      limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB for document uploads
    }),
  ],
  controllers: [
    CompanyProfileController,
    PublicProfileController,
    ProfileDocumentController,
    PublicDocumentController,
  ],
  providers: [CompanyProfileService, ProfileDocumentService],
  exports: [CompanyProfileService, ProfileDocumentService],
})
export class CompanyProfileModule {}
