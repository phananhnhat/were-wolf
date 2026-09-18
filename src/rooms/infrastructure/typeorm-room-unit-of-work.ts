import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Room as RoomOrmEntity } from '../entities/room.entity';
import { RoomMember as RoomMemberOrmEntity } from '../entities/room-member.entity';
import {
  RoomUnitOfWork,
  RoomTransactionalRepositories,
} from '../application/ports/room-unit-of-work';
import { TypeOrmRoomRepository } from './persistence/typeorm-room.repository';
import { TypeOrmRoomMemberRepository } from './persistence/typeorm-room-member.repository';

@Injectable()
export class TypeOrmRoomUnitOfWork implements RoomUnitOfWork {
  constructor(private readonly dataSource: DataSource) {}

  runInTransaction<T>(
    work: (repos: RoomTransactionalRepositories) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction((manager) =>
      work({
        rooms: new TypeOrmRoomRepository(manager.getRepository(RoomOrmEntity)),
        members: new TypeOrmRoomMemberRepository(
          manager.getRepository(RoomMemberOrmEntity),
        ),
      }),
    );
  }
}
