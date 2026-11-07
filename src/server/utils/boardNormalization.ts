import type { User } from '../../types/User.js';
import type { BoardModel } from '../model/BoardModel.js';
import { normalizeBoardModel } from '../../shared/userColorNormalization.js';
import type { UserService } from '../services/UserService.js';
import type { JSONPersistence } from '../persistence/JSONPersistence.js';
import type { WebSocketController } from '../controller/WebSocketController.js';

export interface NormalizeBoardOptions {
  users?: User[] | null;
  persistIfChanged?: boolean;
  broadcastIfChanged?: boolean;
  excludeSocketId?: string;
}

export async function normalizeAndOptionallyPersistBoard(
  persistence: JSONPersistence,
  userService: UserService,
  wsController: WebSocketController | null,
  board: BoardModel,
  options: NormalizeBoardOptions = {},
): Promise<BoardModel> {
  let users = options.users;
  if (!users) {
    try {
      users = await userService.listUsers();
    } catch {
      return board;
    }
  }
  if (!Array.isArray(users)) {
    return board;
  }

  const normalized = normalizeBoardModel(board, users);
  if (!normalized.changed) {
    return normalized.board;
  }

  if (options.persistIfChanged) {
    await persistence.saveBoard(normalized.board);
  }
  if (options.broadcastIfChanged && wsController) {
    wsController.broadcastBoardUpdate(normalized.board, options.excludeSocketId);
  }
  return normalized.board;
}
