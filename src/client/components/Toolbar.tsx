import React, { useState } from 'react';

// Define tool types
export type ToolType = 'select' | 'card' | 'group';

interface ToolbarProps {
  onToolSelect: (tool: ToolType) => void;
  selectedTool: ToolType;
  selectedCount?: number;
}

const Toolbar: React.FC<ToolbarProps> = ({ onToolSelect, selectedTool, selectedCount = 0 }) => {
  // State for user count (static for now)
  const [userCount] = useState<number>(1);

  // Tool button configuration
  const tools: Array<{
    type: ToolType;
    label: string;
    icon: string;
  }> = [
    {
      type: 'select',
      label: 'Select/Move',
      icon: '🖱️',
    },
    {
      type: 'card',
      label: 'Add Card',
      icon: '📝',
    },
    {
      type: 'group',
      label: 'Add Group',
      icon: '📁',
    },
  ];

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="flex items-center justify-between px-4 py-2">
        {/* Tool buttons - left side */}
        <div className="flex space-x-2">
          {tools.map((tool) => (
            <button
              key={tool.type}
              onClick={() => onToolSelect(tool.type)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1 ${
                selectedTool === tool.type
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title={tool.label}
            >
              <span>{tool.icon}</span>
              <span>{tool.label}</span>
            </button>
          ))}
        </div>
        
        {/* Selected indicator + user count - right side */}
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-600">
            Selected: {selectedCount} items
          </span>
          <div className="flex items-center space-x-2">
            <div className="flex -space-x-1">
              <div className="w-6 h-6 rounded-full bg-blue-300 border-2 border-white"></div>
            </div>
            <span className="text-sm text-gray-600">
              {userCount} {userCount === 1 ? 'user' : 'users'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Toolbar;