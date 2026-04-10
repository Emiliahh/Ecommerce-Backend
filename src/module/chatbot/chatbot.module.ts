import { Module } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { ChatbotController } from './chatbot.controller';
import { GoogleAIProvider } from './provider/google-ai.provider';
import { ProductModule } from '../product/product.module';

@Module({
    imports: [ProductModule],
    providers: [ChatbotService, GoogleAIProvider],
    controllers: [ChatbotController],
    exports: [ChatbotService],
})
export class ChatbotModule { }
