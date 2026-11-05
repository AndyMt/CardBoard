import { useState, useEffect } from 'react';
import { DndContext, DragEndEvent } from '@dnd-kit/core';
import Card from './Card.js';
import Group from './Group.js';
import { Card as CardType } from '../../types/Card';
import { Group as GroupType } from '../../types/Group';
import BoardService from '../services/BoardService';

interface BoardViewProps {
  selectedTool: 'select' | 'card' | 'group';
}

// Helper functions for model operations (client-side only)
const createDefaultCard = (x: number, y: number): CardType => {
  return {
    id: `card-${Date.now()}`,
    text: '',
    x: x - 100, // Center the card on click position
    y: y - 30,  // Account for card height
    width: 200, // Default card width
    height: 60, // Default card height
    isSelected: false,
  };
};

const createDefaultGroup = (x: number, y: number): GroupType => {
  return {
    id: `group-${Date.now()}`,
    label: '',
    x: x - 220, // Center the group on click position
    y: y - 30,  // Account for group header height
    width: 440, // Default group width
    height: 440, // Default group height
    isSelected: false,
  };
};

export const BoardView: React.FC<BoardViewProps> = ({ selectedTool }) => {
  const [cards, setCards] = useState<CardType[]>([]);
  const [groups, setGroups] = useState<GroupType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  // Load board data on component mount
  useEffect(() => {
    const loadBoard = async () => {
      try {
        const boardService = BoardService.getInstance();
        const { cards, groups } = await boardService.getBoard();
        setCards(cards);
        setGroups(groups);
      } catch (err) {
        console.error('Failed to load board:', err);
        setError('Failed to load board data');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadBoard();
  }, []);

  if (isLoading) {
    return (
      <div className="relative w-full h-full bg-gray-100 overflow-auto flex items-center justify-center">
        <div>Loading board...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative w-full h-full bg-gray-100 overflow-auto flex items-center justify-center">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;

    if (active.data.current?.type === 'card') {
      setCards(prevCards => prevCards.map(card => {
        if (card.id === active.id) {
          const updatedCard = {
            ...card,
            x: card.x + delta.x,
            y: card.y + delta.y,
          };
          
          // Update card position in persistence
          const boardService = BoardService.getInstance();
          boardService.updateCard(card.id, {
            x: updatedCard.x,
            y: updatedCard.y
          }).catch(err => {
            console.error('Failed to update card position:', err);
          });
          
          return updatedCard;
        }
        return card;
      }));
    } else if (active.data.current?.type === 'group') {
      setGroups(prevGroups => prevGroups.map(group => {
        if (group.id === active.id) {
          const updatedGroup = {
            ...group,
            x: group.x + delta.x,
            y: group.y + delta.y,
          };
          
          // Update group position in persistence
          const boardService = BoardService.getInstance();
          boardService.updateGroup(group.id, {
            x: updatedGroup.x,
            y: updatedGroup.y
          }).catch(err => {
            console.error('Failed to update group position:', err);
          });
          
          return updatedGroup;
        }
        return group;
      }));
    }
  };

  const handleCardTextChange = (id: string, newText: string) => {
    setCards(prevCards => prevCards.map(card => {
      if (card.id === id) {
        const updatedCard = { ...card, text: newText };
        
        // Update card text in persistence
        const boardService = BoardService.getInstance();
        boardService.updateCard(id, { text: newText }).catch(err => {
          console.error('Failed to update card text:', err);
        });
        
        return updatedCard;
      }
      return card;
    }));
  };

  const handleGroupLabelChange = (id: string, newLabel: string) => {
    setGroups(prevGroups => prevGroups.map(group => {
      if (group.id === id) {
        const updatedGroup = { ...group, label: newLabel };
        
        // Update group label in persistence
        const boardService = BoardService.getInstance();
        boardService.updateGroup(id, { label: newLabel }).catch(err => {
          console.error('Failed to update group label:', err);
        });
        
        return updatedGroup;
      }
      return group;
    }));
  };

  const handleSelect = (id: string, ctrlKey: boolean = false) => {
    setSelectedItems(prev => {
      // If Ctrl key is pressed, toggle the selection state of the item
      if (ctrlKey) {
        if (prev.includes(id)) {
          return prev.filter(itemId => itemId !== id);
        } else {
          return [...prev, id];
        }
      }
      // If Ctrl key is not pressed, replace the selection with the clicked item
      else {
        // If already selected, deselect it
        if (prev.length === 1 && prev[0] === id) {
          return [];
        }
        // Otherwise select this item
        else {
          return [id];
        }
      }
    });
  };

  const handleKeyDown = async (e: KeyboardEvent) => {
    console.log('Key pressed:', e.key); // Debug: Log the pressed key
    if (e.key === 'Delete' && selectedItems.length > 0) {
      console.log('Delete key pressed. Selected items:', selectedItems); // Debug: Log selected items
      e.preventDefault();
      
      // Delete all selected cards and groups
      try {
        const boardService = BoardService.getInstance();
        
        // Delete selected cards and groups
        for (const id of selectedItems) {
          const isCard = cards.some(card => card.id === id);
          const isGroup = groups.some(group => group.id === id);
          
          if (isCard) {
            await boardService.deleteCard(id);
          } else if (isGroup) {
            await boardService.deleteGroup(id);
          }
        }
        
        // Update state
        setCards(prevCards => prevCards.filter(card => !selectedItems.includes(card.id)));
        setGroups(prevGroups => prevGroups.filter(group => !selectedItems.includes(group.id)));
        setSelectedItems([]);
      } catch (err) {
        console.error('Failed to delete selected items:', err);
      }
    }
  };

  const handleBoardFocus = () => {
    const boardElement = document.querySelector('.board-container');
    if (boardElement) {
      boardElement.focus();
    }
  };

  const handleBoardClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    // Only handle clicks on the board background (empty space)
    if (e.target !== e.currentTarget) return;

    setSelectedItems([]);
    
    // Handle tool-specific actions
    if (selectedTool === 'select') {
      return;
    }
    
    // Get click position relative to board
    const boardRect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - boardRect.left;
    const y = e.clientY - boardRect.top;
    
    if (selectedTool === 'card') {
      // Create new card using client-side helper
      const newCard = createDefaultCard(x, y);
      
      // Add card to persistence
      try {
        const boardService = BoardService.getInstance();
        const { cards } = await boardService.addCard(newCard);
        setCards(cards);
      } catch (err) {
        console.error('Failed to add card:', err);
      }
    } else if (selectedTool === 'group') {
      // Create new group using client-side helper
      const newGroup = createDefaultGroup(x, y);
      
      // Add group to persistence
      try {
        const boardService = BoardService.getInstance();
        const { groups } = await boardService.addGroup(newGroup);
        setGroups(groups);
      } catch (err) {
        console.error('Failed to add group:', err);
      }
    }
  };

  // Debug: Show selected items
  console.log('Selected items:', selectedItems);
  
  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div
        className="relative w-full h-full bg-gray-100 overflow-auto board-container"
        onClick={(e) => {
          handleBoardClick(e);
          handleBoardFocus();
        }}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {/* Debug: Show selected items count */}
        <div className="absolute top-4 left-4 bg-white p-2 rounded shadow z-50">
          Selected: {selectedItems.length} items
        </div>
        {/* Groups */}
        {groups.map(group => {
          const isGroupSelected = selectedItems.includes(group.id);
          console.log(`Group ${group.id}: isSelected = ${isGroupSelected}`);
          
          return (
            <Group
              key={group.id}
              id={group.id}
              label={group.label}
              x={group.x}
              y={group.y}
              width={group.width || 440}
              height={group.height || 440}
              isSelected={isGroupSelected}
              onLabelChange={handleGroupLabelChange}
              onSelect={handleSelect}
            />
          );
        })}
        
        {/* Cards */}
        {cards.map(card => {
          const isCardSelected = selectedItems.includes(card.id);
          console.log(`Card ${card.id}: isSelected = ${isCardSelected}`);
          
          return (
            <Card
              key={card.id}
              id={card.id}
              text={card.text}
              x={card.x}
              y={card.y}
              width={card.width || 200}
              height={card.height || 60}

              isSelected={isCardSelected}
              onSelect={handleSelect}
              onTextChange={handleCardTextChange}
            />
          );
        })}
      </div>
    </DndContext>
  );
};

export default BoardView;