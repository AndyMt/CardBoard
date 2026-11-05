import { useState, useEffect } from 'react';
import { DndContext, DragEndEvent, DragMoveEvent, DragStartEvent } from '@dnd-kit/core';
import Card from './Card.js';
import Group from './Group.js';
import { Card as CardType } from '../../types/Card';
import { Group as GroupType } from '../../types/Group';
import BoardService from '../services/BoardService';
import { ElementSelectionController } from '../controller/ElementSelectionController.js';
import { GroupSelectionController } from '../controller/GroupSelectionController.js';

interface BoardViewProps {
  selectedTool: 'select' | 'card' | 'group';
  onSelectionChange?: (count: number) => void;
  onToolChange?: (tool: 'select' | 'card' | 'group') => void;
}

// Helper functions for model operations (client-side only)
const createDefaultCard = (x: number, y: number): CardType => {
  return {
    id: `card-${Date.now()}`,
    text: '',
    x: Math.max(0, x - 100), // Center the card on click position
    y: Math.max(0, y - 30),  // Account for card height
    width: 200, // Default card width
    height: 60, // Default card height
    isSelected: false,
  };
};

const createDefaultGroup = (x: number, y: number): GroupType => {
  return {
    id: `group-${Date.now()}`,
    label: '',
    x: Math.max(0, x - 220), // Center the group on click position
    y: Math.max(0, y - 30),  // Account for group header height
    width: 440, // Default group width
    height: 440, // Default group height
    isSelected: false,
  };
};

