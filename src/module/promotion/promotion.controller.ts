import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiOkResponse } from '@nestjs/swagger';
import { PromotionService } from './promotion.service';
import { RoleGuard } from 'src/guard/role.guard';
import { Roles } from 'src/decorator/role';

// ── Event Group DTOs ─────────────────────────────────────────────
import {
  CreateEventGroupDto,
  UpdateEventGroupDto,
  GetEventGroupQueryDto,
  PaginatedEventGroupResponseDto,
  GetEventGroupResponseDto,
} from './dto/event-group.dto';

import {
  CreateDiscountEventDto,
  UpdateDiscountEventDto,
  GetDiscountEventQueryDto,
  PaginatedDiscountEventResponseDto,
  GetDiscountEventResponseDto,
} from './dto/discount-event.dto';

import {
  AddProductToEventDto,
  UpdateEventProductDto,
  GetEventProductResponseDto,
} from './dto/event-product.dto';
import {
  CreatePromoCodeDto,
  UpdatePromoCodeDto,
  GetPromoCodeQueryDto,
  PaginatedPromoCodeResponseDto,
  GetPromoCodeResponseDto,
} from './dto/promo-code.dto';
import { Public } from 'src/decorator/isPublic';

@ApiTags('Promotion')
@Controller('promotion')
export class PromotionController {
  constructor(private readonly promotionService: PromotionService) { }
  @Get('event-groups')
  @Public()
  @ApiOperation({ summary: 'List all event groups (paginated)' })
  @ApiOkResponse({ type: PaginatedEventGroupResponseDto })
  getEventGroups(@Query() query: GetEventGroupQueryDto) {
    return this.promotionService.getEventGroups(query);
  }

  @Get('event-groups/:id')
  @Public()
  @ApiOperation({ summary: 'Get event group by id (with events)' })
  @ApiOkResponse({ type: GetEventGroupResponseDto })
  getEventGroupById(@Param('id') id: string) {
    return this.promotionService.getEventGroupById(id);
  }

  @Post('event-groups')
  @Roles('admin', 'superadmin')
  @UseGuards(RoleGuard)
  @ApiOperation({ summary: 'Create an event group (Admin)' })
  @ApiResponse({ type: GetEventGroupResponseDto })
  createEventGroup(@Body() dto: CreateEventGroupDto) {
    return this.promotionService.createEventGroup(dto);
  }

  @Patch('event-groups/:id')
  @Roles('admin', 'superadmin')
  @UseGuards(RoleGuard)
  @ApiOperation({ summary: 'Update an event group (Admin)' })
  @ApiResponse({ type: GetEventGroupResponseDto })
  updateEventGroup(@Param('id') id: string, @Body() dto: UpdateEventGroupDto) {
    return this.promotionService.updateEventGroup(id, dto);
  }

  @Delete('event-groups/:id')
  @Roles('admin', 'superadmin')
  @UseGuards(RoleGuard)
  @ApiOperation({ summary: 'Delete an event group (Admin)' })
  deleteEventGroup(@Param('id') id: string) {
    return this.promotionService.deleteEventGroup(id);
  }

  @Get('events')
  @Public()
  @ApiOperation({ summary: 'List discount events (paginated)' })
  @ApiOkResponse({ type: PaginatedDiscountEventResponseDto })
  getDiscountEvents(@Query() query: GetDiscountEventQueryDto) {
    return this.promotionService.getDiscountEvents(query);
  }

  @Get('events/:id')
  @ApiOperation({ summary: 'Get discount event by id (with products)' })
  @ApiOkResponse({ type: GetDiscountEventResponseDto })
  getDiscountEventById(@Param('id') id: string) {
    return this.promotionService.getDiscountEventById(id);
  }

  @Post('events')
  @Roles('admin', 'superadmin')
  @UseGuards(RoleGuard)
  @ApiOperation({ summary: 'Create a discount event (Admin)' })
  @ApiOkResponse({ type: GetDiscountEventResponseDto })
  createDiscountEvent(@Body() dto: CreateDiscountEventDto) {
    return this.promotionService.createDiscountEvent(dto);
  }

