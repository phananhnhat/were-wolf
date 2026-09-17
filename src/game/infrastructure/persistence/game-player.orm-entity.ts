import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Game } from './game.orm-entity';
import { User } from '../../../users/entities/user.entity';

@Entity('game_players')
@Unique(['gameId', 'userId'])
export class GamePlayer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  gameId: number;

  @ManyToOne(() => Game, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'gameId' })
  game: Game;

  @Column()
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  role: string;

  @Column({ default: true })
  isAlive: boolean;
}
