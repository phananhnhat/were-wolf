import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Game, GamePhase } from './game.entity';
import { User } from '../../users/entities/user.entity';

// 1 dòng = phiếu bầu hiện tại của 1 người trong 1 lượt (gameId + phase + dayNumber).
// UNIQUE đảm bảo mỗi người chỉ có 1 phiếu hiệu lực/lượt — đổi phiếu là UPDATE dòng này,
// không tạo dòng mới, nên "vote nhiều lần" không bị tính nhiều lần khi kiểm phiếu.
@Entity('game_votes')
@Unique(['gameId', 'phase', 'dayNumber', 'voterId'])
export class GameVote {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  gameId: number;

  @ManyToOne(() => Game, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'gameId' })
  game: Game;

  // NIGHT (Sói chọn cắn) hoặc DAY (dân làng treo cổ) — cả 2 pha đều mở cổng bỏ phiếu
  @Column({ type: 'enum', enum: GamePhase })
  phase: GamePhase;

  @Column({ type: 'smallint' })
  dayNumber: number;

  @Column()
  voterId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'voterId' })
  voter: User;

  @Column()
  targetId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'targetId' })
  target: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
