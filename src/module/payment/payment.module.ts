import { Module, forwardRef } from '@nestjs/common';
import { PayosProvider } from './payos.provider/payos.provider';
import { PaymentService } from './payment.service';
import { OrderModule } from '../order/order.module';
import { PaymentController } from './payment.controller';

@Module({
  imports: [forwardRef(() => OrderModule)],
  controllers: [PaymentController],
  providers: [PayosProvider, PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
