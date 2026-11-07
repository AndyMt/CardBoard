import { Server, Socket } from 'socket.io';
import { BoardModel } from '../model/BoardModel';
import type { User } from '../../types/User.js';
import { quantizeScalar } from '../../shared/geometry.js';

/**
 * WebSocketController manages real-time synchronization of board state
 * between all connected clients using Socket.IO.
 *
 * Design:
 *  - A single "board" room exists; every connected user joins it.
 *  - After any mutation the server broadcasts the full board to the room.
 *  - Position updates during dragging are throttled to ~200ms so clients
 *    receive smooth live previews without flooding the network.
 *  - The emitting socket is excluded from the broadcast to avoid cursor
 *    jump / duplicate application on the originating client.
 */
export const BOARD_ROOM = 'board';
export const BOARD_UPDATE_EVENT = 'board:update';
export const BOARD_LIVE_UPDATE_EVENT = 'board:live-update';
export const USERS_UPDATE_EVENT = 'users:update';
export const USERS_DIRECTORY_UPDATE_EVENT = 'users:directory';
export const LIVE_DRAG_EVENT = 'live:drag';

export interface LiveUpdatePayload {
  cards: { id: string; x: number; y: number }[];
  groups: { id: string; x: number; y: number }[];
}

export interface BoardUpdatePayload {
  board: BoardModel;
}

export interface UsersUpdatePayload {
  count: number;
}

export interface UserDirectoryUpdatePayload {
  users: User[];
}

export interface LiveDragPayload {
  cards: { id: string; x: number; y: number }[];
  groups: { id: string; x: number; y: number }[];
}

export class WebSocketController {
  private io: Server;
  private connectedSockets = new Map<string, Socket>();
  private liveUpdateTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingLiveUpdate: LiveUpdatePayload | null = null;

  constructor(io: Server) {
    this.io = io;
    this.io.on('connection', (socket) => this.handleConnection(socket));
  }

  private handleConnection(socket: Socket): void {
    this.connectedSockets.set(socket.id, socket);
    socket.join(BOARD_ROOM);
    this.broadcastUserCount();

    // Live drag position preview from a client (throttled broadcast)
    socket.on(LIVE_DRAG_EVENT, (payload: LiveDragPayload) => {
      this.scheduleLiveUpdate(
        {
          cards: (payload.cards || []).map((card) => ({ ...card, x: quantizeScalar(card.x), y: quantizeScalar(card.y) })),
          groups: (payload.groups || []).map((group) => ({ ...group, x: quantizeScalar(group.x), y: quantizeScalar(group.y) })),
        },
        socket.id
      );
    });

    socket.on('disconnect', () => {
      this.connectedSockets.delete(socket.id);
      this.broadcastUserCount();
    });
  }

  /** Broadcast the full board to all clients except the sender. */
  broadcastBoardUpdate(board: BoardModel, excludeSocketId?: string): void {
    const payload: BoardUpdatePayload = { board };
    console.log(`[WS] broadcasting board:update (cards=${board.cards?.length ?? 0}, groups=${board.groups?.length ?? 0}) exclude=${excludeSocketId ?? 'none'}`);
    if (excludeSocketId) {
      this.io.to(BOARD_ROOM).except(excludeSocketId).emit(BOARD_UPDATE_EVENT, payload);
    } else {
      this.io.to(BOARD_ROOM).emit(BOARD_UPDATE_EVENT, payload);
    }
  }

  /**
   * Schedule a throttled live update (drag position preview).
   * Updates are coalesced so that at most one event is emitted per 200ms
   * window, keeping the client-side rendering smooth.
   */
  scheduleLiveUpdate(payload: LiveUpdatePayload, excludeSocketId?: string): void {
    this.pendingLiveUpdate = payload;
    if (this.liveUpdateTimer) return;

    this.liveUpdateTimer = setTimeout(() => {
      const data = this.pendingLiveUpdate;
      this.liveUpdateTimer = null;
      this.pendingLiveUpdate = null;
      if (!data) return;

      if (excludeSocketId) {
        this.io.to(BOARD_ROOM).except(excludeSocketId).emit(BOARD_LIVE_UPDATE_EVENT, data);
      } else {
        this.io.to(BOARD_ROOM).emit(BOARD_LIVE_UPDATE_EVENT, data);
      }
    }, 200);
  }

  /** Broadcast the number of currently connected users. */
  private broadcastUserCount(): void {
    const count = this.connectedSockets.size;
    const payload: UsersUpdatePayload = { count };
    this.io.to(BOARD_ROOM).emit(USERS_UPDATE_EVENT, payload);
  }

  /** Broadcast the full user directory to all clients. */
  broadcastUsersDirectory(users: User[]): void {
    const payload: UserDirectoryUpdatePayload = { users };
    this.io.to(BOARD_ROOM).emit(USERS_DIRECTORY_UPDATE_EVENT, payload);
  }

  /** Number of currently connected clients. */
  getConnectedCount(): number {
    return this.connectedSockets.size;
  }
}