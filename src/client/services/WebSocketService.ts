import { io, Socket } from 'socket.io-client';
import type { Card } from '../../types/Card';
import type { Group } from '../../types/Group';

/**
 * WebSocketService wraps the socket.io-client connection to the server.
 *
 * It is a singleton so every component can share the same underlying socket.
 * Events emitted by the server:
 *  - board:update        -> full board snapshot (cards + groups)
 *  - board:live-update   -> throttled drag position preview for other users
 *  - users:update        -> number of currently connected users
 */

export const BOARD_UPDATE_EVENT = 'board:update';
export const BOARD_LIVE_UPDATE_EVENT = 'board:live-update';
export const USERS_UPDATE_EVENT = 'users:update';
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
}

type BoardUpdateHandler = (payload: BoardUpdatePayload) => void;
type LiveUpdateHandler = (payload: LiveUpdatePayload) => void;
type UsersUpdateHandler = (payload: UsersUpdatePayload) => void;

class WebSocketService {
  private static instance: WebSocketService;

  private socket: Socket | null = null;
  private url: string;
  private boardUpdateHandlers = new Set<BoardUpdateHandler>();
  private liveUpdateHandlers = new Set<LiveUpdateHandler>();
  private usersUpdateHandlers = new Set<UsersUpdateHandler>();

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
      console.log('[WS] connected', this.socket?.id);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[WS] disconnected', reason);
    });

    this.socket.on(BOARD_UPDATE_EVENT, (payload: BoardUpdatePayload) => {
      console.log('[WS] received board:update', payload);
      this.boardUpdateHandlers.forEach((handler) => handler(payload));
    });

    this.socket.on(BOARD_LIVE_UPDATE_EVENT, (payload: LiveUpdatePayload) => {
      console.log('[WS] received board:live-update', payload);
      this.liveUpdateHandlers.forEach((handler) => handler(payload));
    });

    this.socket.on(USERS_UPDATE_EVENT, (payload: UsersUpdatePayload) => {
      console.log('[WS] received users:update', payload);
      this.usersUpdateHandlers.forEach((handler) => handler(payload));
    });

    this.socket.on('connect_error', (err: Error) => {
      console.error('[WS] connection error:', err);
    });

    return this.socket;
  }

  /** True when the socket is connected. */
  isConnected(): boolean {
    return !!this.socket && this.socket.connected;
  }

  /** Send a live drag position preview to the server (throttled server-side). */
  emitLiveDrag(payload: LiveUpdatePayload): void {
    console.log('[WS] emitting live:drag', payload);
    if (!this.socket) return;
    this.socket.emit(LIVE_DRAG_EVENT, payload);
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

  /** Disconnect and clean up. */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export default WebSocketService;