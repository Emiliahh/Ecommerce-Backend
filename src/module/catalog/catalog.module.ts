import { Module } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CatalogController } from './catalog.controller';
import { CacheRegistry } from 'src/cache/cache.registry';

@Module({
  providers: [CatalogService, CacheRegistry],
  controllers: [CatalogController],
  exports: [CacheRegistry],
})
export class CatalogModule {}
