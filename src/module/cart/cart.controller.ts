import { Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import PaginateDTO from 'src/common/dto/paginate.dto';
@ApiTags('Cart')
@Controller('cart')
export class CartController {
    @Get('')
    @ApiOperation({ summary: 'Get all cart item' })
    async getAllCartItem(@Query() query: PaginateDTO) {
    }
    @Get('me')
    @ApiOperation({ summary: 'Get all cart item for user' })
    async getAllCartItemMe() {
    }
    @Post('')
    @ApiOperation({ summary: 'Create a new cart item' })
    async createCartItem() {
    }
    @Put(':id')
    @ApiOperation({ summary: 'Update a category' })
    async updateCategory() {
    }
    @Delete(':id')
    @ApiOperation({ summary: 'Delete a category' })
    async deleteCategory() {
    }
}
