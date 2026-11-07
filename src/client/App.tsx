import React, { useState, useEffect, useCallback } from 'react';
import BoardView from './components/BoardView.js';
import Toolbar from './components/Toolbar.js';
import UserPicker from './components/UserPicker.js';
import ToolService, { ToolType } from './services/ToolService.js';
import UserService from './services/UserService.js';
import WebSocketService from './services/WebSocketService.js';
import { User } from '../types/User.js';

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
  const [selectedCount, setSelectedCount] = useState<number>(0);
  const [user, setUser] = useState<User | null>(null);
  const [userInitialized, setUserInitialized] = useState<boolean>(false);
  const [connectedUsers, setConnectedUsers] = useState<number>(0);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [suggestedName, setSuggestedName] = useState<string>('');
  const [suggestedColor, setSuggestedColor] = useState<string | null>(null);

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

    const unsubscribeBoard = ws.onBoardUpdate(() => {
      if (ws.isRecentLocalMutation()) {
        return;
      }
      window.dispatchEvent(new CustomEvent('board:changed'));
    });

    const unsubscribeUsers = ws.onUsersUpdate((payload) => {
      setConnectedUsers(payload.count);
      setOnlineUserIds(payload.onlineUserIds ?? []);
    });

    const unsubscribeDirectory = ws.onUsersDirectoryUpdate((payload) => {
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

  // Before a user is established, show only the picker modal
  if (!userInitialized) {
    return null;
  }

  if (!user) {
    return (
      <div className="app h-screen bg-gray-100 overflow-hidden flex flex-col">
        <UserPicker
          onConfirm={handleUserConfirm}
          initialName={suggestedName}
          initialColor={suggestedColor}
        />
      </div>
    );
  }

  return (
    <div className="app h-screen bg-gray-100 overflow-hidden flex flex-col">
      {/* Toolbar with service and user */}
      <Toolbar
        selectedTool={selectedTool}
        onToolSelect={handleToolSelect}
        selectedCount={selectedCount}
        user={user}
        connectedUsers={connectedUsers}
        onlineUserIds={onlineUserIds}
      />

      {/* Board view takes remaining space */}
      <div className="flex-1 overflow-hidden pt-12">
        {/* Add pt-12 to account for toolbar height */}
        <BoardView
          selectedTool={selectedTool}
          onSelectionChange={setSelectedCount}
          onToolChange={handleToolSelect}
          currentUser={user}
        />
      </div>
    </div>
  );
};

export default App;