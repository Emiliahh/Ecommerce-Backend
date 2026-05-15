import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiOkResponse,
} from '@nestjs/swagger';
import { ImportService } from './import.service';
import { RoleGuard } from 'src/guard/role.guard';
import { Roles } from 'src/decorator/role';
import {
  GetImportDetailResponseDto,
  GetImportQueryDto,
  PaginatedGetImportResponseDto,
} from './dto/get-import.dto';
import { CreateImportWithItemsDto } from './dto/create-import.dto';
import { UpdateImportWithItemsDto } from './dto/update-import.dto';

@ApiTags('Import')
@Controller('import')
export class ImportController {
  constructor(private readonly importService: ImportService) { }

  @Get('')
  @Roles('admin', 'superadmin')
  @UseGuards(RoleGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all import orders (Admin Only)' })
  @ApiOkResponse({ type: PaginatedGetImportResponseDto })
  async getImports(@Query() query: GetImportQueryDto) {
    return this.importService.getImports(query);
  }

  @Get(':id')
  @Roles('admin', 'superadmin')
  @UseGuards(RoleGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get import order by id (Admin Only)' })
  @ApiOkResponse({ type: GetImportDetailResponseDto })
  async getImportById(@Param('id') id: string) {
    return this.importService.getImportById(id);
  }

  @Post('')
  @Roles('admin', 'superadmin')
  @UseGuards(RoleGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new import order with items (Admin Only)' })
  async createImport(@Body() dto: CreateImportWithItemsDto) {
    return this.importService.createImportWithItems(dto);
  }

  @Patch(':id')
  @Roles('admin', 'superadmin')
  @UseGuards(RoleGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an import order and its items (Admin Only)' })
  async updateImport(
    @Param('id') id: string,
    @Body() dto: UpdateImportWithItemsDto,
  ) {
    return this.importService.updateImportWithItems(id, dto);
  }

  @Patch(':id/status')
  @Roles('admin', 'superadmin')
  @UseGuards(RoleGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update import order status (Admin Only)' })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.importService.updateStatus(id, status);
  }
}
