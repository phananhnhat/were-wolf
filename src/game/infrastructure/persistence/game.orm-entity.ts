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

// Một lượt chơi gồm NIGHT → (SKILL, nếu còn Phù thuỷ sống) → DAY. Chỉ NIGHT và DAY mở cổng
// bỏ phiếu; vote của mỗi pha lưu riêng theo (phase, dayNumber). Xem docs/impl-phu-thuy.md.
export enum GamePhase {
  NIGHT = 'NIGHT', // Sói bỏ phiếu chọn nạn nhân; Bảo vệ che; Tiên tri soi; Phù thuỷ đầu độc
  SKILL = 'SKILL', // Chỉ mở khi còn Phù thuỷ sống. Không ai bỏ phiếu. Phù thuỷ xem nạn nhân
  // đêm nay rồi quyết định có cứu hay không — đây là lý do duy nhất pha này tồn tại
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
