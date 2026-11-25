import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import path from 'path';
import { randomUUID } from 'crypto';
import type { Card } from '../types/Card.js';
import type { Group } from '../types/Group.js';
import type { User } from '../types/User.js';
import type { View } from '../types/View.js';
import type { Reference } from '../types/Reference.js';
import type { BoardModel } from './model/BoardModel.js';
import { JSONPersistence } from './persistence/JSONPersistence.js';
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
    const draft = {
      cards: [...board.cards],
      groups: [...board.groups],
      views: [...board.views],
      references: [...board.references],
      lastUpdated: board.lastUpdated,
    };
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
    const csv = buildBoardExportCsv(type as BoardExportType, {
      cards: board.cards,
      groups: board.groups,
      references: board.references,
    });
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

// Views
app.get('/api/board/views', async (req, res) => {
  try {
    const board = await persistence.readBoard();
    res.json(board.views);
  } catch (error) {
    console.error('Failed to load views:', error);
    res.status(500).json({ error: 'Failed to load views' });
  }
});

app.post('/api/board/view', async (req, res) => {
  try {
    const view: View = req.body;
    const board = await localMutation((b) => {
      b.views.push(view);
    }, senderSocketId(req));
    res.json({ success: true, board });
  } catch (error) {
    console.error('Failed to add view:', error);
    res.status(500).json({ error: 'Failed to add view' });
  }
});

