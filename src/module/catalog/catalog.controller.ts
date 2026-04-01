import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  AttributeGroupResponseDto,
  CategoryWithAttributeGroupsDto,
} from './dto/get-attribute.dto';
import {
  GetCategoryFilterDto,
  GetCategoryFilterResponseDto,
} from './dto/get-category-filter.dto';
import { CatalogService } from './catalog.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import UpdateCategoryDto from './dto/update-category.dto';
import {
  CreateAttributeGroupDto,
  UpdateAttributeGroupDto,
  CreateAttributeDto,
  UpdateAttributeDto,
  CreateAttributeOptionDto,
  UpdateAttributeOptionDto,
} from './dto/attribute.dto';
import { Roles } from 'src/decorator/role';
import { eq } from 'drizzle-orm';
import { RoleGuard } from 'src/guard/role.guard';
import { Public } from 'src/decorator/isPublic';
import {
  GetCategoryDetailResponseDto,
  PaginatedCategoryListResponseDto,
  CategoryTreeResponseDto,
} from './dto/get-categort.dto';
@ApiTags('Category')
@Controller('category')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}
  @Get('')
  @Public()
  @ApiOperation({ summary: 'Get all categories' })
  @ApiResponse({ type: PaginatedCategoryListResponseDto, status: 200 })
  async getAllCategory(@Query() filter: GetCategoryFilterDto) {
    return await this.catalogService.getAllCategory(filter);
  }

  @Get('tree')
  @Public()
  @ApiOperation({ summary: 'Get category tree' })
  @ApiResponse({ type: [CategoryTreeResponseDto], status: 200 })
  async getCategoryTree() {
    return await this.catalogService.buildTree();
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get category detail by ID' })
  @ApiOkResponse({ type: GetCategoryDetailResponseDto })
  async getCategoryDetail(@Param('id', ParseUUIDPipe) id: string) {
    return await this.catalogService.getCategoryDetail(id);
  }
  @Get('filter/:slug')
  @Public()
  @ApiOperation({ summary: 'Get the list of filterable for categoryPage' })
  @ApiOkResponse({ type: GetCategoryFilterResponseDto })
  async getCategoryDetailBySlug(@Param('slug') slug: string) {
    return await this.catalogService.getCategoryFilter(slug);
  }

  @Post('')
  // @Roles('admin', 'superadmin')
  @Public()
  @UseGuards(RoleGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new category' })
  async createCategory(@Body() createCategoryDto: CreateCategoryDto) {
    try {
      return await this.catalogService.createCategory(createCategoryDto);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
  @Put(':id')
  // @Roles('admin', 'superadmin')
  @Public()
  @UseGuards(RoleGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a category' })
  async updateCategory(
    @Body() updateCategoryDto: UpdateCategoryDto,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    try {
      return await this.catalogService.updateCategory(updateCategoryDto, id);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
  @Delete(':id')
  @Roles('admin', 'superadmin')
  @UseGuards(RoleGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a category' })
  async deleteCategory(@Param('id', ParseUUIDPipe) id: string) {
    try {
      return await this.catalogService.deleteCategory(id);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
  @Get('attribute/:id')
  @Public()
  @ApiOperation({ summary: 'Get category and its attributes for filter' })
  @ApiOkResponse({ type: CategoryWithAttributeGroupsDto })
  async getCategoryFilter(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CategoryWithAttributeGroupsDto | undefined> {
    try {
      return await this.catalogService.getAttribute(id);
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
  @Post(':categoryId/attribute-groups')
  // @Roles('admin', 'superadmin')
  @Public()
  @UseGuards(RoleGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create attribute group for category' })
  async createAttributeGroup(
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() dto: CreateAttributeGroupDto,
  ) {
    return await this.catalogService.createAttributeGroup(categoryId, dto);
  }

  @Put('attribute-groups/:id')
  // @Roles('admin', 'superadmin')
  @Public()
  @UseGuards(RoleGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update attribute group' })
  async updateAttributeGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAttributeGroupDto,
  ) {
    return await this.catalogService.updateAttributeGroup(id, dto);
  }

  @Delete('attribute-groups/:id')
  // @Roles('admin', 'superadmin')
  @Public()
  @UseGuards(RoleGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete attribute group' })
  async deleteAttributeGroup(@Param('id', ParseUUIDPipe) id: string) {
    return await this.catalogService.deleteAttributeGroup(id);
  }
  @Post('attribute-groups/:groupId/attributes')
  // @Roles('admin', 'superadmin')
  @Public()
  @UseGuards(RoleGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create attribute for group' })
  async createAttribute(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: CreateAttributeDto,
  ) {
    return await this.catalogService.createAttribute(groupId, dto);
  }

  @Put('attributes/:id')
  // @Roles('admin', 'superadmin')
  @Public()
  @UseGuards(RoleGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update attribute' })
  async updateAttribute(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAttributeDto,
  ) {
    return await this.catalogService.updateAttribute(id, dto);
  }

  @Delete('attributes/:id')
  // @Roles('admin', 'superadmin')
  @Public()
  @UseGuards(RoleGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete attribute' })
  async deleteAttribute(@Param('id', ParseUUIDPipe) id: string) {
    return await this.catalogService.deleteAttribute(id);
  }

  @Post('attributes/:attributeId/options')
  // @Roles('admin', 'superadmin')
  @Public()
  @UseGuards(RoleGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create attribute option' })
  async createAttributeOption(
    @Param('attributeId', ParseUUIDPipe) attributeId: string,
    @Body() dto: CreateAttributeOptionDto,
  ) {
    return await this.catalogService.createAttributeOption(attributeId, dto);
  }

  @Put('attribute-options/:id')
  // @Roles('admin', 'superadmin')
  @Public()
  @UseGuards(RoleGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update attribute option' })
  async updateAttributeOption(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAttributeOptionDto,
  ) {
    return await this.catalogService.updateAttributeOption(id, dto);
  }

  @Delete('attribute-options/:id')
  // @Roles('admin', 'superadmin')
  @Public()
  @UseGuards(RoleGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete attribute option' })
  async deleteAttributeOption(@Param('id', ParseUUIDPipe) id: string) {
    return await this.catalogService.deleteAttributeOption(id);
  }
}
