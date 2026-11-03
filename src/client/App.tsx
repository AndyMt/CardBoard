import React from 'react';
import TestComponent from './components/TestComponent.js';

export interface AppProps {
  // Define props if needed
}

const App: React.FC<AppProps> = () => {
  return (
    <div className="app p-4 min-h-screen bg-gray-100">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">CardBoard</h1>
      <p className="text-gray-600 mb-6">Welcome to the collaborative board application</p>
      
      <div className="flex flex-wrap">
        <TestComponent
          title="Test Component"
          description="This is a test component to verify our React setup."
        />
      </div>
    </div>
  );
};

export default App;