import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import path from 'path';
import type { Card } from '../types/Card.js';
import type { Group } from '../types/Group.js';
import type { User } from '../types/User.js';
import { JSONPersistence } from './persistence/JSONPersistence.js';
import { BoardModel } from './model/BoardModel';
import { UserService } from './services/UserService.js';
import { WebSocketController } from './controller/WebSocketController.js';
import { CursorService } from './services/CursorService.js';
import { quantizeGeometry, quantizeGeometryUpdates } from '../shared/geometry.js';
import { buildBoardExportCsv, getExportFilename, type BoardExportType } from './utils/csvExport.js';
import { normalizeBoard } from './utils/boardNormalization.js';

const app = express();
const port = process.env.PORT || 8080;

// Initialize persistence
const persistence = new JSONPersistence();
const userService = new UserService({
  onUsersChanged: async () => {
    try {
      const users = await userService.listUsers();
      wsController.broadcastUsersDirectory(users);
    } catch (err) {
      console.error('Failed to handle user directory change:', err);
    }
  },
});

// Create HTTP server and Socket.IO server for real-time updates
const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});
const wsController = new WebSocketController(io);
const cursorService = new CursorService(io);

function senderSocketId(req: express.Request): string | undefined {
  const id = req.headers['x-socket-id'];
  return typeof id === 'string' ? id : undefined;
}

async function getBoardView(): Promise<BoardModel> {
  const board = await persistence.readBoard();
  return normalizeBoard(userService, board);
}

async function localMutation(
  mutate: (board: BoardModel) => BoardModel | void,
  excludeSocketId?: string,
): Promise<BoardModel> {
  const saved = await persistence.mutateBoard(async (board) => {
    const draft = { ...board, cards: [...board.cards], groups: [...board.groups] };
    const result = mutate(draft);
    const next = result || draft;
    return normalizeBoard(userService, next);
  });
  wsController.broadcastBoardUpdate(saved, excludeSocketId);
  return saved;
}

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.get('/api/board/export', async (req, res) => {
  try {
    const type = req.query.type;
    if (type !== 'cards' && type !== 'groups' && type !== 'mapping') {
      return res.status(400).json({ error: 'Invalid export type. Expected cards, groups, or mapping.' });
    }
    const board = await getBoardView();
    const csv = buildBoardExportCsv(type as BoardExportType, board);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${getExportFilename(type)}"`);
    res.send(csv);
  } catch (error) {
    console.error('Failed to export board:', error);
    res.status(500).json({ error: 'Failed to export board' });
  }
});

app.get('/api/board', async (req, res) => {
  try {
    const board = await getBoardView();
    res.json(board);
  } catch (error) {
    console.error('Failed to load board:', error);
    res.status(500).json({ error: 'Failed to load board' });
  }
});

app.post('/api/board', async (req, res) => {
  try {
    const incoming = req.body as BoardModel;
    const board = await localMutation(() => ({
      cards: Array.isArray(incoming?.cards) ? incoming.cards.map((c: Card) => quantizeGeometry(c)) : [],
      groups: Array.isArray(incoming?.groups) ? incoming.groups.map((g: Group) => quantizeGeometry(g)) : [],
      lastUpdated: incoming?.lastUpdated || new Date().toISOString(),
    }), senderSocketId(req));
    res.json({ success: true, board });
  } catch (error) {
    console.error('Failed to save board:', error);
    res.status(500).json({ error: 'Failed to save board' });
  }
});

app.post('/api/board/card', async (req, res) => {
  try {
    const card: Card = quantizeGeometry(req.body);
    const board = await localMutation((b) => {
      b.cards.push(card);
    }, senderSocketId(req));
    res.json(board);
  } catch (error) {
    console.error('Failed to add card:', error);
    res.status(500).json({ error: 'Failed to add card' });
  }
});

app.post('/api/board/group', async (req, res) => {
  try {
    const group: Group = quantizeGeometry(req.body);
    const board = await localMutation((b) => {
      b.groups.push(group);
    }, senderSocketId(req));
    res.json(board);
  } catch (error) {
    console.error('Failed to add group:', error);
    res.status(500).json({ error: 'Failed to add group' });
  }
});

function applyCardUpdate(board: BoardModel, cardId: string, updates: Partial<Card>): boolean {
  const idx = board.cards.findIndex(card => card.id === cardId);
  if (idx === -1) return false;
  const next = { ...board.cards[idx], ...quantizeGeometryUpdates(updates) } as Card;
  if ((updates as { groupId?: string | null }).groupId === null) next.groupId = undefined;
  board.cards[idx] = next;
  return true;
}

