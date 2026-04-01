import { ConfigService } from '@nestjs/config';
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export const DRIZZLE = 'DRIZZLE_CONNECTION';

export const DrizzleProvider = {
  provide: DRIZZLE,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const url = configService.get<string>('DATABASE_URL');
    const client = postgres(url as string);
    const db = drizzle(client, { schema, logger: true });
    return db;
  },
};
export type DB = PostgresJsDatabase<typeof schema>;
