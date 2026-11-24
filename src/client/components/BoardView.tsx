import { useState, useEffect, useRef, useMemo } from 'react';
import Card from './Card.js';
import Group from './Group.js';
import { ConnectionRenderer } from './ConnectionRenderer.js';
import { Card as CardType } from '../../types/Card.js';
import { Group as GroupType } from '../../types/Group.js';
import { User } from '../../types/User.js';
import BoardService from '../services/BoardService.js';
import WebSocketService from '../services/WebSocketService.js';
import UserService from '../services/UserService.js';
import { ElementSelectionController } from '../controller/ElementSelectionController.js';
import { ConnectorLayoutCoordinator } from '../controller/ConnectorLayoutCoordinator.js';
import { CursorController } from '../controller/CursorController.js';
import type { CursorPosition } from '../../types/Cursor.js';
import { quantizeGeometry, quantizeNonNegative, quantizePreciseNonNegative, quantizeScalar } from '../../shared/geometry.js';
import { normalizeBoardModel, UNKNOWN_USER_COLOR } from '../../shared/userColorNormalization.js';

interface BoardViewProps {
  selectedTool: 'select' | 'card' | 'group' | 'connection';
  onToolChange?: (tool: 'select' | 'card' | 'group' | 'connection') => void;
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
  const [selectedConnectorIds, setSelectedConnectorIds] = useState<string[]>([]);

  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ scrollX: number; scrollY: number; clientX: number; clientY: number } | null>(null);
  // Remote user cursors (local user excluded), rendered via direct DOM to avoid board re-renders.
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const cursorElements = new Map<string, HTMLDivElement>();
  // Connection tool state
  const [connectionSourceId, setConnectionSourceId] = useState<string | null>(null);
  const [connectionPointer, setConnectionPointer] = useState<{ x: number; y: number } | null>(null);
  // Connector label editing state
  const [editingConnectorId, setEditingConnectorId] = useState<string | null>(null);
  const [connectorNameDraft, setConnectorNameDraft] = useState('');

  // Tracks the last known board version so we can ignore stale broadcasts
  const lastBoardVersionRef = useRef<string | null>(null);
  // While the current user is dragging, ignore full-board broadcasts from
  // ourselves to avoid fighting the local optimistic state.
  const isLocallyDraggingRef = useRef(false);
  const editingCardIdsRef = useRef<Set<string>>(new Set());
  const editingGroupIdsRef = useRef<Set<string>>(new Set());
  const originalConnectorNameRef = useRef<Map<string, string>>(new Map());
  const cardsRef = useRef<CardType[]>([]);
  const groupsRef = useRef<GroupType[]>([]);
  const selectedItemsRef = useRef<string[]>([]);
  // Native drag state (replaces @dnd-kit)
  const dragRef = useRef<{
    id: string | null;
    type: 'card' | 'group' | null;
    startClient: { x: number; y: number };
    startPos: Map<string, { x: number; y: number }>;
    hasMoved: boolean;
    wasAlreadySelected: boolean;
  } | null>(null);
  let rafRef = useRef<number | null>(null);
  // ID of the card or group that should enter edit mode after creation
  const [autoFocusId, setAutoFocusId] = useState<string | null>(null);

  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  useEffect(() => {
    groupsRef.current = groups;
  }, [groups]);

  useEffect(() => {
    selectedItemsRef.current = selectedItems;
  }, [selectedItems]);

  useEffect(() => {
    setSelectedItems([]);
    setSelectedConnectorIds([]);
  }, [selectedTool]);

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
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        console.log('[KEYBOARD] Delete ignored (input focused)', { key: e.key, tagName: target.tagName });
        return;
      }
      if (e.key !== 'Delete' || (selectedItems.length === 0 && selectedConnectorIds.length === 0)) return;
      console.log('[KEYBOARD] Delete pressed', { key: e.key, selectedItems, selectedConnectorIds });
      e.preventDefault();
      try {
        const boardService = BoardService.getInstance();
        for (const id of selectedItems) {
          if (cards.some(card => card.id === id)) await boardService.deleteCard(id);
          else if (groups.some(group => group.id === id)) await boardService.deleteGroup(id);
        }
        for (const connId of selectedConnectorIds) {
          const sourceCard = cards.find(c => (c.connections || []).some((conn: { id: string }) => conn.id === connId));
          if (sourceCard) {
            const { cards: updatedCards } = await boardService.removeConnection(sourceCard.id, connId);
            setCards(updatedCards);
          }
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
        setSelectedConnectorIds([]);
      } catch (err) {
        console.error('Failed to delete selected items:', err);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItems, selectedConnectorIds, cards, groups]);

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

  // Native pointer drag listeners on window so dragging survives leaving the
  // board container and pointerup is always received.
  useEffect(() => {
    const handleMove = (e: globalThis.PointerEvent) => handleDragMove(e);
    const handleUp = (e: globalThis.PointerEvent) => handleDragEnd(e);
    const handleCancel = () => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      isLocallyDraggingRef.current = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleCancel);
    window.addEventListener('blur', handleCancel);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleCancel);
      window.removeEventListener('blur', handleCancel);
    };
  }, []);

  // Connect the remote-cursor controller: emit local cursor moves and render
  // remote cursors (excluding the local user) on every other user's session.
  // Cursors are rendered via direct DOM manipulation to avoid board re-renders.
  useEffect(() => {
    const controller = CursorController.getInstance();
    controller.connect();
    controller.setLocalUserId(currentUser?.id ?? null);

    const unsubscribe = controller.onCursorChange((cursors) => {
      const container = boardContainerRef.current;
      if (!container) return;

      const incoming = new Set(cursors.map((c) => c.userId));

      // Remove cursors that are no longer present
      for (const [userId, el] of cursorElements) {
        if (!incoming.has(userId)) {
          el.remove();
          cursorElements.delete(userId);
        }
      }

      // Add/update cursors
      for (const cursor of cursors) {
        let el = cursorElements.get(cursor.userId);
        if (!el) {
          el = document.createElement('div');
          el.style.position = 'absolute';
          el.style.borderRadius = '50%';
          el.style.pointerEvents = 'none';
          el.style.zIndex = '50';
          el.style.transition = 'transform 0.1s linear';
          el.style.willChange = 'transform';
          container.appendChild(el);
          cursorElements.set(cursor.userId, el);
        }
        // Center the 4px cursor on the exact board-content coordinate.
        el.style.transform = `translate3d(${cursor.x - 2}px, ${cursor.y - 2}px, 0)`;
        el.style.width = '4px';
        el.style.height = '4px';
        el.style.backgroundColor = cursor.color;
        el.style.boxShadow = `0 0 3px ${cursor.color}`;
      }
    });

    return () => {
      unsubscribe();
      // Clean up cursor elements on unmount
      for (const el of cursorElements.values()) {
        el.remove();
      }
      cursorElements.clear();
    };
  }, [currentUser?.id]);

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

  const handleDragStart = (e: React.PointerEvent, id: string, type: 'card' | 'group') => {
    if (selectedTool === 'connection') return;
    e.stopPropagation();
    const board = boardContainerRef.current;
    if (!board) return;
    const boardRect = board.getBoundingClientRect();
    const startClient = { x: e.clientX - boardRect.left + board.scrollLeft, y: e.clientY - boardRect.top + board.scrollTop };

    // Compute moving set: active element (or all selected items if activeId is selected), plus cards contained in any moving group.
    const movingIds: string[] = [];
    if (selectedItems.includes(id) && selectedItems.length > 1) {
      selectedItems.forEach(itemId => { if (!movingIds.includes(itemId)) movingIds.push(itemId); });
    } else {
      movingIds.push(id);
    }
    const movingGroupIds = movingIds.filter(itemId => groups.some(g => g.id === itemId));
    cards.forEach(c => {
      if (c.groupId && movingGroupIds.includes(c.groupId) && !movingIds.includes(c.id)) {
        movingIds.push(c.id);
      }
    });

    const startPos = new Map<string, { x: number; y: number }>();
    movingIds.forEach(itemId => {
      const card = cards.find(c => c.id === itemId);
      const group = groups.find(g => g.id === itemId);
      if (card) startPos.set(itemId, { x: card.x, y: card.y });
      else if (group) startPos.set(itemId, { x: group.x, y: group.y });
    });

    const el = e.currentTarget as HTMLElement;
    dragRef.current = { id, type, startClient, startPos, hasMoved: false, wasAlreadySelected: selectedItems.includes(id) };
    isLocallyDraggingRef.current = true;
    // Set pending selection so click-to-select works even though preventDefault()
    // suppresses the compatibility mousedown event.
    const cardEl = el.closest('[data-card-id], [data-group-id]');
    if (cardEl) {
      (cardEl as any)._pendingSelection = { id, ctrlKey: e.ctrlKey };
    }
    emitLivePreview();
  };

  const handleDragMove = (e: globalThis.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const { id, type, startClient, startPos } = drag;
    const board = boardContainerRef.current;
    if (!board) return;
    const boardRect = board.getBoundingClientRect();
    const clientX = e.clientX - boardRect.left + board.scrollLeft;
    const clientY = e.clientY - boardRect.top + board.scrollTop;
    const dx = clientX - startClient.x;
    const dy = clientY - startClient.y;

    if (!drag.hasMoved) {
      const dist = Math.hypot(dx, dy);
      if (dist > 1 && id !== null) {
        drag.hasMoved = true;
        // L74: dragging an unselected element clears other selections once
        // actual movement starts; an already-selected element preserves them.
        setSelectedItems(prev => (drag.wasAlreadySelected ? prev : [id]));
        // Clear pending selection so click doesn't fire after a drag
        const element = document.querySelector(`[data-card-id="${id}"], [data-group-id="${id}"]`);
        if (element) {
          delete (element as any)._pendingSelection;
        }
      }
    }

    const movingIds = Array.from(startPos.keys());
    const nextCards = cardsRef.current.map(c => {
      if (!movingIds.includes(c.id)) return c;
      const pos = startPos.get(c.id)!;
      return { ...c, x: quantizePreciseNonNegative(pos.x + dx), y: quantizePreciseNonNegative(pos.y + dy) };
    });
    const nextGroups = groupsRef.current.map(g => {
      if (!movingIds.includes(g.id)) return g;
      const pos = startPos.get(g.id)!;
      return { ...g, x: quantizePreciseNonNegative(pos.x + dx), y: quantizePreciseNonNegative(pos.y + dy) };
    });
    setCards(nextCards);
    setGroups(nextGroups);

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      emitLivePreview({ dx, dy });
    });
  };

  const emitLivePreview = (delta?: { dx: number; dy: number }) => {
    const ws = WebSocketService.getInstance();
    if (!ws.isConnected()) return;
    const drag = dragRef.current;
    if (!drag || !isLocallyDraggingRef.current) return;

    const { id, startPos } = drag;
    const dx = delta?.dx ?? 0;
    const dy = delta?.dy ?? 0;

    const movedCards: { id: string; x: number; y: number }[] = [];
    const movedGroups: { id: string; x: number; y: number }[] = [];

    startPos.forEach((pos, itemId) => {
      const card = cardsRef.current.find(c => c.id === itemId);
      const group = groupsRef.current.find(g => g.id === itemId);
      if (card) {
        movedCards.push({ id: card.id, x: quantizeNonNegative(pos.x + dx), y: quantizeNonNegative(pos.y + dy) });
      } else if (group) {
        movedGroups.push({ id: group.id, x: quantizeNonNegative(pos.x + dx), y: quantizeNonNegative(pos.y + dy) });
      }
    });

    if (movedCards.length > 0 || movedGroups.length > 0) {
      ws.emitLiveDrag({ cards: movedCards, groups: movedGroups });
    }
  };

  const handleDragEnd = (e: globalThis.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;

    // No actual movement — plain click, don't clear _pendingSelection so click selects
    if (!drag.hasMoved) {
      dragRef.current = null;
      isLocallyDraggingRef.current = false;
      return;
    }

    const { id, startPos } = drag;
    if (!id) return;
    const board = boardContainerRef.current;
    if (!board) return;
    const boardRect = board.getBoundingClientRect();
    const clientX = e.clientX - boardRect.left + board.scrollLeft;
    const clientY = e.clientY - boardRect.top + board.scrollTop;
    const dx = quantizeScalar(clientX - drag.startClient.x);
    const dy = quantizeScalar(clientY - drag.startClient.y);

    const boardService = BoardService.getInstance();
    const activeId = id;
    const activeType = drag.type;

    const finishDrag = () => {
      dragRef.current = null;
      isLocallyDraggingRef.current = false;
      // Clear pending selection so click doesn't fire after drag
      const element = document.querySelector(`[data-card-id="${id}"], [data-group-id="${id}"]`);
      if (element) {
        delete (element as any)._pendingSelection;
      }
    };

    const insideGroup = (gx: number, gy: number, g: GroupType) => {
      const gw = g.width || 440;
      const gh = g.height || 300;
      return gx >= g.x && gx <= g.x + gw && gy >= g.y && gy <= g.y + gh;
    };

    const cardUpdatesMap = new Map<string, { id: string; x: number; y: number; groupId?: string | null }>();
    const groupUpdatesMap = new Map<string, { id: string; x: number; y: number }>();
    let nextCards = cardsRef.current;
    let nextGroups = groupsRef.current;

    // If the dragged item is part of a multi-selection, move all selected items
    if (selectedItemsRef.current.includes(activeId) && selectedItemsRef.current.length > 1) {
      selectedItemsRef.current.forEach(itemId => {
        const card = cardsRef.current.find(c => c.id === itemId);
        const pos = startPos.get(itemId);
        if (card && pos) {
          const newBoardX = quantizeNonNegative(pos.x + dx);
          const newBoardY = quantizeNonNegative(pos.y + dy);
          const targetGroup = groupsRef.current.find(g => insideGroup(newBoardX, newBoardY, g));
          const newGroupId = targetGroup ? targetGroup.id : undefined;
          cardUpdatesMap.set(card.id, { id: card.id, x: newBoardX, y: newBoardY, groupId: newGroupId ?? null });
          nextCards = nextCards.map(c => (c.id === card.id ? { ...c, x: newBoardX, y: newBoardY, groupId: newGroupId } : c));
        }
      });

      selectedItemsRef.current.forEach(itemId => {
        const group = groupsRef.current.find(g => g.id === itemId);
        const pos = startPos.get(itemId);
        if (group && pos) {
          const updated = { id: group.id, x: quantizeNonNegative(pos.x + dx), y: quantizeNonNegative(pos.y + dy) };
          groupUpdatesMap.set(group.id, updated);
          nextGroups = nextGroups.map(g => (g.id === group.id ? { ...g, x: updated.x, y: updated.y } : g));
        }
      });

      // Cards contained inside any moved group travel with it.
      groupUpdatesMap.forEach((moved, groupId) => {
        const group = groupsRef.current.find(g => g.id === groupId);
        if (!group) return;
        cardsRef.current.forEach(card => {
          if (cardUpdatesMap.has(card.id)) return;
          if (card.groupId !== groupId) return;
          if (!insideGroup(card.x, card.y, group)) return;
          const cpos = startPos.get(card.id);
          if (!cpos) return;
          const updatedCard = { id: card.id, x: quantizeNonNegative(cpos.x + dx), y: quantizeNonNegative(cpos.y + dy) };
          cardUpdatesMap.set(card.id, updatedCard);
          nextCards = nextCards.map(c => (c.id === card.id ? { ...c, x: updatedCard.x, y: updatedCard.y } : c));
        });
      });

      setCards(nextCards);
      setGroups(nextGroups);
      boardService.batchUpdate({ cards: Array.from(cardUpdatesMap.values()), groups: Array.from(groupUpdatesMap.values()) }).catch(err => {
        console.error('Failed to batch update board positions:', err);
      });
      setSelectedItems(selectedItemsRef.current); // Preserve selection
      finishDrag();
      return;
    }

    if (activeType === 'card') {
      const card = cardsRef.current.find(c => c.id === activeId);
      const pos = startPos.get(activeId);
      if (!card || !pos) { finishDrag(); return; }
      const newBoardX = quantizeNonNegative(pos.x + dx);
      const newBoardY = quantizeNonNegative(pos.y + dy);
      const targetGroup = groupsRef.current.find(g => insideGroup(newBoardX, newBoardY, g));
      const newGroupId = targetGroup ? targetGroup.id : undefined;
      setCards(prevCards => prevCards.map(c => (c.id === card.id ? { ...c, x: newBoardX, y: newBoardY, groupId: newGroupId } : c)));
      boardService.batchUpdate({ cards: [{ id: card.id, x: newBoardX, y: newBoardY, groupId: newGroupId ?? null }] }).catch(err => {
        console.error('Failed to update card position:', err);
      });
    } else if (activeType === 'group') {
      const group = groupsRef.current.find(g => g.id === activeId);
      const pos = startPos.get(activeId);
      if (!group || !pos) { finishDrag(); return; }
      const gx = quantizeNonNegative(pos.x + dx);
      const gy = quantizeNonNegative(pos.y + dy);
      const movedGroups = [{ id: group.id, x: gx, y: gy }];
      const movedCards = cardsRef.current
        .filter(c => c.groupId === activeId && insideGroup(c.x, c.y, group))
        .map(c => {
          const cpos = startPos.get(c.id);
          return { id: c.id, x: quantizeNonNegative((cpos ? cpos.x : c.x) + dx), y: quantizeNonNegative((cpos ? cpos.y : c.y) + dy) };
        });
      setGroups(prevGroups => prevGroups.map(g => (g.id === group.id ? { ...g, x: gx, y: gy } : g)));
      setCards(prevCards => prevCards.map(c => {
        const moved = movedCards.find(m => m.id === c.id);
        return moved ? { ...c, x: moved.x, y: moved.y } : c;
      }));
      boardService.batchUpdate({ groups: movedGroups, cards: movedCards }).catch(err => {
        console.error('Failed to update group position:', err);
      });
    }
    finishDrag();
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

  const handleCardHeightChange = (id: string, height: number) => {
    const quantizedHeight = quantizeScalar(height);
    setCards(prevCards => prevCards.map(card => {
      if (card.id === id) {
        return { ...card, height: quantizedHeight };
      }
      return card;
    }));
  };

  const handleCardEditEnd = (id: string, height: number) => {
    const boardService = BoardService.getInstance();
    boardService.updateCard(id, { height }).catch(err => {
      console.error('Failed to update card height:', err);
    });
  };

  const handleCardEditingChange = (id: string, editing: boolean) => {
    if (editing) {
      editingCardIdsRef.current.add(id);
      if (autoFocusId === id) setAutoFocusId(null);
    } else {
      editingCardIdsRef.current.delete(id);
    }
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
    if (editing) {
      editingGroupIdsRef.current.add(id);
      if (autoFocusId === id) setAutoFocusId(null);
    } else {
      editingGroupIdsRef.current.delete(id);
    }
  };

  const handleSelect = (id: string, ctrlKey: boolean = false) => {
    setSelectedItems(prev => new ElementSelectionController().select(prev, id, ctrlKey));
  };

  const handleConnectorSelect = (id: string, ctrlKey: boolean = false) => {
    if (selectedTool !== 'select' && selectedTool !== 'connection') return;
    setSelectedItems([]);
    setSelectedConnectorIds(prev => new ElementSelectionController().select(prev, id, ctrlKey));
  };

  const handleConnectorNameStart = (id: string) => {
    if (selectedTool === 'connection') return;
    setEditingConnectorId(id);
    const card = cards.find(c => (c.connections || []).some((conn: { id: string }) => conn.id === id));
    const conn = card?.connections?.find((c: { id: string; name?: string }) => c.id === id);
    originalConnectorNameRef.current.set(id, conn?.name ?? '');
    setConnectorNameDraft(conn?.name ?? '');
  };

  const handleConnectorNameChange = (id: string, newName: string) => {
    setConnectorNameDraft(newName);
    setCards(prevCards => prevCards.map(card => {
      if (!card.connections) return card;
      return {
        ...card,
        connections: card.connections.map((conn: { id: string; name?: string }) =>
          conn.id === id ? { ...conn, name: newName } : conn),
      };
    }));
  };

  const handleConnectorNameCommit = async (id: string, newName: string) => {
    try {
      const boardService = BoardService.getInstance();
      // Find the source card that owns this connection
      const card = cards.find(c => (c.connections || []).some((conn: { id: string }) => conn.id === id));
      if (card) {
        await boardService.updateConnectionName(card.id, id, newName);
      }
    } catch (err) {
      console.error('Failed to update connector name:', err);
    } finally {
      setEditingConnectorId(null);
      setConnectorNameDraft('');
      originalConnectorNameRef.current.delete(id);
    }
  };

  const handleConnectorNameCancel = (id: string) => {
    setEditingConnectorId(null);
    setConnectorNameDraft('');
    const original = originalConnectorNameRef.current.get(id);
    originalConnectorNameRef.current.delete(id);
    if (original !== undefined) {
      setCards(prevCards => prevCards.map(card => {
        if (!card.connections) return card;
        return {
          ...card,
          connections: card.connections.map((conn: { id: string; name?: string }) =>
            conn.id === id ? { ...conn, name: original } : conn),
        };
      }));
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
      (boardElement as HTMLElement).focus();
    }
  };

  const handlePanStart = (e: React.MouseEvent<HTMLDivElement>) => {
    if (selectedTool !== 'select' || e.button !== 0 || isLocallyDraggingRef.current) return;
    if (e.target instanceof Element && e.target.closest('[data-drag-handle]')) return;
    setIsPanning(true);
    setPanStart({
      scrollX: e.currentTarget.scrollLeft,
      scrollY: e.currentTarget.scrollTop,
      clientX: e.clientX,
      clientY: e.clientY,
    });
  };

  const handlePanMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning || !panStart) return;
    const { scrollX, scrollY, clientX, clientY } = panStart;
    const dx = clientX - e.clientX;
    const dy = clientY - e.clientY;
    e.currentTarget.scrollLeft = scrollX + dx;
    e.currentTarget.scrollTop = scrollY + dy;
  };

  const handlePanEnd = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning) return;
    setIsPanning(false);
    setPanStart(null);
  };

  const emitCursorPosition = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!currentUser) return;
    const boardRect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - boardRect.left + e.currentTarget.scrollLeft;
    const y = e.clientY - boardRect.top + e.currentTarget.scrollTop;
    CursorController.getInstance().emitPosition(currentUser, x, y);
  };

  const handleBoardClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    setSelectedItems([]);
    
    // Handle tool-specific actions
    if (selectedTool === 'select' || selectedTool === 'connection') {
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
        setAutoFocusId(newCard.id);
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
        setAutoFocusId(newGroup.id);
      } catch (err) {
        console.error('Failed to add group:', err);
      }
    }
  };

  const getBoardCoords = (e: React.MouseEvent<HTMLDivElement>): { x: number; y: number } => {
    const boardRect = e.currentTarget.getBoundingClientRect();
    return {
      x: e.clientX - boardRect.left + e.currentTarget.scrollLeft,
      y: e.clientY - boardRect.top + e.currentTarget.scrollTop,
    };
  };

  const handleConnectionMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (selectedTool !== 'connection' || !connectionSourceId) return;
    setConnectionPointer(getBoardCoords(e));
  };

  const handleConnectionMouseUp = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (selectedTool !== 'connection' || !connectionSourceId) return;
    e.preventDefault();
    e.stopPropagation();

    const el = document.elementFromPoint(e.clientX, e.clientY);
    const targetCardEl = el?.closest('[data-card-id]') as HTMLElement | null;
    const targetId = targetCardEl?.dataset.cardId ?? null;

    if (targetId && targetId !== connectionSourceId) {
      try {
        const boardService = BoardService.getInstance();
        const { cards: updatedCards, connectionId } = await boardService.addConnection(connectionSourceId, targetId);
        setCards(updatedCards);
        if (connectionId) {
          setEditingConnectorId(connectionId);
          setConnectorNameDraft('');
          originalConnectorNameRef.current.set(connectionId, '');
        }
      } catch (err) {
        console.error('Failed to add connection:', err);
      }
    }

    setConnectionSourceId(null);
    setConnectionPointer(null);
  };

  // Automatic orthogonal connector routing: recomputed whenever card/group
  // geometry changes (including during drags). Purely client-side, not persisted.
  const connectorLayout = useMemo(
    () => new ConnectorLayoutCoordinator().computeLayout(cards, groups),
    [cards, groups]
  );

  const previewRoute = useMemo(
    () => (connectionSourceId && connectionPointer
      ? new ConnectorLayoutCoordinator().computePreviewRoute(cards, connectionSourceId, connectionPointer)
      : null),
    [cards, connectionSourceId, connectionPointer]
  );

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

  return (
    <div
      ref={boardContainerRef}
      className="relative w-full h-full bg-gray-100 overflow-auto board-container"
      onClick={(e) => {
        handleBoardClick(e);
        handleBoardFocus();
      }}
      onMouseDown={handlePanStart}
      onMouseMove={(e) => {
        handlePanMove(e);
        emitCursorPosition(e);
        handleConnectionMouseMove(e);
      }}
      onMouseLeave={handlePanEnd}
      onMouseUp={(e) => {
        handlePanEnd(e);
        handleConnectionMouseUp(e);
      }}
      style={{ cursor: isPanning ? 'grabbing' : 'default', userSelect: connectionSourceId ? 'none' : 'auto' }}
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
            tool={selectedTool}
            onCardClick={handleCardClick}
            onSelect={handleSelect}
            onDragStart={handleDragStart}
            onCardMouseDown={(id) => {
              if (selectedTool === 'connection') {
                setConnectionSourceId(id);
                setConnectionPointer(null);
              }
            }}
            onTextChange={handleCardTextChange}
            onTextCommit={handleCardTextCommit}
            onEditingChange={handleCardEditingChange}
            onHeightChange={handleCardHeightChange}
            onEditEnd={handleCardEditEnd}
            createdBy={card.createdBy}
            createdColor={card.createdColor}
            autoFocus={autoFocusId === card.id}
          />
        );
      })}

        {/* Connector lines rendered between cards and groups in z-order */}
        <ConnectionRenderer
          cards={cards}
          routes={connectorLayout.routes}
          labels={connectorLayout.labels}
          previewRoute={previewRoute}
          selectedTool={selectedTool}
          selectedConnectorIds={selectedConnectorIds}
          onConnectorSelect={handleConnectorSelect}
          editingConnectorId={editingConnectorId}
          connectorNameDraft={connectorNameDraft}
          onConnectorNameStart={handleConnectorNameStart}
          onConnectorNameChange={handleConnectorNameChange}
          onConnectorNameCommit={handleConnectorNameCommit}
          onConnectorNameCancel={handleConnectorNameCancel}
        />

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
              tool={selectedTool}
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
              autoFocus={autoFocusId === group.id}
              onDragStart={handleDragStart}
            />
          );
        })}
      </div>
  );
};

export default BoardView;
