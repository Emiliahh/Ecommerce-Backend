import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import PaginateDTO from 'src/common/dto/paginate.dto';
import {
  GetOrderQueryDto,
  PaginatedGetOrderResponseDto,
  GetOrderResponseDto,
} from './dto/get-order.dto';
import { RoleGuard } from 'src/guard/role.guard';
import type { Request } from 'express';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { JwtPayload } from 'src/types/IJwtPayload';
import { Roles } from 'src/decorator/role';
import { CurrentUser } from 'src/decorator/user';

@ApiTags('Order')
@Controller('order')
export class OrderController {
  constructor(private readonly orderService: OrderService) { }

  @Sse('sse')
  @Roles('admin', 'superadmin')
  @ApiOperation({ summary: 'SSE stream for order events (Admin dashboard)' })
  orderEvents(): Observable<any> {
    return this.orderService.orderEvents$.asObservable();
  }

  @Get('')
  @Roles('customer', 'admin', 'superadmin')
  @UseGuards(RoleGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all order' })
  @ApiResponse({ type: PaginatedGetOrderResponseDto })
  async getAllOrder(@Req() req: Request, @Query() query: GetOrderQueryDto) {
    const user = req.user as JwtPayload & { role: string };
    const isAdmin = user.role === 'admin' || user.role === 'superadmin';
    const userId = isAdmin ? query.userId : user.sub;

    return this.orderService.getAllOrder(userId, query);
  }

  @Get(':id')
  @Roles('customer', 'admin', 'superadmin')
  @UseGuards(RoleGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get order by id' })
  @ApiResponse({ type: GetOrderResponseDto })
  async getOrderById(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as JwtPayload & { role: string };
    const isAdmin = user.role === 'admin' || user.role === 'superadmin';
    const userId = isAdmin ? undefined : user.sub;

    return this.orderService.getOrderById(id, userId);
  }

  @Post('')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new order' })
  async createOrder(@Req() req: Request, @Body() dto: CreateOrderDto) {
    const user = req.user as JwtPayload;
    return this.orderService.createOrder(user.sub, dto);
  }

  @Patch(':id')
  @Roles('admin', 'superadmin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an order (Admin Only)' })
  async updateOrder(@Param('id') id: string, @Body() dto: UpdateOrderDto) {
    return this.orderService.updateOrder(id, dto);
  }
  // customer cancel endpoint
  @Patch(':id/cancel')
  @Roles('customer')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel an order (Customer Only)' })
  async cancelOrder(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.orderService.updateOrder(id, { status: 'cancelled', note: 'Customer cancelled' });
  }
}
