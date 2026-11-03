import React from 'react';
import BoardView from './components/BoardView.js';

export interface AppProps {
  // Define props if needed
}

const App: React.FC<AppProps> = () => {
  return (
    <div className="app min-h-screen bg-gray-100">
      <h1 className="text-2xl font-bold p-4 text-gray-800">CardBoard</h1>
      <div className="px-4 pb-4">
        <p className="text-gray-600">Welcome to the collaborative board application</p>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <BoardView />
      </div>
    </div>
  );
};

export default App;