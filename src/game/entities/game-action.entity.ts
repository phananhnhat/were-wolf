import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Game } from './game.entity';
import { User } from '../../users/entities/user.entity';
import { GameActionType } from '../constants/actions';

// 1 dòng = 1 lần dùng kỹ năng của vai đặc biệt trong 1 lượt.
//
// UNIQUE(gameId, dayNumber, actionType, actorId) cài 2 luật cùng lúc:
//   - "mỗi đêm đúng 1 lần"  — không thể có dòng thứ hai
//   - "không đổi ý"         — bảng này CHỈ INSERT, không bao giờ UPDATE, khác hẳn game_votes
//                             (bỏ phiếu cho đổi vì chưa ai biết kết quả; soi thì vừa gọi là
//                             đã biết đáp án, cho đổi thì soi được cả làng trong một đêm)
//
// Không có cột `phase` vì hiện mọi kỹ năng đều diễn ra ban đêm, mà dayNumber chỉ tăng khi
// chuyển NGÀY → ĐÊM nên mỗi dayNumber ứng với đúng một đêm. Khi nào có kỹ năng dùng được
// ban ngày (Thợ săn bắn lúc bị treo cổ) thì mới cần thêm. Xem docs/role-tien-tri.md §4.4.
@Entity('game_actions')
@Unique(['gameId', 'dayNumber', 'actionType', 'actorId'])
export class GameAction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  gameId: number;

  @ManyToOne(() => Game, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'gameId' })
  game: Game;

  @Column({ type: 'smallint' })
  dayNumber: number;

  @Column({ type: 'enum', enum: GameActionType })
  actionType: GameActionType;

  @Column()
  actorId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'actorId' })
  actor: User;

  @Column()
  targetId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'targetId' })
  target: User;

  // Kết quả trả về cho người dùng kỹ năng. SEER_CHECK: 'WEREWOLF' | 'NOT_WEREWOLF'.
  // Lưu lại thay vì tính lại mỗi lần đọc, để bản ghi phản ánh đúng kết quả TẠI THỜI ĐIỂM
  // soi — phòng khi sau này có vai làm đổi phe (Sói chúa biến người thành Sói).
  @Column({ type: 'varchar', nullable: true })
  result: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
