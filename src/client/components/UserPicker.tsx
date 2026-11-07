import React, { useState, useEffect, useCallback } from 'react';
import { User, USER_COLORS } from '../../types/User.js';
import UserService from '../services/UserService.js';

interface UserPickerProps {
  onConfirm: (user: User) => void;
  initialName?: string;
  initialColor?: string | null;
}

const UserPicker: React.FC<UserPickerProps> = ({ onConfirm, initialName, initialColor }) => {
  const [name, setName] = useState(initialName ?? '');
  const [color, setColor] = useState<string | null>(initialColor ?? null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [takenColors, setTakenColors] = useState<Set<string>>(new Set());

  const fetchUsers = useCallback(async () => {
    try {
      const users = await UserService.getInstance().getUsers();
      const taken = new Set(users.map(u => u.color));
      setTakenColors(taken);
    } catch (err) {
      console.error('Failed to fetch users for color availability:', err);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    // Keep color availability in sync with directory changes.
    const unsubscribe = UserService.getInstance().onUsersDirectoryUpdate((users) => {
      setTakenColors(new Set(users.map(u => u.color)));
    });
    return () => unsubscribe();
  }, [fetchUsers]);

  const isColorTaken = (c: string) => takenColors.has(c);
  const noColorsAvailable = USER_COLORS.every(c => isColorTaken(c));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name || name.trim() === '') {
      setError('Please enter a name.');
      return;
    }

    if (!color) {
      setError('Please select a color.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await UserService.getInstance().registerUser(name.trim(), color);
      UserService.getInstance().setStoredUser(result.user);
      onConfirm(result.user);
    } catch (err) {
      setError((err as Error).message || 'Failed to register user.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
        <h2 className="text-lg font-semibold mb-4">Join the board</h2>
        <p className="text-sm text-gray-600 mb-4">
          Enter your name and pick a color. Taken colors are unavailable.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
            <div className="flex flex-wrap gap-2">
              {USER_COLORS.map((c) => {
                const taken = isColorTaken(c);
                const selected = color === c;
                let swatchClass = 'w-8 h-8 rounded-full border-2';
                if (taken) {
                  swatchClass += ' border-gray-300 opacity-50 cursor-not-allowed';
                } else if (selected) {
                  swatchClass += ` border-white ring-2 ring-${c}`;
                } else {
                  swatchClass += ' border-white';
                }
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => (taken ? null : setColor(c))}
                    disabled={taken || noColorsAvailable}
                    className={swatchClass}
                    style={{ backgroundColor: c }}
                    title={taken ? 'Color already taken' : c}
                    aria-pressed={selected}
                  />
                );
              })}
            </div>
            {noColorsAvailable && (
              <p className="text-xs text-red-500 mt-1">No colors available right now.</p>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting || !name || !color || noColorsAvailable}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {submitting ? 'Joining...' : 'Join'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserPicker;
