import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { Game } from './entities/game.entity';
import { GamePlayer } from './entities/game-player.entity';
import { GameVote } from './entities/game-vote.entity';
import { GameAction } from './entities/game-action.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Game, GamePlayer, GameVote, GameAction])],
  controllers: [GameController],
  providers: [GameService],
})
export class GameModule {}
