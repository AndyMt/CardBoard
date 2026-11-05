import React, { useState } from 'react';
import BoardView from './components/BoardView.js';
import Toolbar from './components/Toolbar.js';
import ToolService, { ToolType } from './services/ToolService.js';

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

  // Handle tool selection through service
  const handleToolSelect = (tool: ToolType) => {
    toolService.setSelectedTool(tool);
    setSelectedTool(tool);
  };

  return (
    <div className="app h-screen bg-gray-100 overflow-hidden flex flex-col">
      {/* Toolbar with service */}
      <Toolbar
        selectedTool={selectedTool}
        onToolSelect={handleToolSelect}
        selectedCount={selectedCount}
      />
      
      {/* Board view takes remaining space */}
      <div className="flex-1 overflow-hidden pt-12">
        {/* Add pt-12 to account for toolbar height */}
        <BoardView selectedTool={selectedTool} onSelectionChange={setSelectedCount} />
      </div>
    </div>
  );
};

export default App;