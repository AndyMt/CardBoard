import React, { useState } from 'react';

const SelectionTest: React.FC = () => {
  const [isSelected, setIsSelected] = useState(false);
  
  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4">Selection Test</h2>
      
      {/* Test div with selection class */}
      <div
        className={`w-32 h-16 border rounded p-2 mb-4 cursor-pointer ${isSelected ? 'selected' : ''}`}
        onClick={() => setIsSelected(!isSelected)}
        style={{ position: 'relative' }}
      >
        Click me to toggle selection
        {isSelected && <div className="text-xs text-green-600 mt-1">SELECTED</div>}
      </div>
      
      {/* Test div with explicit box-shadow */}
      <div
        className="w-32 h-16 border rounded p-2 mb-4 cursor-pointer"
        style={
          isSelected ? {
            boxShadow: '0 0 6px 2px rgba(25, 62, 120, 0.9)',
            position: 'relative',
            zIndex: 10
          } : {}
        }
        onClick={() => setIsSelected(!isSelected)}
      >
        Click me to toggle glow
        {isSelected && <div className="text-xs text-green-600 mt-1">GLOW</div>}
      </div>
      
      <div className="text-sm text-gray-600">
        <p>If the glow appears on the second box, the CSS is working correctly.</p>
        <p>If not, there may be an issue with the CSS classes.</p>
      </div>
    </div>
  );
};

export default SelectionTest;