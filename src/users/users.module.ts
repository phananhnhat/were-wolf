import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { USER_REPOSITORY } from './domain/repositories/user.repository';
import { TypeOrmUserRepository } from './infrastructure/persistence/typeorm-user.repository';

// Composition root của UsersModule. Export cả UsersService (Facade, cho Controller) lẫn
// USER_REPOSITORY (token, cho AuthModule — AuthModule cần đọc/ghi User trực tiếp qua domain
// port, không qua Facade vì Facade trả UserResponseDto đã ẩn passwordHash).
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [
    UsersService,
    { provide: USER_REPOSITORY, useClass: TypeOrmUserRepository },
  ],
  exports: [UsersService, USER_REPOSITORY],
})
export class UsersModule {}
