import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum GameStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  FINISHED = 'FINISHED',
  CANCELLED = 'CANCELLED',
}

export enum GamePhase {
  NIGHT = 'NIGHT',
  DAY = 'DAY',
}

export enum GameWinner {
  VILLAGER = 'VILLAGER',
  WEREWOLF = 'WEREWOLF',
  THIRD_PARTY = 'THIRD_PARTY',
}

@Entity('games')
export class Game {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  roomId: number;

  @Column({ type: 'enum', enum: GameStatus, default: GameStatus.IN_PROGRESS })
  status: GameStatus;

  @Column({ type: 'enum', enum: GamePhase, default: GamePhase.NIGHT })
  phase: GamePhase;

  @Column({ type: 'smallint', default: 0 })
  dayNumber: number;

  @Column({ type: 'enum', enum: GameWinner, nullable: true })
  winner: GameWinner | null;

  @CreateDateColumn()
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  finishedAt: Date | null;
}
