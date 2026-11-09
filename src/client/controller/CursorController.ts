import { WebSocketService } from '../services/WebSocketService.js';
import type { CursorPosition } from '../../types/Cursor.js';
import type { User } from '../../types/User.js';

export interface CursorControllerOptions {
  /** Throttle interval for local cursor emits in milliseconds. Defaults to 300ms. */
  emitIntervalMs?: number;
}

export class CursorController {
  private static instance: CursorController;

  private ws = WebSocketService.getInstance();
  private cursors = new Map<string, CursorPosition>(); // keyed by userId
  private subscribers = new Set<(cursors: CursorPosition[]) => void>();
  private emitIntervalMs: number;
  private lastEmit = 0;
  private localUserId: string | null = null;
  private unsubscribeCursor?: () => void;

  private constructor(options: CursorControllerOptions = {}) {
    this.emitIntervalMs = options.emitIntervalMs ?? 300;
  }

  public static getInstance(options?: CursorControllerOptions): CursorController {
    if (!CursorController.instance) {
      CursorController.instance = new CursorController(options);
    }
    return CursorController.instance;
  }

  /** Set the local user id so the local cursor is excluded from remote cursors. */
  setLocalUserId(userId: string | null): void {
    this.localUserId = userId;
    this.notify();
  }

  /** Connect to cursor updates. Safe to call multiple times. */
  connect(): void {
    if (this.unsubscribeCursor) return;

    this.unsubscribeCursor = this.ws.onCursorUpdate((payload) => {
      const next = new Map<string, CursorPosition>();
      for (const c of payload.cursors) {
        if (this.localUserId && c.userId === this.localUserId) continue;
        next.set(c.userId, c);
      }
      this.cursors = next;
      this.notify();
    });
  }

  /** Disconnect and clean up. */
  disconnect(): void {
    this.unsubscribeCursor?.();
    this.unsubscribeCursor = undefined;
    this.cursors.clear();
    this.subscribers.clear();
  }

  /** Emit the local cursor position (throttled to emitIntervalMs). */
  emitPosition(user: User, x: number, y: number): void {
    const now = Date.now();
    if (now - this.lastEmit < this.emitIntervalMs) return;
    this.lastEmit = now;
    this.localUserId = user.id;
    this.ws.emitCursorMove({ userId: user.id, userName: user.name, color: user.color, x, y });
  }

  /** Get all remote cursors (local user excluded). */
  getCursors(): CursorPosition[] {
    return Array.from(this.cursors.values());
  }

  /** Subscribe to cursor changes. Returns an unsubscribe function. */
  onCursorChange(handler: (cursors: CursorPosition[]) => void): () => void {
    this.subscribers.add(handler);
    return () => this.subscribers.delete(handler);
  }

  private notify(): void {
    const cursors = Array.from(this.cursors.values());
    this.subscribers.forEach((handler) => handler(cursors));
  }
}

export default CursorController;
