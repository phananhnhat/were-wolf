import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { GroupsModule } from './groups/groups.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { User } from './users/entities/user.entity';
import { UserSession } from './auth/entities/user-session.entity';

@Module({
  imports: [
    // ConfigModule.forRoot() đọc file .env ở root project lúc app khởi động
    // Parse từng dòng KEY=VALUE → lưu vào process.env (biến môi trường của Node process)
    // isGlobal: true → không cần import ConfigModule lại ở từng module con
    //                   ConfigService có thể inject ở bất kỳ đâu
    ConfigModule.forRoot({ isGlobal: true }),

    // forRootAsync thay vì forRoot vì cần inject ConfigService để đọc DATABASE_URL
    // (ConfigService chỉ available sau khi ConfigModule khởi động xong)
    TypeOrmModule.forRootAsync({
      // inject: báo cho NestJS biết cần truyền ConfigService vào useFactory
      inject: [ConfigService],

      // useFactory là hàm được NestJS gọi để tạo config object cho TypeORM
      // NestJS tự inject ConfigService vào tham số config theo thứ tự trong inject[]
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        // config.getOrThrow() đọc từ process.env.DATABASE_URL
        // Nếu biến không tồn tại → throw lỗi ngay lúc khởi động, không chờ đến lúc dùng
        url: config.getOrThrow<string>('DATABASE_URL'),
        entities: [User, UserSession],
        synchronize: true, // tắt khi lên production
      }),
    }),

    // -----------------------------------------------------------------------
    // Ví dụ: thêm 1 PostgreSQL nữa với URL khác (analytics DB chẳng hạn)
    // Cần đặt name để phân biệt với connection mặc định ở trên
    // -----------------------------------------------------------------------
    // TypeOrmModule.forRootAsync({
    //   name: 'analytics',                           // tên connection
    //   inject: [ConfigService],
    //   useFactory: (config: ConfigService) => ({
    //     type: 'postgres',
    //     url: config.getOrThrow<string>('ANALYTICS_DATABASE_URL'),
    //     entities: [AnalyticsEvent],
    //     synchronize: false,
    //   }),
    // }),
    //
    // Khi dùng repository của connection này, phải chỉ định tên:
    //   TypeOrmModule.forFeature([AnalyticsEvent], 'analytics')  ← trong module con
    //   @InjectRepository(AnalyticsEvent, 'analytics')           ← trong service/constructor

    // -----------------------------------------------------------------------
    // Ví dụ: dùng MySQL thay vì PostgreSQL — chỉ đổi type, cài thêm: pnpm add mysql2
    // -----------------------------------------------------------------------
    // TypeOrmModule.forRootAsync({
    //   inject: [ConfigService],
    //   useFactory: (config: ConfigService) => ({
    //     type: 'mysql',                             // ← đổi ở đây
    //     url: config.getOrThrow<string>('MYSQL_DATABASE_URL'),
    //     entities: [User],
    //     synchronize: true,
    //   }),
    // }),
    UsersModule,
    GroupsModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
