import React, { useState } from 'react';
import BoardView from './components/BoardView.js';
import Toolbar from './components/Toolbar.js';
import { ToolController, ToolType } from './controllers/ToolController.js';

export interface AppProps {
  // Define props if needed
}

const App: React.FC<AppProps> = () => {
  // Create tool controller instance
  const toolController = new ToolController();
  
  // State for selected tool (using controller)
  const [selectedTool, setSelectedTool] = useState<ToolType>(
    toolController.getSelectedTool()
  );

  // Handle tool selection through controller
  const handleToolSelect = (tool: ToolType) => {
    toolController.setSelectedTool(tool);
    setSelectedTool(tool);
  };

  return (
    <div className="app h-screen bg-gray-100 overflow-hidden flex flex-col">
      {/* Toolbar with controller */}
      <Toolbar
        selectedTool={selectedTool}
        onToolSelect={handleToolSelect}
      />
      
      {/* Board view takes remaining space */}
      <div className="flex-1 overflow-hidden pt-12">
        {/* Add pt-12 to account for toolbar height */}
        <BoardView selectedTool={selectedTool} />
      </div>
    </div>
  );
};

export default App;