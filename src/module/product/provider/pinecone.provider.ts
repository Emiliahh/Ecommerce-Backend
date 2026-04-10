import { Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Pinecone } from "@pinecone-database/pinecone";
import { EnvConfig } from "src/env.validation";

export const PINECONE_INSTANCE = 'PINECONE_INSTANCE';
export const PINECONE_CLIENT = 'PINECONE_CLIENT';

export const PineconeProvider: Provider = {
    provide: PINECONE_INSTANCE,
    useFactory: (configService: ConfigService<EnvConfig>) => {
        const apiKey = configService.get<string>('PINECONE_API_KEY');
        const index = configService.get<string>('PINECONE_API_INDEX');
        const pc = new Pinecone({
            apiKey: apiKey!,
        })
        return pc.Index({
            name: index!,
        })
    },
    inject: [ConfigService],
};

export const PineconeClientProvider: Provider = {
    provide: PINECONE_CLIENT,
    useFactory: (configService: ConfigService<EnvConfig>) => {
        const apiKey = configService.get<string>('PINECONE_API_KEY');
        return new Pinecone({
            apiKey: apiKey!,
        });
    },
    inject: [ConfigService],
};

export type PineconeIndex = ReturnType<Pinecone['index']>;