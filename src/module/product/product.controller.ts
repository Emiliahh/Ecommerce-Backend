import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductService } from './product.service';
import GetProductResponseDto, {
  PaginatedGetProductListResponseDto,
  ProductQueryDto,
} from './dto/get-product.dto';
import { RoleGuard } from 'src/guard/role.guard';
import { Public } from 'src/decorator/isPublic';
import { UpdateProductDto } from './dto/update-product.dto';
import { Roles } from 'src/decorator/role';

@ApiTags('Product')
@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  @Roles('admin', 'superadmin')
  @Public()
  @UseGuards(RoleGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new product with variants and images' })
  async create(@Body() createProductDto: CreateProductDto) {
    return this.productService.create(createProductDto);
  }

  @Post('all')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all products',
    description: 'Get all products with pagination and filtering',
  })
  @ApiResponse({ status: 200, type: PaginatedGetProductListResponseDto })
  async getAllProduct(@Body() query: ProductQueryDto) {
    return this.productService.getAllProduct(query);
  }
  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get product by ID or slug' })
  @ApiResponse({ status: 200, type: GetProductResponseDto })
  async getProduct(@Param('id') id: string) {
    return this.productService.getProduct(id);
  }

  @Patch(':id')
  @Roles('admin', 'superadmin')
  @Public()
  @UseGuards(RoleGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update product by ID' })
  async updateProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdateProductDto,
  ) {
    return this.productService.updateProductTransaction(id, data);
  }
}
