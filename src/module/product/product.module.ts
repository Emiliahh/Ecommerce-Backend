import { Module } from '@nestjs/common';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { CatalogModule } from '../catalog/catalog.module';
import { PromotionModule } from '../promotion/promotion.module';

@Module({
  controllers: [ProductController],
  providers: [ProductService],
  exports: [ProductService],
  imports: [CatalogModule, PromotionModule],
})
export class ProductModule { }
