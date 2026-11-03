import express from 'express';
import cors from 'cors';
import path from 'path';
import { JSONPersistence } from './persistence/JSONPersistence.js';
import { BoardModel } from './model/BoardModel';
import { Card } from './model/Card';
import { Group } from './model/Group';

const app = express();
const port = process.env.PORT || 8080;

// Initialize persistence
const persistence = new JSONPersistence();

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
    res.json(board);
  } catch (error) {
    console.error('Failed to update group:', error);
    res.status(500).json({ error: 'Failed to update group' });
  }
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

export default app;