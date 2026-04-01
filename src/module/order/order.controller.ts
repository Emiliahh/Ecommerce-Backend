import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import PaginateDTO from 'src/common/dto/paginate.dto';
@ApiTags('Order')
@Controller('order')
export class OrderController {
    @Get('')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get all order' })
    async getAllOrder(@Query() query: PaginateDTO) {
        // get order of me
    }
    @Get(':id')
    @ApiOperation({ summary: 'Get order by id' })
    async getOrderById(@Param('id') id: string) {
    }
    @Post('')
    @ApiOperation({ summary: 'Create a new order' })
    async createOrder() {
    }
}
