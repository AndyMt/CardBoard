import { Server, Socket } from 'socket.io';
import type { CursorPosition } from '../../types/Cursor.js';

export const CURSOR_MOVE_EVENT = 'cursor:move';
export const CURSOR_UPDATE_EVENT = 'cursor:update';

export interface CursorEntry {
  socketId: string;
  userId: string;
  userName: string;
  color: string;
  x: number;
  y: number;
}

export interface CursorServiceOptions {
  /** Broadcast interval in milliseconds. Defaults to 100ms. */
  intervalMs?: number;
}

export class CursorService {
  private io: Server;
  private intervalMs: number;
  private cursors = new Map<string, CursorEntry>();
  private broadcastTimer: ReturnType<typeof setInterval> | null = null;

  constructor(io: Server, options: CursorServiceOptions = {}) {
    this.io = io;
    this.intervalMs = options.intervalMs ?? 100;
    this.io.on('connection', (socket) => this.handleConnection(socket));
    this.startBroadcastTimer();
  }

  private handleConnection(socket: Socket): void {
    socket.on(CURSOR_MOVE_EVENT, (payload: CursorPosition) => {
      this.cursors.set(socket.id, {
        socketId: socket.id,
        userId: payload.userId,
        userName: payload.userName,
        color: payload.color,
        x: payload.x,
        y: payload.y,
      });
    });

    socket.on('disconnect', () => {
      this.cursors.delete(socket.id);
    });
  }

  private startBroadcastTimer(): void {
    this.broadcastTimer = setInterval(() => {
      const cursors = Array.from(this.cursors.values());
      this.io.emit(CURSOR_UPDATE_EVENT, { cursors });
    }, this.intervalMs);
  }

  /** Number of cursors currently tracked. */
  getCursorCount(): number {
    return this.cursors.size;
  }

  /** Stop the broadcast timer (cleanup). */
  stop(): void {
    if (this.broadcastTimer) {
      clearInterval(this.broadcastTimer);
      this.broadcastTimer = null;
    }
  }
}

export default CursorService;
