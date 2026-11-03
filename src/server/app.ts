import express from 'express';
import path from 'path';
import { JSONPersistence } from './persistence/JSONPersistence';
import { BoardModel } from './model/BoardModel';
import cors from 'cors';

const app = express();
const port = 8080;
const persistence = new JSONPersistence();

// Middleware
app.use(cors());
app.use(express.json());

// API Endpoints
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

// Start server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});