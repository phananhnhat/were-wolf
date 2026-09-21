import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { RoomsModule } from './rooms/rooms.module';
import { GameModule } from './game/game.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { User } from './users/entities/user.entity';
import { UserSession } from './auth/entities/user-session.entity';
import { Room } from './rooms/entities/room.entity';
import { RoomMember } from './rooms/entities/room-member.entity';
import { Game } from './game/infrastructure/persistence/game.orm-entity';
import { GamePlayer } from './game/infrastructure/persistence/game-player.orm-entity';
import { GameVote } from './game/infrastructure/persistence/game-vote.orm-entity';
import { GameAction } from './game/infrastructure/persistence/game-action.orm-entity';

@Module({
  imports: [
    // ConfigModule.forRoot() đọc file .env ở root project lúc app khởi động
    // Parse từng dòng KEY=VALUE → lưu vào process.env (biến môi trường của Node process)
    // isGlobal: true → không cần import ConfigModule lại ở từng module con
    //                   ConfigService có thể inject ở bất kỳ đâu
    ConfigModule.forRoot({ isGlobal: true }),

    // Global — RoomsModule/GameModule không import lẫn nhau, phối hợp qua event
    // (EventEmitter2.emit / @OnEvent) để tránh circular dependency, xem docs/game.md §2
    EventEmitterModule.forRoot(),

    // Cung cấp SchedulerRegistry — GameService dùng để hẹn giờ đóng pha cho từng ván
    // (mỗi ván 1 timer riêng, xem docs/game-rounds.md §5)
    ScheduleModule.forRoot(),

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
        entities: [
          User,
          UserSession,
          Room,
          RoomMember,
          Game,
          GamePlayer,
          GameVote,
          GameAction,
        ],
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
    AuthModule,
    RoomsModule,
    // RealtimeModule KHÔNG khai ở đây — GameModule tự `imports: [RealtimeModule]` (thứ hạ tầng
    // realtime chỉ có GameModule dùng, và import ở đó còn đảm bảo MqttBrokerService khởi động
    // xong TRƯỚC MqttRealtimeGamePublisherAdapter của GameModule, xem game.module.ts).
    GameModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
