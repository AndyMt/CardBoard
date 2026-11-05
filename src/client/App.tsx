import React, { useState, useEffect } from 'react';
import BoardView from './components/BoardView.js';
import Toolbar from './components/Toolbar.js';
import UserPicker from './components/UserPicker.js';
import ToolService, { ToolType } from './services/ToolService.js';
import UserService from './services/UserService.js';
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

  // Handle tool selection through service
  const handleToolSelect = (tool: ToolType) => {
    toolService.setSelectedTool(tool);
    setSelectedTool(tool);
  };

  // On mount, check localStorage for an existing user
  useEffect(() => {
    const storedUser = UserService.getInstance().getStoredUser();
    setUser(storedUser);
    setUserInitialized(true);
  }, []);

  // When a user is confirmed via the picker, persist and show the app
  const handleUserConfirm = (confirmedUser: User) => {
    UserService.getInstance().setStoredUser(confirmedUser);
    setUser(confirmedUser);
  };

  // Before a user is established, show only the picker modal
  if (!userInitialized) {
    return null;
  }

  if (!user) {
    return (
      <div className="app h-screen bg-gray-100 overflow-hidden flex flex-col">
        <UserPicker onConfirm={handleUserConfirm} />
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
      />

      {/* Board view takes remaining space */}
      <div className="flex-1 overflow-hidden pt-12">
        {/* Add pt-12 to account for toolbar height */}
        <BoardView selectedTool={selectedTool} onSelectionChange={setSelectedCount} onToolChange={handleToolSelect} />
      </div>
    </div>
  );
};

export default App;
