const express = require('express');
const cors = require('cors');
const path = require('path');
const { JSONPersistence } = require('./persistence/JSONPersistence.cjs');
const { UserPersistence } = require('./persistence/UserPersistence.cjs');

const app = express();
const port = process.env.PORT || 8080;

// Initialize persistence
const persistence = new JSONPersistence();
const userPersistence = new UserPersistence();

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
    const board = req.body;
    await persistence.saveBoard(board);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to save board:', error);
    res.status(500).json({ error: 'Failed to save board' });
  }
});

app.post('/api/board/card', async (req, res) => {
  try {
    const card = req.body;
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
    const group = req.body;
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
    const updates = req.body;
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
    const updates = req.body;
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
    await persistence.saveBoard(board);
    res.json(board);
  } catch (error) {
    console.error('Failed to delete group:', error);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

// User routes
app.get('/api/users', async (req, res) => {
  try {
    const data = await userPersistence.loadUsers();
    res.json(data);
  } catch (error) {
    console.error('Failed to get users:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

app.get('/api/users/:name', async (req, res) => {
  try {
    const name = req.params.name;
    const user = await userPersistence.findUserByName(name);
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

    const existing = await userPersistence.findUserByName(name.trim());
    if (existing) {
      return res.json({ user: existing, created: false });
    }

    const allUsers = await userPersistence.loadUsers();
    const colorTaken = allUsers.users.some(u => u.color === color);
    if (colorTaken) {
      return res.status(409).json({ error: 'Color already taken' });
    }

    const result = await userPersistence.createUser(name.trim(), color);
    res.status(201).json({ user: result.user, created: result.created });
  } catch (error) {
    console.error('Failed to create user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

module.exports = app;