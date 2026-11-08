import type { User } from '../../types/User.js';
import type { BoardModel } from '../model/BoardModel.js';
import { normalizeBoardModel } from '../../shared/userColorNormalization.js';
import type { UserService } from '../services/UserService.js';
import type { WebSocketController } from '../controller/WebSocketController.js';

export interface NormalizeBoardOptions {
  users?: User[] | null;
  persistIfChanged?: boolean;
  broadcastIfChanged?: boolean;
  excludeSocketId?: string;
}

export async function normalizeBoard(
  userService: UserService,
  board: BoardModel,
  users?: User[] | null,
): Promise<BoardModel> {
  let resolvedUsers = users;
  if (!resolvedUsers) {
    try {
      resolvedUsers = await userService.listUsers();
    } catch {
      return board;
    }
  }
  if (!Array.isArray(resolvedUsers)) {
    return board;
  }
  return normalizeBoardModel(board, resolvedUsers).board;
}

export async function normalizeAndOptionallyPersistBoard(
  _persistence: unknown,
  userService: UserService,
  wsController: WebSocketController | null,
  board: BoardModel,
  options: NormalizeBoardOptions = {},
): Promise<BoardModel> {
  // Read-only / legacy-safe: normalization is computed in-memory only.
  // Explicit local mutations must persist via JSONPersistence.mutateBoard.
  const normalized = await normalizeBoard(userService, board, options.users);
  if (options.persistIfChanged) {
    console.warn('[board] persistIfChanged requested outside atomic local mutation; ignored');
  }
  if (options.broadcastIfChanged && wsController) {
    wsController.broadcastBoardUpdate(normalized, options.excludeSocketId);
  }
  return normalized;
}
