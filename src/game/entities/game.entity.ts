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

// Một lượt chơi = 2 pha, mỗi pha 60s và cả hai đều mở cổng bỏ phiếu — xem docs/game-rounds.md.
// Vote của mỗi pha lưu riêng theo (phase, dayNumber).
export enum GamePhase {
  NIGHT = 'NIGHT', // Sói bỏ phiếu chọn nạn nhân
  DAY = 'DAY', // Cả làng bỏ phiếu treo cổ
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

  // Thời điểm pha hiện tại kết thúc, để client đếm ngược — null khi ván đã FINISHED/CANCELLED.
  // Không phải nguồn sự thật của bộ hẹn giờ: lịch chuyển pha nằm trong RAM (SchedulerRegistry),
  // nên restart server là ván đứng — nợ kỹ thuật đã ghi ở PLAN.md §7.
  @Column({ type: 'timestamp', nullable: true })
  phaseEndsAt: Date | null;

  @Column({ type: 'enum', enum: GameWinner, nullable: true })
  winner: GameWinner | null;

  @CreateDateColumn()
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  finishedAt: Date | null;
}
