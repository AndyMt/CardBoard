import express from 'express';
import path from 'path';
import { JSONPersistence } from './persistence/JSONPersistence';
import { BoardModel } from './model/BoardModel';
import cors from 'cors';
import { UserPersistence } from './persistence/UserPersistence';
import { normalizeBoardModel } from '../shared/userColorNormalization.js';

const app = express();
const port = 8080;
const persistence = new JSONPersistence();
const userPersistence = new UserPersistence();

// Middleware
app.use(cors());
app.use(express.json());

// API Endpoints
app.get('/api/board', async (req, res) => {
  try {
    const board = await persistence.loadBoard();
    const users = await userPersistence.loadUsers();
    const normalized = normalizeBoardModel(board, users.users || []);
    if (normalized.changed) {
      await persistence.saveBoard(normalized.board);
    }
    res.json(normalized.board);
  } catch (error) {
    console.error('Failed to load board:', error);
    res.status(500).json({ error: 'Failed to load board' });
  }
});

app.post('/api/board', async (req, res) => {
  try {
    const board: BoardModel = req.body;
    const users = await userPersistence.loadUsers();
    const normalized = normalizeBoardModel(board, users.users || []);
    await persistence.saveBoard(normalized.board);
    res.json({ success: true, board: normalized.board });
  } catch (error) {
    console.error('Failed to save board:', error);
    res.status(500).json({ error: 'Failed to save board' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});