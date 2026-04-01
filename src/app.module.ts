import {
  ZodValidationPipe,
  ZodSerializerInterceptor,
  ZodSerializationException,
} from 'nestjs-zod';
import {
  APP_PIPE,
  APP_INTERCEPTOR,
  APP_FILTER,
  BaseExceptionFilter,
} from '@nestjs/core';
import { ZodError } from 'zod';
import {
  Module,
  HttpException,
  ArgumentsHost,
  Logger,
  Catch,
} from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { envSchema } from './env.validation';
import { DatabaseModule } from './database/database.module';
import { ProductModule } from './module/product/product.module';
import { UserModule } from './module/user/user.module';
import { CatalogModule } from './module/catalog/catalog.module';
import { CartModule } from './module/cart/cart.module';
import { OrderModule } from './module/order/order.module';
import { PaymentModule } from './module/payment/payment.module';
import { PromotionModule } from './module/promotion/promotion.module';
import { AuthModule } from './module/auth/auth.module';
import { UploadModule } from './module/upload/upload.module';
import { CacheModule } from '@nestjs/cache-manager';
import { CloudinaryModule } from './module/cloudinary/cloudinary.module';

@Catch(HttpException)
class HttpExceptionFilter extends BaseExceptionFilter {
  private logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    if (exception instanceof ZodSerializationException) {
      const zodError = exception.getZodError();

      if (zodError instanceof ZodError) {
        this.logger.error(`ZodSerializationException: ${zodError.message}`);
      }
    }

    super.catch(exception, host);
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => envSchema.parse(config),
    }),
    CacheModule.register(),
    DatabaseModule,
    ProductModule,
    UserModule,
    CatalogModule,
    CartModule,
    OrderModule,
    PaymentModule,
    PromotionModule,
    AuthModule,
    UploadModule,
    CloudinaryModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ZodSerializerInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
