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
      console.error('Failed to broadcast user directory:', err);
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

// Helper to broadcast the current board to all other clients after a mutation
async function broadcastBoard(excludeSocketId?: string): Promise<void> {
  try {
    const board = await persistence.loadBoard();
    wsController.broadcastBoardUpdate(board, excludeSocketId);
  } catch (err) {
    console.error('Failed to broadcast board update:', err);
  }
}

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.get('/api/board', async (req, res) => {
  try {
    const board = await persistence.loadBoard();
    res.json(board);
  } catch (error) {
    console.error('Failed to load board:', error);
    res.status(500).json({ error: 'Failed to load board' });
  }
});

app.post('/api/board', async (req, res) => {
  try {
    const board: BoardModel = req.body;
    await persistence.saveBoard(board);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to save board:', error);
    res.status(500).json({ error: 'Failed to save board' });
  }
});

app.post('/api/board/card', async (req, res) => {
  try {
    const card: Card = req.body;
    const board = await persistence.loadBoard();
    board.cards.push(card);
    await persistence.saveBoard(board);
    // Notify all other users of the change
    await broadcastBoard();
    res.json(board);
  } catch (error) {
    console.error('Failed to add card:', error);
    res.status(500).json({ error: 'Failed to add card' });
  }
});

app.post('/api/board/group', async (req, res) => {
  try {
    const group: Group = req.body;
    const board = await persistence.loadBoard();
    board.groups.push(group);
    await persistence.saveBoard(board);
    // Notify all other users of the change
    await broadcastBoard();
    res.json(board);
  } catch (error) {
    console.error('Failed to add group:', error);
    res.status(500).json({ error: 'Failed to add group' });
  }
});

app.put('/api/board/card/:id', async (req, res) => {
  try {
    const cardId = req.params.id;
    const updates: Partial<Card> = req.body;
    const board = await persistence.loadBoard();
    
    const cardIndex = board.cards.findIndex(card => card.id === cardId);
    if (cardIndex === -1) {
      return res.status(404).json({ error: 'Card not found' });
    }
    
    board.cards[cardIndex] = { ...board.cards[cardIndex], ...updates };
    await persistence.saveBoard(board);
    // Notify all other users of the change
    await broadcastBoard();
    res.json(board);
  } catch (error) {
    console.error('Failed to update card:', error);
    res.status(500).json({ error: 'Failed to update card' });
  }
});

app.put('/api/board/group/:id', async (req, res) => {
  try {
    const groupId = req.params.id;
    const updates: Partial<Group> = req.body;
    const board = await persistence.loadBoard();
    
    const groupIndex = board.groups.findIndex(group => group.id === groupId);
    if (groupIndex === -1) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    board.groups[groupIndex] = { ...board.groups[groupIndex], ...updates };
    await persistence.saveBoard(board);
    // Notify all other users of the change
    await broadcastBoard();
    res.json(board);
  } catch (error) {
    console.error('Failed to update group:', error);
    res.status(500).json({ error: 'Failed to update group' });
  }
});

app.delete('/api/board/card/:id', async (req, res) => {
  try {
    const cardId = req.params.id;
    const board = await persistence.loadBoard();

    const cardIndex = board.cards.findIndex(card => card.id === cardId);
    if (cardIndex === -1) {
      return res.status(404).json({ error: 'Card not found' });
    }

    board.cards.splice(cardIndex, 1);
    await persistence.saveBoard(board);
    // Notify all other users of the change
    await broadcastBoard();
    res.json(board);
  } catch (error) {
    console.error('Failed to delete card:', error);
    res.status(500).json({ error: 'Failed to delete card' });
  }
});

app.delete('/api/board/group/:id', async (req, res) => {
  try {
    const groupId = req.params.id;
    const board = await persistence.loadBoard();

    const groupIndex = board.groups.findIndex(group => group.id === groupId);
    if (groupIndex === -1) {
      return res.status(404).json({ error: 'Group not found' });
    }

    board.groups.splice(groupIndex, 1);
    board.cards = board.cards.map(card => (card.groupId === groupId ? { ...card, groupId: undefined } : card));
    await persistence.saveBoard(board);
    // Notify all other users of the change
    await broadcastBoard();
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