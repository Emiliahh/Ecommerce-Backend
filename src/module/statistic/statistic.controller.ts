import { Controller, Get, Query } from '@nestjs/common';
import { StatisticService } from './statistic.service';
import { ApiTags } from '@nestjs/swagger';
import GetBestSellerQuery from './dto/get-best-seller.dto';

@Controller('statistic')
@ApiTags('statistic')
export class StatisticController {
    constructor(private readonly statisticService: StatisticService) { }
    @Get('revenue')
    async getRevenueStatitistic(@Query('type') type: 'daily' | 'weekly' | 'monthly' | 'yearly') {
        return this.statisticService.getRevenueStatitistic(type);
    }

    @Get()
    async getStatistic(@Query('from') from: string, @Query('to') to: string) {
        return this.statisticService.getStatistic(new Date(from), new Date(to));
    }

    @Get('best-seller')
    async getBestSeller(@Query() query: GetBestSellerQuery) {
        return this.statisticService.bestSeller(query);
    }
}
