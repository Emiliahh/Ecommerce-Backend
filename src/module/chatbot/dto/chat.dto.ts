import { ApiProperty } from '@nestjs/swagger';

export class ChatDto {
    @ApiProperty({
        description: 'The message to send to the chatbot',
        example: 'Recommend me a Samsung phone',
    })
    message: string;
}
