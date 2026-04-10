import { GoogleGenAI } from "@google/genai";
import { Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EnvConfig } from "src/env.validation";

export const GOOGLE_AI_PROVIDER = 'GOOGLE_AI_PROVIDER';


export const GoogleAIProvider: Provider = {
    provide: GOOGLE_AI_PROVIDER,
    useFactory: (configService: ConfigService<EnvConfig>) => {
        const apiKey = configService.get<string>('GOOGLE_AI_API_KEY');
        const googleAI = new GoogleGenAI({
            apiKey: apiKey!,
        })
        return googleAI;
    },
    inject: [ConfigService],
};