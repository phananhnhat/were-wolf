import { RoomRepository } from '../../domain/repositories/room.repository';
import { Room } from '../../domain/entities/room.entity';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

export interface WaitingRoomsOutput {
  items: Room[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function findWaitingRooms(
  rooms: RoomRepository,
  page?: number,
  limit?: number,
): Promise<WaitingRoomsOutput> {
  const currentPage =
    page !== undefined && Number.isInteger(page) && page > 0
      ? page
      : DEFAULT_PAGE;
  const pageSize =
    limit !== undefined && Number.isInteger(limit) && limit > 0
      ? Math.min(limit, MAX_LIMIT)
      : DEFAULT_LIMIT;

  const { items, total } = await rooms.findWaiting(currentPage, pageSize);

  return {
    items,
    total,
    page: currentPage,
    limit: pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}
