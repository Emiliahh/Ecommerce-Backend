import { Injectable } from '@nestjs/common';
import {
  v2 as cloudinary,
  UploadApiResponse,
  UploadApiErrorResponse,
  UploadApiOptions,
} from 'cloudinary';
import * as streamifier from 'streamifier';

@Injectable()
export class CloudinaryService {
  uploadFile(file: Express.Multer.File): Promise<UploadApiResponse> {
    // 1. We specify ONLY the success type in the Promise generic
    return new Promise<UploadApiResponse>((resolve, reject) => {
      const uploadOption: UploadApiOptions = {
        folder: 'ecommerce',
        quality: 'auto',
        fetch_format: 'auto',
        width: 1080,
        crop: 'limit',
      };
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOption,
        (error: UploadApiErrorResponse, result: UploadApiResponse) => {
          if (error) return reject(error as Error);

          if (!result) {
            return reject(
              new Error('Cloudinary upload failed: No result returned'),
            );
          }

          // 3. Resolve matches the Promise<UploadApiResponse>
          resolve(result);
        },
      );
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }
  async uploadFiles(files: Express.Multer.File[], ids: string[] = []) {
    if (!files || files.length === 0) {
      return [];
    }

    const uploadPromises = files.map(async (file, index) => {
      const uploadResult = await this.uploadFile(file);
      return {
        public_id: uploadResult.public_id,
        width: uploadResult.width,
        height: uploadResult.height,
        format: uploadResult.format,
        bytes: uploadResult.bytes,
        url: uploadResult.url,
        secure_url: uploadResult.secure_url,
        clientId: ids[index] || undefined,
      };
    });

    return Promise.all(uploadPromises);
  }
  async deleteFile(publicId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .destroy(publicId, (error, result) => {
          if (error) return reject(error as Error);
          resolve(result);
        })
        .catch((err) => reject(err as Error));
    });
  }
  async deleteFiles(publicIds: string[]): Promise<any> {
    if (!publicIds || publicIds.length === 0) {
      return [];
    }

    return new Promise((resolve, reject) => {
      cloudinary.api
        .delete_resources(publicIds, (error, result) => {
          if (error) return reject(error as Error);
          resolve(result);
        })
        .catch((err) => reject(err as Error));
    });
  }
}
