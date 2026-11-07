import { io, Socket } from 'socket.io-client';
import type { Card } from '../../types/Card';
import type { Group } from '../../types/Group';
import type { User } from '../../types/User.js';
import { quantizeScalar } from '../../shared/geometry.js';

/**
 * WebSocketService wraps the socket.io-client connection to the server.
 *
 * It is a singleton so every component can share the same underlying socket.
 * Events emitted by the server:
 *  - board:update        -> full board snapshot (cards + groups)
 *  - board:live-update   -> throttled drag position preview for other users
 *  - users:update        -> number of currently connected users + ids of online users
 *  - users:directory     -> full user directory (all known users)
 */

export const BOARD_UPDATE_EVENT = 'board:update';
export const BOARD_LIVE_UPDATE_EVENT = 'board:live-update';
export const USERS_UPDATE_EVENT = 'users:update';
export const USERS_DIRECTORY_UPDATE_EVENT = 'users:directory';
export const LIVE_DRAG_EVENT = 'live:drag';

export interface BoardUpdatePayload {
  board: { cards: Card[]; groups: Group[] };
}

export interface LiveUpdatePayload {
  cards: { id: string; x: number; y: number }[];
  groups: { id: string; x: number; y: number }[];
}

export interface UsersUpdatePayload {
  count: number;
  onlineUserIds: string[];
}

export interface UserDirectoryUpdatePayload {
  users: User[];
}

type BoardUpdateHandler = (payload: BoardUpdatePayload) => void;
type LiveUpdateHandler = (payload: LiveUpdatePayload) => void;
type UsersUpdateHandler = (payload: UsersUpdatePayload) => void;
type UserDirectoryUpdateHandler = (payload: UserDirectoryUpdatePayload) => void;

class WebSocketService {
  private static instance: WebSocketService;

  private socket: Socket | null = null;
  private url: string;
  private boardUpdateHandlers = new Set<BoardUpdateHandler>();
  private liveUpdateHandlers = new Set<LiveUpdateHandler>();
  private usersUpdateHandlers = new Set<UsersUpdateHandler>();
  private userDirectoryHandlers = new Set<UserDirectoryUpdateHandler>();
  private connectHandlers = new Set<() => void>();

  private constructor(url: string = '') {
    // Empty url means use the same origin as the page (works with the Vite proxy)
    this.url = url;
  }

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  /** Connect to the server. Safe to call multiple times. */
  connect(): Socket {
    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    this.socket = io(this.url || undefined, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      this.connectHandlers.forEach((handler) => handler());
    });

    this.socket.on('disconnect', (reason) => {});

    this.socket.on(BOARD_UPDATE_EVENT, (payload: BoardUpdatePayload) => {
      this.boardUpdateHandlers.forEach((handler) => handler(payload));
    });

    this.socket.on(BOARD_LIVE_UPDATE_EVENT, (payload: LiveUpdatePayload) => {
      this.liveUpdateHandlers.forEach((handler) => handler(payload));
    });

    this.socket.on(USERS_UPDATE_EVENT, (payload: UsersUpdatePayload) => {
      this.usersUpdateHandlers.forEach((handler) => handler(payload));
    });

    this.socket.on(USERS_DIRECTORY_UPDATE_EVENT, (payload: UserDirectoryUpdatePayload) => {
      this.userDirectoryHandlers.forEach((handler) => handler(payload));
    });

    this.socket.on('connect_error', (err: Error) => {
      console.error('[WS] connection error:', err);
    });

    return this.socket;
  }

  /** Return the current socket id, if connected. */
  public getSocketId(): string | null {
    return this.socket?.id ?? null;
  }
  private lastLocalMutation = 0;

  public markLocalMutation(): void {
    this.lastLocalMutation = Date.now();
  }

  public isRecentLocalMutation(windowMs: number = 1000): boolean {
    return Date.now() - this.lastLocalMutation < windowMs;
  }

  /** True when the socket is connected. */
  isConnected(): boolean {
    return !!this.socket && this.socket.connected;
  }

  /** Send a live drag position preview to the server (throttled server-side). */
  emitLiveDrag(payload: LiveUpdatePayload): void {
    if (!this.socket) return;
    this.socket.emit(LIVE_DRAG_EVENT, {
      cards: payload.cards.map((card) => ({ ...card, x: quantizeScalar(card.x), y: quantizeScalar(card.y) })),
      groups: payload.groups.map((group) => ({ ...group, x: quantizeScalar(group.x), y: quantizeScalar(group.y) })),
    });
  }

  /** Tell the server this socket is identified as a given user (for online count). */
  emitUserIdentify(payload: { userId: string; userName: string }): void {
    if (!this.socket) return;
    this.socket.emit('user:identify', payload);
  }

  onBoardUpdate(handler: BoardUpdateHandler): () => void {
    this.boardUpdateHandlers.add(handler);
    return () => this.boardUpdateHandlers.delete(handler);
  }

  onLiveUpdate(handler: LiveUpdateHandler): () => void {
    this.liveUpdateHandlers.add(handler);
    return () => this.liveUpdateHandlers.delete(handler);
  }

  onUsersUpdate(handler: UsersUpdateHandler): () => void {
    this.usersUpdateHandlers.add(handler);
    return () => this.usersUpdateHandlers.delete(handler);
  }

  onUsersDirectoryUpdate(handler: UserDirectoryUpdateHandler): () => void {
    this.userDirectoryHandlers.add(handler);
    return () => this.userDirectoryHandlers.delete(handler);
  }

  onConnect(handler: () => void): () => void {
    this.connectHandlers.add(handler);
    return () => this.connectHandlers.delete(handler);
  }

  /** Disconnect and clean up. */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export { WebSocketService };
export default WebSocketService;