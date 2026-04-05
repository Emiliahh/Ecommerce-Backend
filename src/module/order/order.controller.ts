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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBody,
  ApiOkResponse,
} from '@nestjs/swagger';
import { Observable, filter } from 'rxjs';
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
  constructor(private readonly orderService: OrderService) {}

  @Sse('sse')
  @Roles('customer', 'admin', 'superadmin')
  @UseGuards(RoleGuard)
  @ApiOperation({ summary: 'SSE stream for order events' })
  orderEvents(@CurrentUser() user: any): Observable<any> {
    const isAdmin = user.role === 'admin' || user.role === 'superadmin';
    return this.orderService.orderEvents$.asObservable().pipe(
      // Ensure users only see events for their own orders unless they are an admin
      filter((event: any) => {
        if (isAdmin) return true;
        // Check if the event data belongs to the user
        // Assuming your event.data contains the updated order object
        return event.data?.order?.userId === user.userId;
      }),
    );
  }

  @Get('')
  @Roles('customer', 'admin', 'superadmin')
  @UseGuards(RoleGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all order' })
  @ApiOkResponse({ type: PaginatedGetOrderResponseDto })
  async getAllOrder(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
    @Query() query: GetOrderQueryDto,
  ) {
    const isAdmin = role === 'admin' || role === 'superadmin';
    return this.orderService.getAllOrder(isAdmin ? undefined : userId, query);
  }

  @Get(':id')
  @Roles('customer', 'admin', 'superadmin')
  @UseGuards(RoleGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get order by id' })
  @ApiOkResponse({ type: GetOrderResponseDto })
  async getOrderById(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as JwtPayload & { role: string };
    const isAdmin = user.role === 'admin' || user.role === 'superadmin';
    const userId = isAdmin ? undefined : user.sub;

    return this.orderService.getOrderById(id, userId);
  }

  @Post('')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new order' })
  async createOrder(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateOrderDto,
  ) {
    console.log(userId);
    return this.orderService.createOrder(userId, dto);
  }

  @Patch(':id')
  @Roles('admin', 'superadmin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an order (Admin Only)' })
  @ApiBody({ type: UpdateOrderDto })
  @ApiOkResponse({ type: GetOrderResponseDto })
  async updateOrder(@Param('id') id: string, @Body() dto: UpdateOrderDto) {
    return this.orderService.updateOrder(id, dto);
  }
  // customer cancel endpoint
  @Patch(':id/cancel')
  @Roles('customer')
  @ApiBearerAuth()
  @ApiOkResponse({ type: GetOrderResponseDto })
  async cancelOrder(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.orderService.updateOrder(id, {
      status: 'cancelled',
      note: 'Customer cancelled',
    });
  }
}
