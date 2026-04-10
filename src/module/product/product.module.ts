import { Module } from '@nestjs/common';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { CatalogModule } from '../catalog/catalog.module';
import { PromotionModule } from '../promotion/promotion.module';
import { PineconeClientProvider, PineconeProvider } from './provider/pinecone.provider';

@Module({
  controllers: [ProductController],
  providers: [ProductService, PineconeProvider, PineconeClientProvider],
  exports: [ProductService, PineconeProvider, PineconeClientProvider],
  imports: [CatalogModule, PromotionModule],
})
export class ProductModule { }
