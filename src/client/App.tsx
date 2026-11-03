import React from 'react';
import BoardView from './components/BoardView.js';

export interface AppProps {
  // Define props if needed
}

const App: React.FC<AppProps> = () => {
  return (
    <div className="app h-screen bg-gray-100 overflow-hidden">
      <BoardView />
    </div>
  );
};

export default App;