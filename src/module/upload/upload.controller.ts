import {
  Controller,
  Post,
  Delete,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  Body,
  Query,
  HttpStatus,
  ParseFilePipeBuilder,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiResponse,
} from '@nestjs/swagger';
import { UploadService } from './upload.service';
import { Public } from 'src/decorator/isPublic';

@ApiTags('Upload')
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('local')
  @Public()
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a single file to local storage' })
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
  async uploadLocal(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /(jpg|jpeg|png|webp|pdf|docx|txt)$/,
        })
        .addMaxSizeValidator({
          maxSize: 1024 * 1024 * 20, // 20MB
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        }),
    )
    file: Express.Multer.File,
  ) {
    return this.uploadService.uploadFile(file);
  }

  @Post('local-multiple')
  @Public()
  @UseInterceptors(FilesInterceptor('file', 10))
  @ApiOperation({ summary: 'Upload multiple files to local storage' })
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
        },
        ids: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Upload successful' })
  async uploadLocalMultiple(
    @UploadedFiles(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /(jpg|jpeg|png|webp|pdf|docx|txt)$/,
        })
        .addMaxSizeValidator({
          maxSize: 1024 * 1024 * 5, // 5MB per file
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        }),
    )
    files: Express.Multer.File[],
    @Body('ids') ids?: string | string[],
  ) {
    const idArray = Array.isArray(ids) ? ids : ids ? [ids] : [];
    return this.uploadService.uploadFiles(files, idArray);
  }

  @Delete('local')
  @Public()
  @ApiOperation({ summary: 'Delete a single file from local storage' })
  @ApiQuery({
    name: 'fileName',
    description: 'The filename of the file to delete (e.g., d540...png)',
    example: 'd5403061-0d32-443b-8212-0738e4dfd540.png',
    required: true,
  })
  async deleteLocal(@Query('fileName') fileName: string) {
    return this.uploadService.deleteFile(fileName);
  }

  @Post('local/delete-multiple')
  @Public()
  @ApiOperation({ summary: 'Delete multiple files from local storage' })
  @ApiBody({
    description: 'Array of filenames to delete from local storage',
    schema: {
      type: 'object',
      properties: {
        fileNames: {
          type: 'array',
          items: {
            type: 'string',
          },
          example: ['img1.png', 'img2.jpg'],
        },
      },
    },
  })
  async deleteLocalMultiple(@Body('fileNames') fileNames: string[]) {
    return this.uploadService.deleteFiles(fileNames);
  }
}
