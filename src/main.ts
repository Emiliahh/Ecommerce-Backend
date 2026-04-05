import { cleanupOpenApiDoc } from 'nestjs-zod';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { LoggingInterceptor } from './middleware/Logging';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.use(cookieParser());
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });
  app.setGlobalPrefix('api');
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.enableCors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        process.env.CLIENT_URL ?? 'http://localhost:3001',
        process.env.ADMIN_URL ?? 'http://localhost:3000',
      ];
      const isNgrok =
        origin &&
        (origin.endsWith('.ngrok-free.app') ||
          origin.endsWith('.ngrok.io') ||
          origin.endsWith('.ngrok.dev'));

      if (!origin || allowedOrigins.includes(origin) || isNgrok) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: Origin ${origin} not allowed`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'ngrok-skip-browser-warning',
    ],
  });

  const openApiDoc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Example API')
      .setDescription('Example API description')
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );

  SwaggerModule.setup('api', app, cleanupOpenApiDoc(openApiDoc), {
    jsonDocumentUrl: '/api-json',
    swaggerOptions: {
      displayRequestDuration: true,
    },
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
