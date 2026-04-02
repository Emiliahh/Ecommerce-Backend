import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { GetUsersQueryDto } from './dto/get-users-query.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import {
  UserResponseDto,
  UserWithAddressesResponseDto,
  PaginatedUserResponseDto,
  AddressResponseDto,
  MessageResponseDto,
} from './dto/user-responses.dto';
import { Roles } from 'src/decorator/role';
import { CurrentUser } from 'src/decorator/user';
import { RoleGuard } from 'src/guard/role.guard';

@ApiTags('User')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) { }

  // ADMIN ENDPOINTS
  @Get('')
  @Roles('admin', 'superadmin')
  @UseGuards(RoleGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all users (Admin only)' })
  @ApiResponse({ status: 200, type: PaginatedUserResponseDto })
  async getAllUser(@Query() query: GetUsersQueryDto) {
    return this.userService.findAll(query);
  }

  @Get(':id')
  @Roles('admin', 'superadmin')
  @UseGuards(RoleGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user by id (Admin only)' })
  @ApiResponse({ status: 200, type: UserWithAddressesResponseDto })
  async getUserById(@Param('id') id: string) {
    return this.userService.findOneById(id);
  }

  @Post('')
  @Roles('admin', 'superadmin')
  @UseGuards(RoleGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new user (Admin only)' })
  @ApiResponse({ status: 201, type: UserResponseDto })
  async createUser(@Body() dto: CreateUserDto) {
    return this.userService.createUser(dto);
  }

  @Put(':id')
  @Roles('admin', 'superadmin')
  @UseGuards(RoleGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a user (Admin only)' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  async updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.userService.updateUser(id, dto);
  }

  @Delete(':id')
  @Roles('admin', 'superadmin')
  @UseGuards(RoleGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a user (Admin only - Soft delete)' })
  @ApiResponse({ status: 200, type: MessageResponseDto })
  async deleteUser(@Param('id') id: string) {
    return this.userService.deleteUser(id);
  }

  // PROFILE ENDPOINTS
  @Get('profile/me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, type: UserWithAddressesResponseDto })
  async getMyProfile(@CurrentUser('userId') userId: string) {
    return this.userService.findOneById(userId);
  }

  @Put('profile/me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  async updateMyProfile(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.userService.updateProfile(userId, dto);
  }

  // ADDRESS ENDPOINTS
  @Get('profile/address')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user addresses' })
  @ApiResponse({ status: 200, type: [AddressResponseDto] })
  async getMyAddresses(@CurrentUser('userId') userId: string) {
    return this.userService.getAddresses(userId);
  }

  @Post('profile/address')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a new address' })
  @ApiResponse({ status: 201, type: AddressResponseDto })
  async addAddress(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateAddressDto,
  ) {
    return this.userService.addAddress(userId, dto);
  }

  @Put('profile/address/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an address' })
  @ApiResponse({ status: 200, type: AddressResponseDto })
  async updateAddress(
    @CurrentUser('userId') userId: string,
    @Param('id') addressId: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.userService.updateAddress(userId, addressId, dto);
  }

  @Delete('profile/address/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an address' })
  @ApiResponse({ status: 200, type: MessageResponseDto })
  async deleteAddress(
    @CurrentUser('userId') userId: string,
    @Param('id') addressId: string,
  ) {
    return this.userService.deleteAddress(userId, addressId);
  }

  @Patch('profile/address/:id/default')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set default address' })
  @ApiResponse({ status: 200, type: AddressResponseDto })
  async setDefaultAddress(
    @CurrentUser('userId') userId: string,
    @Param('id') addressId: string,
  ) {
    return this.userService.setDefaultAddress(userId, addressId);
  }
}
