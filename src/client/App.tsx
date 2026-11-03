import React from 'react';
import BoardView from './components/BoardView.js';
import Toolbar from './components/Toolbar.js';

export interface AppProps {
  // Define props if needed
}

const App: React.FC<AppProps> = () => {
  return (
    <div className="app h-screen bg-gray-100 overflow-hidden flex flex-col">
      {/* Toolbar at the top - fixed position */}
      <Toolbar />
      
      {/* Board view takes remaining space */}
      <div className="flex-1 overflow-hidden pt-12">
        {/* Add pt-12 to account for toolbar height */}
        <BoardView />
      </div>
    </div>
  );
};

export default App;