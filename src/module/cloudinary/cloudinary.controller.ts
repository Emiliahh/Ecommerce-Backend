import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  HttpStatus,
  ParseFilePipeBuilder,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { CloudinaryService } from './cloudinary.service';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from 'src/decorator/isPublic';

@ApiTags('Cloudinary')
@Controller('cloudinary')
export class CloudinaryController {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  // --- UPLOAD SINGLE ---
  @Post('upload')
  @Public()
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a single image' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  uploadImage(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /(jpg|jpeg|png|webp)$/,
        })
        .addMaxSizeValidator({
          maxSize: 1024 * 1024 * 20,
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        }),
    )
    file: Express.Multer.File,
  ) {
    return this.cloudinaryService.uploadFile(file);
  }

  @Post('uploads')
  @Public()
  @UseInterceptors(FilesInterceptor('file', 5))
  @ApiOperation({ summary: 'Upload multiple images (max 5)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        'file[]': {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Chọn tối đa 5 file ảnh',
        },
        ids: {
          type: 'array',
          items: {
            type: 'string',
          },
          description:
            'Mảng các ID tương ứng với từng file (Tùy chọn, gửi nhiều ID bằng cách add thêm item)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Upload thành công, trả về mảng thông tin ảnh đã được lọc',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          public_id: {
            type: 'string',
            example: 'ecommerce/kkggaiywy5u5h7ybckzd',
          },
          width: { type: 'number', example: 528 },
          height: { type: 'number', example: 528 },
          format: { type: 'string', example: 'jpg' },
          bytes: { type: 'number', example: 40102 },
          url: { type: 'string', example: 'http://res.cloudinary.com/...' },
          secure_url: {
            type: 'string',
            example: 'https://res.cloudinary.com/...',
          },
          clientId: { type: 'string', example: '1' }, // ID giả từ client
        },
      },
    },
  })
  uploadImages(
    @UploadedFiles(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /(jpg|jpeg|png|webp)$/,
        })
        .addMaxSizeValidator({
          maxSize: 1024 * 1024 * 5,
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        }),
    )
    files: Express.Multer.File[],
    @Body('ids') ids?: string | string[],
  ) {
    const idArray = Array.isArray(ids) ? ids : ids ? [ids] : [];
    return this.cloudinaryService.uploadFiles(files, idArray);
  }

  @Delete('delete')
  @ApiOperation({ summary: 'Delete a single image from Cloudinary' })
  @ApiQuery({
    name: 'publicId',
    description: 'The Cloudinary public_id of the image to delete',
    example: 'my_uploads/abc123xyz',
    required: true,
  })
  deleteImage(@Query('publicId') publicId: string) {
    if (!publicId) {
      throw new BadRequestException('publicId query parameter is required');
    }
    return this.cloudinaryService.deleteFile(publicId);
  }

  @Delete('delete-multiple')
  @ApiOperation({ summary: 'Delete multiple images from Cloudinary' })
  @ApiBody({
    description: 'Array of Cloudinary public_ids to delete',
    schema: {
      type: 'object',
      properties: {
        publicIds: {
          type: 'array',
          items: {
            type: 'string',
          },
          example: ['my_uploads/img1', 'my_uploads/img2'],
        },
      },
    },
  })
  deleteImages(@Body('publicIds') publicIds: string[]) {
    if (!publicIds || !Array.isArray(publicIds) || publicIds.length === 0) {
      throw new BadRequestException(
        'An array of publicIds is required in the body',
      );
    }
    return this.cloudinaryService.deleteFiles(publicIds);
  }
}
