import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configuration de Swagger
  const config = new DocumentBuilder()
    .setTitle('API Urban Flow')
    .setDescription('Documentation API Urban Flow')
    .setVersion('1.0')
    .build();
    
  const document = SwaggerModule.createDocument(app, config);
  
  // http://localhost:3000/api
  SwaggerModule.setup('api', app, document);

  await app.listen(3000);
}
bootstrap();
