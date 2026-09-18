import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  RoomEventPublisher,
  RoomStartedPayload,
} from '../application/ports/room-event-publisher';

@Injectable()
export class RoomEventPublisherAdapter implements RoomEventPublisher {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  roomStarted(payload: RoomStartedPayload): void {
    this.eventEmitter.emit('room.started', payload);
  }

  roomDeleted(roomId: number): void {
    this.eventEmitter.emit('room.deleted', { roomId });
  }
}
