import { JSONPersistence } from './src/server/persistence/JSONPersistence';
import { Card } from './src/types/Card';
import { Group } from './src/types/Group';

async function testPersistence() {
  const persistence = new JSONPersistence();
  
  // Create a test board
  const testBoard = {
    cards: [
      {
        id: 'card-1',
        text: 'Test card',
        x: 100,
        y: 100,
        width: 200,
        height: 60,
        isSelected: false
      }
    ] as Card[],
    groups: [
      {
        id: 'group-1',
        label: 'Test group',
        x: 200,
        y: 200,
        width: 400,
        height: 400,
        isSelected: false
      }
    ] as Group[],
    lastUpdated: new Date().toISOString()
  };
  
  // Save the board
  await persistence.saveBoard(testBoard);
  console.log('Board saved successfully');
  
  // Load the board
  const loadedBoard = await persistence.loadBoard();
  console.log('Board loaded successfully:', loadedBoard);
  
  // Create a backup
  await persistence.createBackup();
  console.log('Backup created successfully');
}

testPersistence().catch(console.error);