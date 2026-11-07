import React, { useState, useEffect, useCallback } from 'react';
import { User } from '../../types/User.js';
import UserService from '../services/UserService.js';

// Define tool types
export type ToolType = 'select' | 'card' | 'group';

interface ToolbarProps {
  onToolSelect: (tool: ToolType) => void;
  selectedTool: ToolType;
  selectedCount?: number;
  user?: User | null;
  connectedUsers?: number;
  onlineUserIds?: string[];
}

const Toolbar: React.FC<ToolbarProps> = ({
  onToolSelect,
  selectedTool,
  selectedCount = 0,
  user = null,
  connectedUsers = 0,
  onlineUserIds = [],
}) => {
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

  const [showUserList, setShowUserList] = useState(false);
  const [knownUsers, setKnownUsers] = useState<User[]>([]);
  const onlineIds = new Set(onlineUserIds);

  const fetchUsers = useCallback(async () => {
    try {
      const users = await UserService.getInstance().getUsers();
      setKnownUsers(users);
    } catch (err) {
      console.error('Failed to fetch users for tooltip:', err);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    // Keep the directory in sync with server pushes instead of polling.
    const unsubscribe = UserService.getInstance().onUsersDirectoryUpdate((users) => {
      setKnownUsers(users);
    });
    return () => unsubscribe();
  }, [fetchUsers]);

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

        {/* Selected indicator + user - right side */}
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-600">
            Selected: {selectedCount} items
          </span>

          {/* Connected users indicator with tooltip */}
          <div className="relative">
            <button
              type="button"
              className="flex items-center space-x-1 text-sm text-gray-600 hover:text-gray-900"
              onMouseEnter={() => {
                setShowUserList(true);
                fetchUsers();
              }}
              onMouseLeave={() => setShowUserList(false)}
              title={`${connectedUsers} user(s) online`}
            >
              <span className={`material-symbols-outlined text-gray-600`}>
                {connectedUsers > 1 ? 'group' : 'person'}
              </span>
              <span className="font-medium">{connectedUsers}</span>
            </button>

            {showUserList && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg py-1 z-50">
                {knownUsers.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-500">No users</div>
                ) : (
                  knownUsers.map((u) => {
                    const isOnline = onlineIds.has(u.id);
                    return (
                      <div
                        key={u.id}
                        className="flex items-center space-x-2 px-3 py-1.5 text-sm"
                      >
                        <span
                          className={`w-4 h-4 rounded-full border border-white ${isOnline ? '' : 'opacity-50'}`}
                          style={{ backgroundColor: u.color }}
                        />
                        <span className={`text-sm ${isOnline ? 'text-gray-700' : 'text-gray-400'}`}>
                          {u.name}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {user ? (
            <div className="flex items-center space-x-2">
              <div
                className="w-6 h-6 rounded-full border-2 border-white"
                style={{ backgroundColor: user.color }}
              ></div>
              <span className="text-sm text-gray-600 font-medium">
                {user.name}
              </span>
            </div>
          ) : (
            <span className="text-sm text-gray-600">No user</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default Toolbar;