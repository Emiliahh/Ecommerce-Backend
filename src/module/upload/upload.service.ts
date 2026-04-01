import { Injectable, BadRequestException } from '@nestjs/common';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';

@Injectable()
export class UploadService {
  private readonly uploadPath = join(__dirname, '..', '..', '..', 'uploads');

  constructor() {
    this.ensureUploadPathExists();
  }

  private ensureUploadPathExists() {
    if (!existsSync(this.uploadPath)) {
      mkdirSync(this.uploadPath, { recursive: true });
    }
  }

  async uploadFile(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const fileExt = extname(file.originalname);
    const fileName = `${randomUUID()}${fileExt}`;
    const filePath = join(this.uploadPath, fileName);

    try {
      writeFileSync(filePath, file.buffer);
      return {
        url: `/uploads/${fileName}`,
        fileName: fileName,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      };
    } catch (error) {
      throw new BadRequestException('Failed to upload file');
    }
  }

  async uploadFiles(files: Express.Multer.File[], ids?: string[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    const results = await Promise.all(
      files.map(async (file, index) => {
        const uploadResult = await this.uploadFile(file);
        return {
          ...uploadResult,
          clientId: ids && ids[index] ? ids[index] : undefined,
        };
      }),
    );

    return results;
  }

  async deleteFile(fileName: string) {
    if (!fileName) {
      throw new BadRequestException('Filename is required');
    }

    // Security: ensure the filename doesn't contain path traversal characters
    const safeFileName = fileName.replace(/^.*[\\\/]/, '');
    const filePath = join(this.uploadPath, safeFileName);

    if (existsSync(filePath)) {
      try {
        require('fs').unlinkSync(filePath);
        return { message: 'File deleted successfully' };
      } catch (error) {
        throw new BadRequestException('Failed to delete file');
      }
    } else {
      throw new BadRequestException('File not found');
    }
  }

  async deleteFiles(fileNames: string[]) {
    if (!fileNames || fileNames.length === 0) {
      throw new BadRequestException('Filenames are required');
    }

    const results = await Promise.all(
      fileNames.map(async (name) => {
        try {
          return await this.deleteFile(name);
        } catch (error) {
          return { fileName: name, error: error.message };
        }
      }),
    );

    return results;
  }
}
