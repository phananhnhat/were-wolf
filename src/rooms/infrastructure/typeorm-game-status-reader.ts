import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Game as GameOrmEntity,
  GameStatus,
} from '../../game/infrastructure/persistence/game.orm-entity';
import { GameStatusReader } from '../application/ports/game-status-reader';

// Gateway — đọc thẳng bảng `games` của GameModule (Gateway, không phải Domain/Application của
// Rooms — chỉ Infrastructure layer mới được phép biết GameModule tồn tại, xem
// game-status-reader.ts port).
@Injectable()
export class TypeOrmGameStatusReader implements GameStatusReader {
  constructor(
    @InjectRepository(GameOrmEntity)
    private readonly repo: Repository<GameOrmEntity>,
  ) {}

  async hasActiveGame(roomId: number): Promise<boolean> {
    const row = await this.repo.findOneBy({
      roomId,
      status: GameStatus.IN_PROGRESS,
    });
    return row !== null;
  }
}
