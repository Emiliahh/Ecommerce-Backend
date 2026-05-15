import { Body, Controller, Post, Sse } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { ApiOperation, ApiTags, ApiBody, ApiResponse } from '@nestjs/swagger';
import { ChatDto } from './dto/chat.dto';
import { Public } from 'src/decorator/isPublic';
import { Observable } from 'rxjs';

@ApiTags('Chatbot')
@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}
  @Public()
  @Post('chat')
  @ApiOperation({ summary: 'Chat with the AI product assistant' })
  @ApiBody({ type: ChatDto })
  @Sse()
  @ApiResponse({
    status: 200,
    description: 'AI response returned successfully',
  })
  async chat(@Body() chatDto: ChatDto) {
    const stream = await this.chatbotService.chat(chatDto.message);
    return new Observable((subcriber) => {
      void (async () => {
        try {
          for await (const chunk of stream) {
            subcriber.next({ data: chunk.text });
          }
          subcriber.complete();
        } catch (error) {
          subcriber.error(error);
        }
      })();
    });
  }
}