app.post('/api/board', async (req, res) => {
  try {
    const incoming = req.body as BoardModel;
    const board = await localMutation(() => ({
      cards: Array.isArray(incoming?.cards) ? incoming.cards : [],
      groups: Array.isArray(incoming?.groups) ? incoming.groups : [],
      views: Array.isArray(incoming?.views) ? incoming.views : [],
      references: Array.isArray(incoming?.references) ? incoming.references.map((r: Reference) => quantizeGeometry(r)) : [],
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
    const card: Card = req.body;
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
    const group: Group = req.body;
    const board = await localMutation((b) => {
      b.groups.push(group);
    }, senderSocketId(req));
    res.json(board);
  } catch (error) {
    console.error('Failed to add group:', error);
    res.status(500).json({ error: 'Failed to add group' });
  }
});

// References (view-specific placement: position, size, group membership)
app.post('/api/board/reference', async (req, res) => {
  try {
    const reference: Reference = quantizeGeometry(req.body);
    const board = await localMutation((b) => {
      b.references.push(reference);
    }, senderSocketId(req));
    res.json(board);
  } catch (error) {
    console.error('Failed to add reference:', error);
    res.status(500).json({ error: 'Failed to add reference' });
  }
});

app.put('/api/board/reference/:id', async (req, res) => {
  try {
    const referenceId = req.params.id;
    const updates: Partial<Reference> = req.body || {};
    let found = false;
    const board = await localMutation((b) => {
      const idx = b.references.findIndex((r) => r.id === referenceId);
      if (idx === -1) return;
      found = true;
      b.references[idx] = { ...b.references[idx], ...quantizeGeometryUpdates(updates) };
    }, senderSocketId(req));
    if (!found) return res.status(404).json({ error: 'Reference not found' });
    res.json(board);
  } catch (error) {
    console.error('Failed to update reference:', error);
    res.status(500).json({ error: 'Failed to update reference' });
  }
});

app.delete('/api/board/reference/:id', async (req, res) => {
  try {
    const referenceId = req.params.id;
    let found = false;
    const board = await localMutation((b) => {
      const idx = b.references.findIndex((r) => r.id === referenceId);
      if (idx === -1) return;
      found = true;
      b.references.splice(idx, 1);
    }, senderSocketId(req));
    if (!found) return res.status(404).json({ error: 'Reference not found' });
    res.json(board);
  } catch (error) {
    console.error('Failed to delete reference:', error);
    res.status(500).json({ error: 'Failed to delete reference' });
  }
});

function applyCardUpdate(board: BoardModel, cardId: string, updates: Partial<Card>): boolean {
  const idx = board.cards.findIndex((card) => card.id === cardId);
  if (idx === -1) return false;
  const next: Card = { ...board.cards[idx] };
  if (updates.text !== undefined) next.text = updates.text;
  if (updates.createdBy !== undefined) next.createdBy = updates.createdBy;
  if (updates.createdColor !== undefined) next.createdColor = updates.createdColor;
  board.cards[idx] = next;
  return true;
}

function applyGroupUpdate(board: BoardModel, groupId: string, updates: Partial<Group>): boolean {
  const idx = board.groups.findIndex((group) => group.id === groupId);
  if (idx === -1) return false;
  board.groups[idx] = { ...board.groups[idx], ...updates };
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

app.put('/api/board/card/:id/connections', async (req, res) => {
  try {
    const cardId = req.params.id;
    const { targetCardId }: { targetCardId?: string } = req.body || {};
    if (!targetCardId) {
      return res.status(400).json({ error: 'targetCardId is required' });
    }
    if (cardId === targetCardId) {
      return res.status(400).json({ error: 'Cannot connect a card to itself' });
    }
    const connectionId = randomUUID();
    const board = await localMutation((b) => {
      const sourceCard = b.cards.find((card) => card.id === cardId);
      const targetCard = b.cards.find((card) => card.id === targetCardId);
      if (!sourceCard || !targetCard) return;
      if (!sourceCard.connections) sourceCard.connections = [];
      sourceCard.connections.push({ id: connectionId, targetCardId });
    }, senderSocketId(req));
    res.json({ ...board, connectionId });
  } catch (error) {
    console.error('Failed to add connection:', error);
    res.status(500).json({ error: 'Failed to add connection' });
  }
});

app.delete('/api/board/card/:id/connections/:connectionId', async (req, res) => {
  try {
    const cardId = req.params.id;
    const connectionId = req.params.connectionId;
    const board = await localMutation((b) => {
      const sourceCard = b.cards.find((card) => card.id === cardId);
      if (!sourceCard || !sourceCard.connections) return;
      sourceCard.connections = sourceCard.connections.filter((c) => c.id !== connectionId);
    }, senderSocketId(req));
    res.json(board);
  } catch (error) {
    console.error('Failed to remove connection:', error);
    res.status(500).json({ error: 'Failed to remove connection' });
  }
});

app.put('/api/board/card/:id/connections/:connectionId/name', async (req, res) => {
  try {
    const cardId = req.params.id;
    const connectionId = req.params.connectionId;
    const { name }: { name?: string } = req.body || {};
    const board = await localMutation((b) => {
      const sourceCard = b.cards.find((card) => card.id === cardId);
      if (!sourceCard || !sourceCard.connections) return;
      const conn = sourceCard.connections.find((c: { id: string }) => c.id === connectionId);
      if (!conn) return;
      conn.name = name ?? '';
    }, senderSocketId(req));
    res.json(board);
  } catch (error) {
    console.error('Failed to update connection name:', error);
    res.status(500).json({ error: 'Failed to update connection name' });
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
    const referenceUpdates = Array.isArray(req.body?.references)
      ? req.body.references as Array<{ id: string } & Partial<Reference>>
      : [];
    const board = await localMutation((b) => {
      for (const item of referenceUpdates) {
        if (!item?.id) continue;
        const { id, ...updates } = item;
        const idx = b.references.findIndex((r) => r.id === id);
        if (idx === -1) continue;
        b.references[idx] = { ...b.references[idx], ...quantizeGeometryUpdates(updates) };
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
      const idx = b.cards.findIndex((card) => card.id === cardId);
      if (idx === -1) return;
      found = true;
      b.cards.splice(idx, 1);
      b.references = b.references.filter((r) => !(r.elementId === cardId && r.elementType === 'card'));
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
      const idx = b.groups.findIndex((group) => group.id === groupId);
      if (idx === -1) return;
      found = true;
      b.groups.splice(idx, 1);
      b.references = b.references.filter((r) => !(r.elementId === groupId && r.elementType === 'group'));
      b.references = b.references.map((r) => (r.groupId === groupId ? { ...r, groupId: undefined } : r));
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
    const colorTaken = allUsers.some((u) => u.color === color);
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
    console.error('Failed to remove user:', error);
    res.status(500).json({ error: 'Failed to remove user' });
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
