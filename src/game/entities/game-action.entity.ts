import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Game } from './game.entity';
import { User } from '../../users/entities/user.entity';
import { GameActionType } from '../constants/actions';

// 1 dòng = 1 lần dùng kỹ năng của vai đặc biệt.
//
// UNIQUE(gameId, dayNumber, actionType, actorId) cài 2 luật cho Tiên tri & Bảo vệ:
//   - "mỗi đêm đúng 1 lần"  — không thể có dòng thứ hai
//   - "không đổi ý"         — bảng này CHỈ INSERT, không bao giờ UPDATE, khác hẳn game_votes
//                             (bỏ phiếu cho đổi vì chưa ai biết kết quả; soi thì vừa gọi là
//                             đã biết đáp án, cho đổi thì soi được cả làng trong một đêm)
//
// Riêng 2 bình thuốc của Phù thuỷ cần "1 lần cho CẢ VÁN", không phải mỗi đêm — nên có thêm
// 1 index có điều kiện bên dưới, bỏ dayNumber ra khỏi khoá và chỉ áp cho 2 loại đó.
// Xem docs/impl-phu-thuy.md §2.2.
//
// Không có cột `phase`: mọi kỹ năng ban đêm (kể cả WITCH_POISON) đều diễn ra ở NIGHT, còn
// WITCH_HEAL diễn ra ở SKILL — nhưng vì dayNumber chỉ tăng khi chuyển NGÀY → ĐÊM, NIGHT và
// SKILL của cùng một lượt mang cùng dayNumber, nên (dayNumber, actionType, actorId) đã đủ
// định danh, không cần thêm cột phase. Xem docs/role-tien-tri.md §4.4.
@Entity('game_actions')
@Unique(['gameId', 'dayNumber', 'actionType', 'actorId'])
@Index(
  'UQ_game_actions_witch_once_per_game',
  ['gameId', 'actionType', 'actorId'],
  {
    unique: true,
    where: `"actionType" IN ('WITCH_HEAL', 'WITCH_POISON')`,
  },
)
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
