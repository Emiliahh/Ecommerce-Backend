import { Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
@ApiTags('Promotion')
@Controller('promotion')
export class PromotionController {
  @Get('')
  @ApiOperation({ summary: 'Get all promotion' })
  async getAllPromotion() {}
  @Get(':id')
  @ApiOperation({ summary: 'Get promotion by id' })
  async getPromotionById(@Param('id') id: string) {}
  @Post('')
  @ApiOperation({ summary: 'Create a new promotion' })
  async createPromotion() {}
  @Put(':id')
  @ApiOperation({ summary: 'Update a promotion' })
  async updatePromotion() {}
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a promotion' })
  async deletePromotion() {}
}
