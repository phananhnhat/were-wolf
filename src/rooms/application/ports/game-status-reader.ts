// PORT hẹp, do RoomsModule (bên dùng) tự định nghĩa — KHÔNG tái dùng GameRepository của
// GameModule (interface đó có nhiều method Rooms không cần, và sẽ kéo theo phải export token
// từ GameModule ra ngoài, tạo phụ thuộc module thật giữa 2 module vốn chỉ nên nói chuyện qua
// event). Implementation (Infrastructure) tự đọc bảng `games` và tự lọc IN_PROGRESS bên trong
// — Domain/Application của Rooms không cần biết enum GameStatus của GameModule tồn tại.
export interface GameStatusReader {
  hasActiveGame(roomId: number): Promise<boolean>;
}

export const GAME_STATUS_READER = Symbol('GAME_STATUS_READER');
