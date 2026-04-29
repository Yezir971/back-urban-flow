import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          // On autorise Swagger à exécuter ses scripts internes
          scriptSrc: ["'self'", "'unsafe-inline'"],
          // On autorise Swagger à charger ses styles CSS
          styleSrc: ["'self'", "'unsafe-inline'"],
          // On autorise le logo Swagger
          imgSrc: ["'self'", 'data:', 'validator.swagger.io'],
        },
      },
      // On désactive cette option car elle empêche souvent Swagger de charger ses fichiers JS
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Empêche le navigateur de stocker des données sensibles en cache
  app.use((req : any, res: any, next: any) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

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
