// cloudinary.provider.ts

import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { EnvConfig } from 'src/env.validation';

export const CloudinaryProvider = {
  provide: 'CLOUDINARY',
  inject: [ConfigService],
  useFactory: (configService: ConfigService<EnvConfig>) => {
    return cloudinary.config({
      cloud_name: configService.get('CLOUDINARY_NAME'),
      api_key: configService.get('CLOUDINARY_API_KEY'),
      api_secret: configService.get('CLOUDINARY_API_SECRET'),
    });
  },
};
