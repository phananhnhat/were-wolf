import { NestFactory, Reflector } from '@nestjs/core';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Bật lắng nghe SIGTERM/SIGINT để Nest tự gọi onModuleDestroy() (đóng TCP/WS listener của
  // MqttBrokerService, ngắt kết nối MqttRealtimeGamePublisherAdapter...) khi process bị dừng —
  // mặc định Nest KHÔNG tự làm việc này nếu thiếu dòng dưới.
  app.enableShutdownHooks();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  const config = new DocumentBuilder()
    .setTitle('Werewolf API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
