import React, { useState, useEffect, useCallback } from 'react';
import { User } from '../../types/User.js';
import UserService from '../services/UserService.js';
import { downloadBoardExport, type ExportType } from '../services/ExportService.js';

// Define tool types
export type ToolType = 'select' | 'card' | 'group';

interface ToolbarProps {
  onToolSelect: (tool: ToolType) => void;
  selectedTool: ToolType;
  user?: User | null;
  connectedUsers?: number;
  onlineUserIds?: string[];
  onDeleteUser?: (user: User) => void;
  onLogoutUser?: (user: User) => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
  onToolSelect,
  selectedTool,
  user = null,
  connectedUsers = 0,
  onlineUserIds = [],
  onDeleteUser,
  onLogoutUser,
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
      icon: 'open_with',
    },
    {
      type: 'card',
      label: 'Add Card',
      icon: 'note_add',
    },
    {
      type: 'group',
      label: 'Add Group',
      icon: 'create_new_folder',
    },
  ];

  const [showUserList, setShowUserList] = useState(false);
  const [showDownload, setShowDownload] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [knownUsers, setKnownUsers] = useState<User[]>([]);
  const [exportError, setExportError] = useState<string | null>(null);
  const onlineIds = new Set(onlineUserIds);

  const handleExport = useCallback(async (type: ExportType) => {
    setShowDownload(false);
    setExportError(null);
    try {
      await downloadBoardExport(type);
    } catch (err) {
      console.error('Failed to export:', err);
      setExportError(err instanceof Error ? err.message : 'Export failed');
      window.setTimeout(() => setExportError(null), 4000);
    }
  }, []);

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
    <div
      className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm"
      onClick={() => setShowUserMenu(false)}
    >
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
              <span className="material-symbols-outlined" style={{ fontSize: '1.8em' }}>{tool.icon}</span>
              <span>{tool.label}</span>
            </button>
          ))}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowDownload((v) => !v)}
              className="px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1 bg-gray-100 text-gray-700 hover:bg-gray-200"
              title="Download"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1.8em' }}>download</span>
              <span>Download</span>
            </button>
            {showDownload && (
              <div className="absolute left-0 mt-2 w-40 bg-white border border-gray-200 rounded-md shadow-lg py-1 z-50">
                <button
                  type="button"
                  onClick={() => handleExport('mapping')}
                  className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Mapping CSV
                </button>
                <button
                  type="button"
                  onClick={() => handleExport('cards')}
                  className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Cards CSV
                </button>
                <button
                  type="button"
                  onClick={() => handleExport('groups')}
                  className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Groups CSV
                </button>
              </div>
            )}
            {exportError && (
              <div className="absolute left-0 mt-2 top-full px-3 py-1.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md shadow-sm whitespace-nowrap z-50">
                {exportError}
              </div>
            )}
          </div>
        </div>

        {/* Selected indicator + user - right side */}
        <div className="flex items-center space-x-4">
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
              <span className={`material-symbols-outlined text-gray-600`} style={{ fontSize: '1.8em' }}>
                {connectedUsers > 1 ? 'group' : 'person'}
              </span>
              <span className="font-medium">{connectedUsers}</span>
            </button>

            {showUserList && (
              <div className="absolute left-1/2 -translate-x-1/2 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg py-1 z-50">
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
            <div
              className="relative"
              onClick={(e) => {
                e.stopPropagation();
                setShowUserMenu((prev) => !prev);
              }}
            >
              <div className="flex items-center space-x-2 cursor-pointer">
                <div
                  className="w-6 h-6 rounded-full border-2 border-white"
                  style={{ backgroundColor: user.color }}
                ></div>
                <span className="text-sm text-gray-600 font-medium">
                  {user.name}
                </span>
              </div>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg py-1 z-50">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowUserMenu(false);
                      onDeleteUser?.(user);
                    }}
                    className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 hover:text-red-800"
                  >
                    Delete user
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowUserMenu(false);
                      onLogoutUser?.(user);
                    }}
                    className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Logout user
                  </button>
                </div>
              )}
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