function applyGroupUpdate(board: BoardModel, groupId: string, updates: Partial<Group>): boolean {
  const idx = board.groups.findIndex(group => group.id === groupId);
  if (idx === -1) return false;
  board.groups[idx] = { ...board.groups[idx], ...quantizeGeometryUpdates(updates) } as Group;
  return true;
}

app.put('/api/board/card/:id', async (req, res) => {
  try {
    const cardId = req.params.id;
    const updates: Partial<Card> = req.body || {};
    let found = false;
    const board = await localMutation((b) => {
      found = applyCardUpdate(b, cardId, updates);
    }, senderSocketId(req));
    if (!found) return res.status(404).json({ error: 'Card not found' });
    res.json(board);
  } catch (error) {
    console.error('Failed to update card:', error);
    res.status(500).json({ error: 'Failed to update card' });
  }
});

app.put('/api/board/group/:id', async (req, res) => {
  try {
    const groupId = req.params.id;
    const updates: Partial<Group> = req.body || {};
    let found = false;
    const board = await localMutation((b) => {
      found = applyGroupUpdate(b, groupId, updates);
    }, senderSocketId(req));
    if (!found) return res.status(404).json({ error: 'Group not found' });
    res.json(board);
  } catch (error) {
    console.error('Failed to update group:', error);
    res.status(500).json({ error: 'Failed to update group' });
  }
});

app.put('/api/board/batch', async (req, res) => {
  try {
    const cardUpdates = Array.isArray(req.body?.cards) ? req.body.cards as Array<{ id: string } & Partial<Card>> : [];
    const groupUpdates = Array.isArray(req.body?.groups) ? req.body.groups as Array<{ id: string } & Partial<Group>> : [];
    const board = await localMutation((b) => {
      for (const item of groupUpdates) {
        if (!item?.id) continue;
        const { id, ...updates } = item;
        applyGroupUpdate(b, id, updates as Partial<Group>);
      }
      for (const item of cardUpdates) {
        if (!item?.id) continue;
        const { id, ...updates } = item;
        applyCardUpdate(b, id, updates as Partial<Card>);
      }
    }, senderSocketId(req));
    res.json(board);
  } catch (error) {
    console.error('Failed to batch update board:', error);
    res.status(500).json({ error: 'Failed to batch update board' });
  }
});

app.delete('/api/board/card/:id', async (req, res) => {
  try {
    const cardId = req.params.id;
    let found = false;
    const board = await localMutation((b) => {
      const idx = b.cards.findIndex(card => card.id === cardId);
      if (idx === -1) return;
      found = true;
      b.cards.splice(idx, 1);
    }, senderSocketId(req));
    if (!found) return res.status(404).json({ error: 'Card not found' });
    res.json(board);
  } catch (error) {
    console.error('Failed to delete card:', error);
    res.status(500).json({ error: 'Failed to delete card' });
  }
});

app.delete('/api/board/group/:id', async (req, res) => {
  try {
    const groupId = req.params.id;
    let found = false;
    const board = await localMutation((b) => {
      const idx = b.groups.findIndex(group => group.id === groupId);
      if (idx === -1) return;
      found = true;
      b.groups.splice(idx, 1);
      b.cards = b.cards.map(card => (card.groupId === groupId ? { ...card, groupId: undefined } : card));
    }, senderSocketId(req));
    if (!found) return res.status(404).json({ error: 'Group not found' });
    res.json(board);
  } catch (error) {
    console.error('Failed to delete group:', error);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

// User routes
app.get('/api/users', async (req, res) => {
  try {
    const users = await userService.listUsers();
    res.json({ users });
  } catch (error) {
    console.error('Failed to get users:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

app.get('/api/users/:name', async (req, res) => {
  try {
    const name = req.params.name;
    const user = await userService.findUserByName(name);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Failed to get user:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { name, color } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Name is required' });
    }

    const existing = await userService.findUserByName(name.trim());
    if (existing) {
      return res.json({ user: existing, created: false });
    }

    const allUsers = await userService.listUsers();
    const colorTaken = allUsers.some(u => u.color === color);
    if (colorTaken) {
      return res.status(409).json({ error: 'Color already taken' });
    }

    const result = await userService.createUser(name.trim(), color);
    res.status(201).json({ user: result.user, created: result.created });
  } catch (error) {
    console.error('Failed to create user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const updates: Partial<User> = req.body;
    const user = await userService.updateUser(id, updates);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Failed to update user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const removed = await userService.removeUser(id);
    if (!removed) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Serve frontend in production (single-image Docker setup)
if (process.env.NODE_ENV === 'production') {
  const buildDir = path.join(process.cwd(), 'build');
  app.use(express.static(buildDir));
  app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
    res.sendFile(path.join(buildDir, 'index.html'));
  });
}

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server (HTTP server is shared with Socket.IO for real-time updates)
httpServer.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

export default app;
export { wsController };
