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

// DAY tách thành 2 pha kỹ thuật: DAY (thảo luận) rồi DAY_VOTE (bỏ phiếu treo cổ) — xem
// docs/game-rules.md §4 bước "Ban ngày". Vote của mỗi pha được lưu riêng theo (phase, dayNumber).
export enum GamePhase {
  NIGHT = 'NIGHT',
  DAY = 'DAY',
  DAY_VOTE = 'DAY_VOTE',
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

  // Thời điểm pha hiện tại tự động kết thúc (rule engine dùng để lên lịch timer) — null khi
  // ván đã FINISHED/CANCELLED
  @Column({ type: 'timestamp', nullable: true })
  phaseEndsAt: Date | null;

  @Column({ type: 'enum', enum: GameWinner, nullable: true })
  winner: GameWinner | null;

  @CreateDateColumn()
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  finishedAt: Date | null;
}
