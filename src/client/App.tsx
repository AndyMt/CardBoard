import React, { useState, useEffect, useCallback } from 'react';
import BoardView from './components/BoardView.js';
import Toolbar from './components/Toolbar.js';
import ModelPanel from './components/ModelPanel.js';
import UserPicker from './components/UserPicker.js';
import ToolService, { ToolType } from './services/ToolService.js';
import UserService from './services/UserService.js';
import WebSocketService from './services/WebSocketService.js';
import BoardService from './services/BoardService.js';
import type { UsersUpdatePayload, UserDirectoryUpdatePayload } from './services/WebSocketService.js';
import { User } from '../types/User.js';
import type { Card } from '../types/Card.js';
import type { Group } from '../types/Group.js';
import type { Reference } from '../types/Reference.js';
import type { View } from '../types/View.js';
import { quantizeScalar } from '../shared/geometry.js';

interface BoardData {
  cards: unknown[];
  groups: unknown[];
  views: View[];
  references: unknown[];
}

export interface AppProps {
  // Define props if needed
}

const App: React.FC<AppProps> = () => {
  // Get tool service instance
  const toolService = ToolService.getInstance();

  // State for selected tool (using service)
  const [selectedTool, setSelectedTool] = useState<ToolType>(
    toolService.getSelectedTool()
  );
  const [user, setUser] = useState<User | null>(null);
  const [userInitialized, setUserInitialized] = useState<boolean>(false);
  const [goodbye, setGoodbye] = useState<boolean>(false);
  const [connectedUsers, setConnectedUsers] = useState<number>(0);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [suggestedName, setSuggestedName] = useState<string>('');
  const [suggestedColor, setSuggestedColor] = useState<string | null>(null);

  // Board views and the currently active view (MVC: view selection is controller state)
  const [views, setViews] = useState<View[]>([]);
  const [activeViewId, setActiveViewId] = useState<string>('view-usecase');
  // Full model (cards + groups) for the left-hand model panel.
  const [boardCards, setBoardCards] = useState<Card[]>([]);
  const [boardGroups, setBoardGroups] = useState<Group[]>([]);
  const [boardReferences, setBoardReferences] = useState<Reference[]>([]);

  const loadBoard = useCallback(async () => {
    const defaultViews: View[] = [
      { id: 'view-usecase', name: 'Usecase', type: 'Usecase', isDefault: true },
      { id: 'view-functional', name: 'Functional', type: 'Functional' },
    ];
    setViews(defaultViews);
    setActiveViewId('view-usecase');

    try {
      const response = await fetch('/api/board');
      if (!response.ok) return;
      const board = await response.json();
      const serverViews: View[] = Array.isArray(board.views) ? board.views : [];
      if (serverViews.length > 0) {
        setViews(serverViews);
        const defaultView = serverViews.find((v) => v.isDefault) || serverViews[0];
        setActiveViewId(defaultView.id);
      }
      setBoardCards(Array.isArray(board.cards) ? board.cards : []);
      setBoardGroups(Array.isArray(board.groups) ? board.groups : []);
      setBoardReferences(Array.isArray(board.references) ? board.references : []);
    } catch (err) {
      console.error('Failed to load board:', err);
    }
  }, []);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  const handleViewChange = useCallback((viewId: string) => {
    setActiveViewId(viewId);
  }, []);

  // Place a model element onto the current view: create a reference (or reposition
  // an existing one) at the drop position.
  const handlePlace = useCallback(
    async (elementId: string, elementType: 'card' | 'group', x: number, y: number) => {
      if (!activeViewId) return;
      const existing = boardReferences.find(
        (r) => r.elementId === elementId && r.elementType === elementType && r.viewId === activeViewId,
      );
      const width = elementType === 'card' ? 200 : 440;
      const height = elementType === 'card' ? 45 : 300;
      try {
        if (existing) {
          await BoardService.getInstance().updateReference(existing.id, {
            x: quantizeScalar(x),
            y: quantizeScalar(y),
            width,
            height,
          });
        } else {
          const boardService = BoardService.getInstance();
          const refId = await boardService.getNewId('ref');
          await boardService.addReference({
            id: refId,
            elementId,
            elementType,
            x: quantizeScalar(x),
            y: quantizeScalar(y),
            width,
            height,
            viewId: activeViewId,
          });
        }
      } catch (err) {
        console.error('Failed to place element:', err);
      }
    },
    [activeViewId, boardReferences],
  );

  // Handle tool selection through service
  const handleToolSelect = (tool: ToolType) => {
    toolService.setSelectedTool(tool);
    setSelectedTool(tool);
  };

  // On mount, check localStorage for an existing user
  useEffect(() => {
    const storedUser = UserService.getInstance().getStoredUser();
    if (storedUser) {
      UserService.getInstance()
        .getUsers()
        .then((users) => {
          const exists = users.some((u) => u.name === storedUser.name);
          if (exists) {
            setUser(storedUser);
          } else {
            setSuggestedName(storedUser.name);
            setSuggestedColor(storedUser.color ?? null);
          }
        })
        .catch(() => {
          setSuggestedName(storedUser.name);
          setSuggestedColor(storedUser.color ?? null);
        })
        .finally(() => setUserInitialized(true));
    } else {
      setUserInitialized(true);
    }
  }, []);

  // Connect to the WebSocket and subscribe to real-time updates
  useEffect(() => {
    const ws = WebSocketService.getInstance();
    ws.connect();

    const unsubscribeBoard = ws.onBoardUpdate((payload) => {
      if (ws.isRecentLocalMutation()) {
        return;
      }
      if (payload.board) {
        setBoardCards(Array.isArray(payload.board.cards) ? payload.board.cards : []);
        setBoardGroups(Array.isArray(payload.board.groups) ? payload.board.groups : []);
        setBoardReferences(Array.isArray(payload.board.references) ? payload.board.references : []);
      }
      window.dispatchEvent(new CustomEvent('board:changed'));
    });

    const unsubscribeUsers = ws.onUsersUpdate((payload: UsersUpdatePayload) => {
      setConnectedUsers(payload.count);
      setOnlineUserIds(payload.onlineUserIds ?? []);
    });

    const unsubscribeDirectory = ws.onUsersDirectoryUpdate((payload: UserDirectoryUpdatePayload) => {
      UserService.getInstance().setUsers(payload.users);
    });

    return () => {
      unsubscribeBoard();
      unsubscribeUsers();
      unsubscribeDirectory();
    };
  }, []);

  // Re-identify this socket with the current user whenever (re)connected,
  // so the server counts this user as online.
  useEffect(() => {
    if (!user) return;
    const ws = WebSocketService.getInstance();
    const unsubscribeConnect = ws.onConnect(() => {
      ws.emitUserIdentify({ userId: user.id, userName: user.name });
    });
    if (ws.isConnected()) {
      ws.emitUserIdentify({ userId: user.id, userName: user.name });
    }
    return () => unsubscribeConnect();
  }, [user]);

  // When a user is confirmed via the picker, persist and show the app
  const handleUserConfirm = (confirmedUser: User) => {
    UserService.getInstance().setStoredUser(confirmedUser);
    setUser(confirmedUser);
    const ws = WebSocketService.getInstance();
    ws.emitUserIdentify({ userId: confirmedUser.id, userName: confirmedUser.name });
  };

  // Delete user: remove from server directory AND clear local storage, then show goodbye screen
  const handleDeleteUser = async (userToDelete: User) => {
    if (!window.confirm(`Delete user "${userToDelete.name}" from the directory? This cannot be undone.`)) {
      return;
    }
    try {
      await UserService.getInstance().removeUser(userToDelete.id);
      UserService.getInstance().clearStoredUser();
      setGoodbye(true);
    } catch (err) {
      console.error('Failed to delete user:', err);
      alert(`Failed to delete user: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Logout user: clear local storage only, keep user in directory, then show goodbye screen
  const handleLogoutUser = (userToLogout: User) => {
    UserService.getInstance().clearStoredUser();
    setGoodbye(true);
  };

  // Goodbye screen after logout or delete
  if (goodbye) {
    return (
      <div className="app h-screen bg-white overflow-hidden flex flex-col items-center justify-center">
        <h1 className="text-2xl font-medium text-gray-900">CardBoard: Good bye</h1>
      </div>
    );
  }

  // Before a user is established, show only the picker modal
  if (!userInitialized) {
    return null;
  }

  if (!user) {
    return (
      <div className="app h-screen bg-white overflow-hidden flex flex-col">
        <header className="px-6 py-4 text-lg font-medium text-gray-900 border-b border-gray-200">
          Welcome to CoardBoard
        </header>
        <div className="flex-1 flex items-center justify-center">
          <UserPicker
            onConfirm={handleUserConfirm}
            initialName={suggestedName}
            initialColor={suggestedColor}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="app h-screen bg-gray-100 overflow-hidden flex flex-col">
      {/* Toolbar with service and user */}
      <Toolbar
        selectedTool={selectedTool}
        onToolSelect={handleToolSelect}
        user={user}
        connectedUsers={connectedUsers}
        onlineUserIds={onlineUserIds}
        views={views}
        activeViewId={activeViewId}
        onViewChange={handleViewChange}
        onDeleteUser={handleDeleteUser}
        onLogoutUser={handleLogoutUser}
      />

      {/* Board view takes remaining space */}
      <div className="flex-1 overflow-hidden pt-12 flex h-full">
        <ModelPanel
          cards={boardCards}
          groups={boardGroups}
          activeViewId={activeViewId}
          onPlace={handlePlace}
        />
        <div className="flex-1 relative min-w-0">
          {/* Add pt-12 to account for toolbar height */}
          <BoardView
            selectedTool={selectedTool}
            onToolChange={handleToolSelect}
            currentUser={user}
            views={views}
            activeViewId={activeViewId}
            onViewChange={handleViewChange}
            onPlace={handlePlace}
            onCardAdded={setBoardCards}
            onGroupAdded={setBoardGroups}
            onCardDeleted={(cardId) => setBoardCards((prev) => prev.filter((c) => c.id !== cardId))}
            onGroupDeleted={(groupId) => setBoardGroups((prev) => prev.filter((g) => g.id !== groupId))}
            onCardTextChanged={(id, text) => setBoardCards((prev) => prev.map((c) => c.id === id ? { ...c, text } : c))}
            onGroupLabelChanged={(id, label) => setBoardGroups((prev) => prev.map((g) => g.id === id ? { ...g, label } : g))}
          />
        </div>
      </div>
    </div>
  );
};

export default App;
