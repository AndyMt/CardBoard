import { useState, useEffect, useRef } from 'react';
import { DndContext, DragEndEvent, DragMoveEvent, DragStartEvent } from '@dnd-kit/core';
import Card from './Card.js';
import Group from './Group.js';
import { Card as CardType } from '../../types/Card';
import { Group as GroupType } from '../../types/Group';
import { User } from '../../types/User';
import BoardService from '../services/BoardService';
import WebSocketService from '../services/WebSocketService.js';
import UserService from '../services/UserService.js';
import { ElementSelectionController } from '../controller/ElementSelectionController.js';
import { quantizeGeometry, quantizeNonNegative, quantizeScalar } from '../../shared/geometry.js';
import { normalizeBoardModel, UNKNOWN_USER_COLOR } from '../../shared/userColorNormalization.js';

interface BoardViewProps {
  selectedTool: 'select' | 'card' | 'group';
  onToolChange?: (tool: 'select' | 'card' | 'group') => void;
  currentUser?: User | null;
}

// Helper functions for model operations (client-side only)
const createDefaultCard = (x: number, y: number, createdBy?: string, createdColor?: string): CardType => {
  return quantizeGeometry({
    id: `card-${Date.now()}`,
    text: '',
    x: Math.max(0, x - 100), // Center the card on click position
    y: Math.max(0, y - 30),  // Account for card height
    width: 200, // Default card width
    height: 60, // Default card height
    isSelected: false,
    createdBy,
    createdColor: createdColor || UNKNOWN_USER_COLOR,
  });
};

const createDefaultGroup = (x: number, y: number, createdBy?: string, createdColor?: string): GroupType => {
  return quantizeGeometry({
    id: `group-${Date.now()}`,
    label: '',
    x: Math.max(0, x - 220), // Center the group on click position
    y: Math.max(0, y - 30),  // Account for group header height
    width: 440, // Default group width
    height: 300, // Default group height
    isSelected: false,
    createdBy,
    createdColor: createdColor || UNKNOWN_USER_COLOR,
  });
};

