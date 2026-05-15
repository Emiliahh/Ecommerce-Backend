import { Inject, Injectable } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { GOOGLE_AI_PROVIDER } from './provider/google-ai.provider';
import {
  PINECONE_CLIENT,
  PINECONE_INSTANCE,
} from '../product/provider/pinecone.provider';
import { type PineconeIndex } from '../product/provider/picone.type';
import { Pinecone } from '@pinecone-database/pinecone';

@Injectable()
export class ChatbotService {
  constructor(
    @Inject(GOOGLE_AI_PROVIDER) private readonly googleAI: GoogleGenAI,
    @Inject(PINECONE_INSTANCE) private readonly pineconeIndex: PineconeIndex,
    @Inject(PINECONE_CLIENT) private readonly pineconeClient: Pinecone,
  ) {}

  async chat(message: string) {
    const embeddingResult = await this.pineconeClient.inference.embed({
      model: 'multilingual-e5-large',
      inputs: [message],
      parameters: { input_type: 'query' },
    });

    const embedding = embeddingResult.data[0];
    if (!embedding || !('values' in embedding) || !embedding.values) {
      throw new Error('Failed to generate embedding for the message');
    }

    const queryResponse = await this.pineconeIndex.query({
      vector: embedding.values,
      topK: 5,
      includeMetadata: true,
    });
    const context = queryResponse.matches
      .map((match) => {
        const metadata = match.metadata as any;
        return `Product: ${metadata.name}
Description: ${metadata.productName}
Price: ${metadata.price}
SKU: ${metadata.sku}
Attributes: ${metadata.attributes}
Slug: ${metadata.slug || ''}`;
      })
      .join('\n\n---\n\n');

    const domain = process.env.FRONTEND_URL || 'http://localhost:3001';

    const systemPrompt = `Bạn là một trợ lý bán hàng thông minh và thân thiện cho một cửa hàng điện tử. 
Hãy sử dụng thông tin sản phẩm dưới đây để trả lời câu hỏi của khách hàng bằng tiếng Việt. 
Nếu thông tin không có trong ngữ cảnh, hãy trả lời một cách thành thật rằng bạn không biết.

HƯỚNG DẪN QUAN TRỌNG VỀ ĐỊNH DẠNG:
- Khi tư vấn và nhắc đến một sản phẩm cụ thể, BẮT BUỘC phải đính kèm đường link dẫn đến sản phẩm đó.
- Cấu trúc link tạo ra: ${domain}/san-pham/[Slug]
- Hãy viết link dưới dạng URL trần để hệ thống dễ dàng render thẻ hiển thị. Ví dụ:
  "Dạ, mẫu iPhone 15 này rất phù hợp với bạn. Chi tiết xem tại: ${domain}/sanpham/iphone-15-pro-max"

NGỮ CẢNH SẢN PHẨM:
${context}

Câu hỏi của khách hàng: ${message}`;

    const response = await this.googleAI.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: systemPrompt,
    });
    return response;
  }
}