  @Patch('events/:id')
  @Roles('admin', 'superadmin')
  @UseGuards(RoleGuard)
  @ApiOperation({
    summary: 'Update a discount event — also used to end it early (Admin)',
  })
  @ApiOkResponse({ type: GetDiscountEventResponseDto })
  updateDiscountEvent(
    @Param('id') id: string,
    @Body() dto: UpdateDiscountEventDto,
  ) {
    return this.promotionService.updateDiscountEvent(id, dto);
  }

  @Delete('events/:id')
  @Roles('admin', 'superadmin')
  @UseGuards(RoleGuard)
  @ApiOperation({ summary: 'Delete a discount event (Admin)' })
  deleteDiscountEvent(@Param('id') id: string) {
    return this.promotionService.deleteDiscountEvent(id);
  }

  @Get('events/:id/products')
  @Public()
  @ApiOperation({ summary: 'List products in a discount event' })
  @ApiOkResponse({ type: [GetEventProductResponseDto] })
  getEventProducts(@Param('id') id: string) {
    return this.promotionService.getEventProducts(id);
  }

  @Post('events/:id/products')
  @Roles('admin', 'superadmin')
  @UseGuards(RoleGuard)
  @ApiOperation({ summary: 'Add a product to an event (Admin)' })
  addProductToEvent(
    @Param('id') eventId: string,
    @Body() dto: AddProductToEventDto,
  ) {
    return this.promotionService.addProductToEvent(eventId, dto);
  }

  @Patch('events/:id/products/:productId')
  @Roles('admin', 'superadmin')
  @UseGuards(RoleGuard)
  @ApiOperation({ summary: 'Update product config within an event (Admin)' })
  updateEventProduct(
    @Param('id') eventId: string,
    @Param('productId') productId: string,
    @Body() dto: UpdateEventProductDto,
  ) {
    return this.promotionService.updateEventProduct(eventId, productId, dto);
  }

  @Delete('events/:id/products/:productId')
  @Roles('admin', 'superadmin')
  @UseGuards(RoleGuard)
  @ApiOperation({ summary: 'Remove a product from an event (Admin)' })
  removeProductFromEvent(
    @Param('id') eventId: string,
    @Param('productId') productId: string,
  ) {
    return this.promotionService.removeProductFromEvent(eventId, productId);
  }

  @Get('promo-codes')
  @Roles('admin', 'superadmin')
  @UseGuards(RoleGuard)
  @ApiOperation({ summary: 'List promo codes (Admin, paginated, filterable)' })
  @ApiOkResponse({ type: PaginatedPromoCodeResponseDto })
  getPromoCodes(@Query() query: GetPromoCodeQueryDto) {
    return this.promotionService.getPromoCodes(query);
  }

  @Get('promo-codes/:id')
  @Roles('admin', 'superadmin')
  @UseGuards(RoleGuard)
  @ApiOperation({ summary: 'Get promo code by id (Admin)' })
  @ApiOkResponse({ type: GetPromoCodeResponseDto })
  getPromoCodeById(@Param('id') id: string) {
    return this.promotionService.getPromoCodeById(id);
  }

  @Post('promo-codes')
  @Roles('admin', 'superadmin')
  @UseGuards(RoleGuard)
  @ApiOperation({ summary: 'Create a promo code (Admin)' })
  @ApiOkResponse({ type: GetPromoCodeResponseDto })
  createPromoCode(@Body() dto: CreatePromoCodeDto) {
    return this.promotionService.createPromoCode(dto);
  }

  @Patch('promo-codes/:id')
  @Roles('admin', 'superadmin')
  @UseGuards(RoleGuard)
  @ApiOperation({
    summary: 'Update a promo code — includes toggle isActive (Admin)',
  })
  @ApiOkResponse({ type: GetPromoCodeResponseDto })
  updatePromoCode(@Param('id') id: string, @Body() dto: UpdatePromoCodeDto) {
    return this.promotionService.updatePromoCode(id, dto);
  }

  @Delete('promo-codes/:id')
  @Roles('admin', 'superadmin')
  @UseGuards(RoleGuard)
  @ApiOperation({ summary: 'Delete a promo code (Admin)' })
  deletePromoCode(@Param('id') id: string) {
    return this.promotionService.deletePromoCode(id);
  }
}
