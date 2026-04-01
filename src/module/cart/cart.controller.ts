import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiResponse,
} from '@nestjs/swagger';
import { CartService } from './cart.service';
import { CurrentUser } from 'src/decorator/user';
import { AddCartDto } from './dto/add-cart';
import { GetCartResponseDto } from './dto/get-cart.dto';

@ApiTags('Cart')
@ApiBearerAuth()
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user cart' })
  @ApiResponse({
    status: 200,
    description: 'Return user cart items',
    type: GetCartResponseDto,
    isArray: true,
  })
  async getMyCart(@CurrentUser('userId') userId: string) {
    return this.cartService.getUserCart(userId);
  }

  @Post('')
  @ApiOperation({ summary: 'Add or update item in cart' })
  @ApiResponse({
    status: 201,
    description: 'Return updated user cart items',
    type: GetCartResponseDto,
    isArray: true,
  })
  async addToCart(
    @CurrentUser('userId') userId: string,
    @Body() dto: AddCartDto,
  ) {
    return this.cartService.updateCart(userId, dto);
  }

  @Delete(':variantId')
  @ApiOperation({ summary: 'Remove a specific variant from the cart' })
  @ApiResponse({
    status: 200,
    description: 'Return updated user cart items',
    type: GetCartResponseDto,
    isArray: true,
  })
  async removeFromCart(
    @CurrentUser('userId') userId: string,
    @Param('variantId') variantId: string,
  ) {
    return this.cartService.removeCart(userId, variantId);
  }
}