export const BoardView: React.FC<BoardViewProps> = ({ selectedTool, onToolChange, currentUser }) => {
  const [cards, setCards] = useState<CardType[]>([]);
  const [groups, setGroups] = useState<GroupType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [dragDelta, setDragDelta] = useState<{ x: number; y: number } | null>(null);
  const [dragStartedSelected, setDragStartedSelected] = useState<boolean>(false);
  // Tracks the last known board version so we can ignore stale broadcasts
  const lastBoardVersionRef = useRef<string | null>(null);
  // While the current user is dragging, ignore full-board broadcasts from
  // ourselves to avoid fighting the local optimistic state.
  const isLocallyDraggingRef = useRef(false);
  const editingCardIdsRef = useRef<Set<string>>(new Set());
  const editingGroupIdsRef = useRef<Set<string>>(new Set());
  const cardsRef = useRef<CardType[]>([]);
  const groupsRef = useRef<GroupType[]>([]);

  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  useEffect(() => {
    groupsRef.current = groups;
  }, [groups]);

  const getDirectoryUsers = async (): Promise<User[] | null> => {
    try {
      const users = await UserService.getInstance().getUsers();
      return Array.isArray(users) ? users : null;
    } catch {
      return null;
    }
  };

  const applyBoardState = (serverBoard: { cards?: CardType[]; groups?: GroupType[]; lastUpdated?: string }, users: User[] | null) => {
    const normalizedBoard = users ? normalizeBoardModel({
      cards: serverBoard.cards || [],
      groups: serverBoard.groups || [],
      lastUpdated: serverBoard.lastUpdated,
    }, users).board : { cards: serverBoard.cards || [], groups: serverBoard.groups || [], lastUpdated: serverBoard.lastUpdated };
    mergeBoard(normalizedBoard);
  };

  const mergeBoard = (serverBoard: { cards?: CardType[]; groups?: GroupType[]; lastUpdated?: string }) => {
    const serverCards = serverBoard.cards || [];
    const serverGroups = serverBoard.groups || [];
    setCards(prev => serverCards.map(card => {
      const normalized = quantizeGeometry(card);
      if (editingCardIdsRef.current.has(card.id)) {
        const local = prev.find(c => c.id === card.id);
        return local ? { ...normalized, text: local.text } : normalized;
      }
      return normalized;
    }));
    setGroups(prev => serverGroups.map(group => {
      const normalized = quantizeGeometry(group);
      if (editingGroupIdsRef.current.has(group.id)) {
        const local = prev.find(g => g.id === group.id);
        return local ? { ...normalized, label: local.label } : normalized;
      }
      return normalized;
    }));
    if (serverBoard.lastUpdated) {
      lastBoardVersionRef.current = serverBoard.lastUpdated;
    }
  };

  // Load board data on component mount
  useEffect(() => {
    const loadBoard = async () => {
      try {
        const boardService = BoardService.getInstance();
        const { cards, groups } = await boardService.getBoard();
        const users = await getDirectoryUsers();
        applyBoardState({ cards, groups }, users);
      } catch (err) {
        console.error('Failed to load board:', err);
        setError('Failed to load board data');
      } finally {
        setIsLoading(false);
      }
    };

    loadBoard();
  }, []);

  useEffect(() => {
    const handleKeyDown = async (e: globalThis.KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (e.key !== 'Delete' || selectedItems.length === 0) return;
      e.preventDefault();
      try {
        const boardService = BoardService.getInstance();
        for (const id of selectedItems) {
          if (cards.some(card => card.id === id)) await boardService.deleteCard(id);
          else if (groups.some(group => group.id === id)) await boardService.deleteGroup(id);
        }
        const deletedGroupIds = selectedItems.filter(id => groups.some(g => g.id === id));
        for (const gid of deletedGroupIds) {
          for (const c of cards.filter(c => c.groupId === gid && !selectedItems.includes(c.id))) {
            await boardService.updateCard(c.id, { groupId: undefined }).catch((err: unknown) => console.error('Failed to ungroup card:', err));
          }
        }
        setCards(prev => prev.filter(card => !selectedItems.includes(card.id)).map(card => card.groupId && deletedGroupIds.includes(card.groupId) ? { ...card, groupId: undefined } : card));
        setGroups(prev => prev.filter(group => !selectedItems.includes(group.id)));
        setSelectedItems([]);
      } catch (err) {
        console.error('Failed to delete selected items:', err);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItems, cards, groups]);

  // Subscribe to real-time board updates from other users.
  // The WebSocket is connected by App.tsx; here we only subscribe to events.
  useEffect(() => {
    const ws = WebSocketService.getInstance();

    const unsubscribeBoard = ws.onBoardUpdate(async (payload) => {
      if (ws.isRecentLocalMutation()) return;
      // Ignore our own updates while dragging to keep local optimistic state
      if (isLocallyDraggingRef.current) return;
      const serverBoard = payload.board;
      if (!serverBoard) return;

      // Avoid applying stale updates by comparing lastUpdated timestamps
      const serverVersion = serverBoard.lastUpdated || '';
      if (serverVersion && serverVersion <= (lastBoardVersionRef.current || '')) return;

      const users = await getDirectoryUsers();
      applyBoardState(serverBoard, users);
      // Keep current selection; do not clear on remote board update
    });

    const unsubscribeLive = ws.onLiveUpdate((payload) => {
      if (isLocallyDraggingRef.current) return;
      if (!payload) return;

      // Apply other users' live drag positions as an overlay
      setCards(prev => prev.map(c => {
        const live = payload.cards.find((lc) => lc.id === c.id);
        return live ? { ...c, x: quantizeScalar(live.x), y: quantizeScalar(live.y) } : c;
      }));
      setGroups(prev => prev.map(g => {
        const live = payload.groups.find((lg) => lg.id === g.id);
        return live ? { ...g, x: quantizeScalar(live.x), y: quantizeScalar(live.y) } : g;
      }));
    });

    const unsubscribeDirectory = UserService.getInstance().onUsersDirectoryUpdate((users) => {
      if (!Array.isArray(users)) return;
      applyBoardState({ cards: cardsRef.current, groups: groupsRef.current, lastUpdated: lastBoardVersionRef.current || undefined }, users);
    });

    return () => {
      unsubscribeBoard();
      unsubscribeLive();
      unsubscribeDirectory();
    };
  }, []);

  // Listen for the custom event fired by App.tsx when a remote mutation
  // completes, so we re-fetch the authoritative board.
  useEffect(() => {
    const handleChanged = async () => {
      const ws = WebSocketService.getInstance();
      if (ws.isRecentLocalMutation()) return;
      try {
        const boardService = BoardService.getInstance();
        const serverBoard = await boardService.getBoard();
        const users = await getDirectoryUsers();
        applyBoardState(serverBoard, users);
      } catch (err) {
        console.error('Failed to refresh board after remote change:', err);
      }
    };
    window.addEventListener('board:changed', handleChanged);
    return () => window.removeEventListener('board:changed', handleChanged);
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
    // We are now the active dragger; ignore our own server echoes
    isLocallyDraggingRef.current = true;
    // Emit a live preview so other users see the drag start immediately
    emitLivePreview();
  };

  const handleDragMove = (event: DragMoveEvent) => {
    setDragDelta({ x: event.delta.x, y: event.delta.y });
    if (!dragStartedSelected && (event.delta.x !== 0 || event.delta.y !== 0)) {
      const id = event.active.id as string;
      setSelectedItems([id]);
    }
    // Broadcast live positions to other users (throttled server-side)
    emitLivePreview();
  };

  const emitLivePreview = () => {
    const ws = WebSocketService.getInstance();
    if (!ws.isConnected()) return;

    const delta = dragDelta;
    const activeId = activeDragId;
    if (!activeId || !delta) return;

    const movedCards: { id: string; x: number; y: number }[] = [];
    const movedGroups: { id: string; x: number; y: number }[] = [];

    // Determine which items are moving (the active item, or all selected items)
    const movingIds = selectedItems.includes(activeId) && selectedItems.length > 0
      ? selectedItems
      : [activeId];

    cards.forEach((c) => {
      if (movingIds.includes(c.id)) {
        movedCards.push({ id: c.id, x: quantizeNonNegative(c.x + delta.x), y: quantizeNonNegative(c.y + delta.y) });
      }
    });
    groups.forEach((g) => {
      if (movingIds.includes(g.id)) {
        movedGroups.push({ id: g.id, x: quantizeNonNegative(g.x + delta.x), y: quantizeNonNegative(g.y + delta.y) });
      }
    });

    // Cards contained inside any moved group travel with it.
    const movedGroupIds = movedGroups.map(mg => mg.id);
    // Also include contained cards of selected groups being dragged together.
    const selectedGroupIds = selectedItems.filter(id => groups.some(g => g.id === id));
    const allMovedGroupIds = Array.from(new Set([...movedGroupIds, ...selectedGroupIds]));
    if (allMovedGroupIds.length > 0) {
      cards.forEach((c) => {
        if (movedCards.some(mc => mc.id === c.id)) return; // already moved (e.g. selected)
        if (c.groupId && allMovedGroupIds.includes(c.groupId)) {
          const group = groups.find(g => g.id === c.groupId);
          if (group && c.x >= group.x && c.x <= group.x + (group.width || 440) && c.y >= group.y && c.y <= group.y + (group.height || 300)) {
            movedCards.push({ id: c.id, x: quantizeNonNegative(c.x + delta.x), y: quantizeNonNegative(c.y + delta.y) });
          }
        }
      });
    }

    if (movedCards.length > 0 || movedGroups.length > 0) {
      ws.emitLiveDrag({ cards: movedCards, groups: movedGroups });
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
          const newBoardX = quantizeNonNegative(startBoardX + delta.x);
          const newBoardY = quantizeNonNegative(startBoardY + delta.y);

          // Hit-test whether the card was dropped inside a group
          const targetGroup = groups.find(g => {
            const gw = g.width || 440;
            const gh = g.height || 300;
            return newBoardX >= g.x && newBoardX <= g.x + gw && newBoardY >= g.y && newBoardY <= g.y + gh;
          });

          const newGroupId = targetGroup ? targetGroup.id : undefined;
          const updatedCard = { ...card, x: newBoardX, y: newBoardY, groupId: newGroupId };

          setCards(prevCards => prevCards.map(c => (c.id === card.id ? updatedCard : c)));

          boardService.updateCard(card.id, {
            x: updatedCard.x,
            y: updatedCard.y,
            groupId: updatedCard.groupId ?? null
          }).catch(err => {
            console.error('Failed to update card position:', err);
          });
        }
      });

      // Move all selected groups
      const movedGroupIds: string[] = [];
      selectedItems.forEach(itemId => {
        const group = groups.find(g => g.id === itemId);
        if (group) {
          movedGroupIds.push(group.id);
          const updatedGroup = {
            ...group,
            x: quantizeNonNegative(group.x + delta.x),
            y: quantizeNonNegative(group.y + delta.y),
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

      // Cards contained inside any moved group travel with it.
      const movedCardIds = new Set<string>();
      selectedItems.forEach(itemId => {
        const card = cards.find(c => c.id === itemId);
        if (card) movedCardIds.add(card.id);
      });
      movedGroupIds.forEach(groupId => {
        const group = groups.find(g => g.id === groupId);
        if (!group) return;
        cards.forEach(card => {
          if (movedCardIds.has(card.id)) return; // already handled by selected-cards loop
          if (card.groupId !== groupId) return;
          if (card.x < group.x || card.x > group.x + (group.width || 440) || card.y < group.y || card.y > group.y + (group.height || 300)) return;
          movedCardIds.add(card.id);
          const updatedCard = { ...card, x: quantizeNonNegative(card.x + delta.x), y: quantizeNonNegative(card.y + delta.y) };
          setCards(prevCards => prevCards.map(c => (c.id === card.id ? updatedCard : c)));
          boardService.updateCard(card.id, { x: updatedCard.x, y: updatedCard.y }).catch(err => {
            console.error('Failed to update card position:', err);
          });
        });
      });

      setActiveDragId(null);
      setDragDelta(null);
      setDragStartedSelected(false);
      isLocallyDraggingRef.current = false;
      return;
    }

    if (activeType === 'card') {
      const card = cards.find(c => c.id === activeId);
      if (!card) return;

      const startBoardX = card.x;
      const startBoardY = card.y;
      const newBoardX = quantizeNonNegative(startBoardX + delta.x);
      const newBoardY = quantizeNonNegative(startBoardY + delta.y);

      // Hit-test whether the card was dropped inside a group
      const targetGroup = groups.find(g => {
        const gw = g.width || 440;
        const gh = g.height || 300;
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
        groupId: updatedCard.groupId ?? null
      }).catch(err => {
        console.error('Failed to update card position:', err);
      });
    } else if (activeType === 'group') {
      const group = groups.find(g => g.id === activeId);
      if (!group) return;
      const containedCards = cards.filter(c => c.groupId === activeId && c.x >= group.x && c.x <= group.x + (group.width || 440) && c.y >= group.y && c.y <= group.y + (group.height || 300));
      setGroups(prevGroups => prevGroups.map(g => {
        if (g.id === activeId) {
          const updatedGroup = {
            ...group,
            x: quantizeNonNegative(group.x + delta.x),
            y: quantizeNonNegative(group.y + delta.y),
          };
          boardService.updateGroup(group.id, { x: updatedGroup.x, y: updatedGroup.y }).catch(err => {
            console.error('Failed to update group position:', err);
          });
          return updatedGroup;
        }
        return g;
      }));
      containedCards.forEach(card => {
        const updatedCard = { ...card, x: quantizeNonNegative(card.x + delta.x), y: quantizeNonNegative(card.y + delta.y) };
        setCards(prevCards => prevCards.map(c => (c.id === card.id ? updatedCard : c)));
        boardService.updateCard(card.id, { x: updatedCard.x, y: updatedCard.y }).catch(err => {
          console.error('Failed to update card position:', err);
        });
      });
    }
    setActiveDragId(null);
    setDragDelta(null);
    setDragStartedSelected(false);
    isLocallyDraggingRef.current = false;
  };

  const handleCardTextChange = (id: string, newText: string) => {
    setCards(prevCards => prevCards.map(card => {
      if (card.id === id) {
        return { ...card, text: newText };
      }
      return card;
    }));
  };

  const handleCardTextCommit = (id: string, newText: string) => {
    const boardService = BoardService.getInstance();
    boardService.updateCard(id, { text: newText }).catch(err => {
      console.error('Failed to update card text:', err);
    });
  };

  const handleCardEditingChange = (id: string, editing: boolean) => {
    if (editing) editingCardIdsRef.current.add(id);
    else editingCardIdsRef.current.delete(id);
  };

  const handleGroupLabelChange = (id: string, newLabel: string) => {
    setGroups(prevGroups => prevGroups.map(group => {
      if (group.id === id) {
        return { ...group, label: newLabel };
      }
      return group;
    }));
  };

  const handleGroupLabelCommit = (id: string, newLabel: string) => {
    const boardService = BoardService.getInstance();
    boardService.updateGroup(id, { label: newLabel }).catch(err => {
      console.error('Failed to update group label:', err);
    });
  };

  const handleGroupEditingChange = (id: string, editing: boolean) => {
    if (editing) editingGroupIdsRef.current.add(id);
    else editingGroupIdsRef.current.delete(id);
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
    setSelectedItems((prev) => new ElementSelectionController().select(prev, id, ctrlKey));
  };

  const handleAddCardInGroup = async (x: number, y: number, groupId: string) => {
    const newCard = createDefaultCard(x, y, currentUser?.name, currentUser?.color);
    newCard.groupId = groupId;
    try {
      const boardService = BoardService.getInstance();
      const { cards } = await boardService.addCard(newCard);
      setCards(cards);
    } catch (err) {
      console.error('Failed to add card:', err);
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
    
    // Get click position relative to board, accounting for scroll
    const boardRect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - boardRect.left + e.currentTarget.scrollLeft;
    const y = e.clientY - boardRect.top + e.currentTarget.scrollTop;
    
    if (selectedTool === 'card') {
      // Create new card using client-side helper
      const newCard = createDefaultCard(x, y, currentUser?.name, currentUser?.color);
      
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
      const newGroup = createDefaultGroup(x, y, currentUser?.name, currentUser?.color);
      
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
              dragOffset={(isCardSelected || (activeDragId !== null && (cards.find(c => c.id === card.id)?.groupId === activeDragId || selectedItems.includes(cards.find(c => c.id === card.id)?.groupId ?? '')))) && card.id !== activeDragId && dragDelta ? dragDelta : null}
              onCardClick={handleCardClick}
              onSelect={handleSelect}
              onTextChange={handleCardTextChange}
              onTextCommit={handleCardTextCommit}
              onEditingChange={handleCardEditingChange}
              createdBy={card.createdBy}
              createdColor={card.createdColor}
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
              height={group.height || 300}
              isSelected={isGroupSelected}
              dragOffset={isGroupSelected && group.id !== activeDragId && dragDelta ? dragDelta : null}
              cards={[]}
              selectedIds={selectedItems}
              onLabelChange={handleGroupLabelChange}
              onLabelCommit={handleGroupLabelCommit}
              onEditingChange={handleGroupEditingChange}
onGroupClick={handleGroupClick}
               onAddCard={handleAddCardInGroup}
               onSelect={handleSelect}
              onCardClick={handleCardClick}
              onCardTextChange={handleCardTextChange}
              onCardTextCommit={handleCardTextCommit}
              onCardEditingChange={handleCardEditingChange}
              createdBy={group.createdBy}
              createdColor={group.createdColor}
            />
          );
        })}
      </div>
    </DndContext>
  );
};

export default BoardView;