export const BoardView: React.FC<BoardViewProps> = ({ selectedTool, onSelectionChange, onToolChange }) => {
  const [cards, setCards] = useState<CardType[]>([]);
  const [groups, setGroups] = useState<GroupType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [dragDelta, setDragDelta] = useState<{ x: number; y: number } | null>(null);
  const [dragStartedSelected, setDragStartedSelected] = useState<boolean>(false);

  useEffect(() => {
    onSelectionChange?.(selectedItems.length);
  }, [selectedItems, onSelectionChange]);

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

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string;
    setActiveDragId(id);
    setDragDelta({ x: 0, y: 0 });
    setDragStartedSelected(selectedItems.includes(id));
  };

  const handleDragMove = (event: DragMoveEvent) => {
    setDragDelta({ x: event.delta.x, y: event.delta.y });
    if (!dragStartedSelected && (event.delta.x !== 0 || event.delta.y !== 0)) {
      const id = event.active.id as string;
      setSelectedItems([id]);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    const boardService = BoardService.getInstance();

    const activeId = active.id as string;
    const activeType = active.data.current?.type;

    // If the dragged item is part of a multi-selection, move all selected items
    if (selectedItems.includes(activeId) && selectedItems.length > 1) {
      // Move all selected cards
      selectedItems.forEach(itemId => {
        const card = cards.find(c => c.id === itemId);
        if (card) {
          const startBoardX = card.x;
          const startBoardY = card.y;
          const newBoardX = Math.max(0, startBoardX + delta.x);
          const newBoardY = Math.max(0, startBoardY + delta.y);

          // Hit-test whether the card was dropped inside a group
          const targetGroup = groups.find(g => {
            const gw = g.width || 440;
            const gh = g.height || 440;
            return newBoardX >= g.x && newBoardX <= g.x + gw && newBoardY >= g.y && newBoardY <= g.y + gh;
          });

          const newGroupId = targetGroup ? targetGroup.id : undefined;
          const updatedCard = { ...card, x: newBoardX, y: newBoardY, groupId: newGroupId };

          setCards(prevCards => prevCards.map(c => (c.id === card.id ? updatedCard : c)));

          boardService.updateCard(card.id, {
            x: updatedCard.x,
            y: updatedCard.y,
            groupId: updatedCard.groupId
          }).catch(err => {
            console.error('Failed to update card position:', err);
          });
        }
      });

      // Move all selected groups
      selectedItems.forEach(itemId => {
        const group = groups.find(g => g.id === itemId);
        if (group) {
          const updatedGroup = {
            ...group,
            x: Math.max(0, group.x + delta.x),
            y: Math.max(0, group.y + delta.y),
          };

          setGroups(prevGroups => prevGroups.map(g => (g.id === group.id ? updatedGroup : g)));

          boardService.updateGroup(group.id, {
            x: updatedGroup.x,
            y: updatedGroup.y
          }).catch(err => {
            console.error('Failed to update group position:', err);
          });
        }
      });
      setActiveDragId(null);
      setDragDelta(null);
      setDragStartedSelected(false);
      return;
    }

    if (activeType === 'card') {
      const card = cards.find(c => c.id === activeId);
      if (!card) return;

      const startBoardX = card.x;
      const startBoardY = card.y;
      const newBoardX = Math.max(0, startBoardX + delta.x);
      const newBoardY = Math.max(0, startBoardY + delta.y);

      // Hit-test whether the card was dropped inside a group
      const targetGroup = groups.find(g => {
        const gw = g.width || 440;
        const gh = g.height || 440;
        return newBoardX >= g.x && newBoardX <= g.x + gw && newBoardY >= g.y && newBoardY <= g.y + gh;
      });

      const newGroupId = targetGroup ? targetGroup.id : undefined;
      const finalX = newBoardX;
      const finalY = newBoardY;

      const updatedCard = { ...card, x: finalX, y: finalY, groupId: newGroupId };

      setCards(prevCards => prevCards.map(c => (c.id === card.id ? updatedCard : c)));

      boardService.updateCard(card.id, {
        x: updatedCard.x,
        y: updatedCard.y,
        groupId: updatedCard.groupId
      }).catch(err => {
        console.error('Failed to update card position:', err);
      });
    } else if (activeType === 'group') {
      const containedCards = cards.filter(c => c.groupId === activeId);
      setGroups(prevGroups => prevGroups.map(group => {
        if (group.id === activeId) {
          const updatedGroup = {
            ...group,
            x: Math.max(0, group.x + delta.x),
            y: Math.max(0, group.y + delta.y),
          };
          boardService.updateGroup(group.id, { x: updatedGroup.x, y: updatedGroup.y }).catch(err => {
            console.error('Failed to update group position:', err);
          });
          return updatedGroup;
        }
        return group;
      }));
      containedCards.forEach(card => {
        const updatedCard = { ...card, x: Math.max(0, card.x + delta.x), y: Math.max(0, card.y + delta.y) };
        setCards(prevCards => prevCards.map(c => (c.id === card.id ? updatedCard : c)));
        boardService.updateCard(card.id, { x: updatedCard.x, y: updatedCard.y }).catch(err => {
          console.error('Failed to update card position:', err);
        });
      });
      setSelectedItems([activeId, ...containedCards.map(c => c.id)]);
    }
    setActiveDragId(null);
    setDragDelta(null);
    setDragStartedSelected(false);
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

        // Persist ungrouping of member cards belonging to deleted groups
        const deletedGroupIds = selectedItems.filter(id => groups.some(g => g.id === id));
        for (const gid of deletedGroupIds) {
          const members = cards.filter(c => c.groupId === gid && !selectedItems.includes(c.id));
          for (const c of members) {
            await boardService.updateCard(c.id, {
              groupId: undefined,
            }).catch(err => console.error('Failed to ungroup card:', err));
          }
        }
        setCards(prevCards => prevCards
          .filter(card => !selectedItems.includes(card.id))
          .map(card => {
            if (card.groupId && deletedGroupIds.includes(card.groupId)) {
              return {
                ...card,
                groupId: undefined,
              };
            }
            return card;
          }));
        setGroups(prevGroups => prevGroups.filter(group => !selectedItems.includes(group.id)));
        setSelectedItems([]);
      } catch (err) {
        console.error('Failed to delete selected items:', err);
      }
    }
  };

  const handleCardClick = (id: string, ctrlKey: boolean) => {
    if (selectedTool === 'card' || selectedTool === 'group') {
      onToolChange?.('select');
    }
    setSelectedItems((prev) => new ElementSelectionController().select(prev, id, ctrlKey));
  };

  const handleGroupClick = (id: string, ctrlKey: boolean) => {
    if (selectedTool === 'card' || selectedTool === 'group') {
      onToolChange?.('select');
    }
    const groupSelectionController = new GroupSelectionController(cards);
    setSelectedItems((prev) => groupSelectionController.select(prev, id, ctrlKey));
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
    
    // Get click position relative to board, accounting for scroll
    const boardRect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - boardRect.left + e.currentTarget.scrollLeft;
    const y = e.clientY - boardRect.top + e.currentTarget.scrollTop;
    
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
    <DndContext onDragStart={handleDragStart} onDragMove={handleDragMove} onDragEnd={handleDragEnd} modifiers={[({ transform, active }) => {
     const data = active?.data?.current as { x?: number; y?: number } | undefined;
     const x = data?.x ?? 0;
     const y = data?.y ?? 0;
     return {
       ...transform,
       x: Math.max(-x, transform.x),
       y: Math.max(-y, transform.y),
     };
   }]}>
      <div
        className="relative w-full h-full bg-gray-100 overflow-auto board-container"
        onClick={(e) => {
          handleBoardClick(e);
          handleBoardFocus();
        }}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
       {/* All cards rendered first in DOM (below groups visually via z-index) */}
        {cards.map(card => {
          const isCardSelected = selectedItems.includes(card.id);
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
              dragOffset={(isCardSelected || (activeDragId !== null && cards.find(c => c.id === card.id)?.groupId === activeDragId)) && card.id !== activeDragId && dragDelta ? dragDelta : null}
              onCardClick={handleCardClick}
              onSelect={handleSelect}
              onTextChange={handleCardTextChange}
            />
          );
        })}

        {/* Groups rendered after cards in DOM */}
        {groups.map(group => {
          const isGroupSelected = selectedItems.includes(group.id);
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
              dragOffset={isGroupSelected && group.id !== activeDragId && dragDelta ? dragDelta : null}
              cards={[]}
              selectedIds={selectedItems}
              onLabelChange={handleGroupLabelChange}
              onGroupClick={handleGroupClick}
              onSelect={handleSelect}
              onCardClick={handleCardClick}
              onCardTextChange={handleCardTextChange}
            />
          );
        })}
      </div>
    </DndContext>
  );
};

export default BoardView;
