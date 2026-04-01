import { Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
@ApiTags('User')
@Controller('user')
export class UserController {
  @Get('')
  @ApiOperation({ summary: 'Get all user' })
  async getAllUser() {}
  @Get(':id')
  @ApiOperation({ summary: 'Get user by id' })
  async getUserById(@Param('id') id: string) {}
  @Post('')
  @ApiOperation({ summary: 'Create a new user' })
  async createUser() {}
  @Put(':id')
  @ApiOperation({ summary: 'Update a user' })
  async updateUser() {}
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a user' })
  async deleteUser() {}
}
