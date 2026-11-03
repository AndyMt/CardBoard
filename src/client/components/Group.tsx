import { useState, useEffect, useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';

const DEFAULT_WIDTH = 440; // 2x2 cards + padding
const DEFAULT_HEIGHT = 440;
const MIN_WIDTH = 220; // 1x1 card + padding
const MIN_HEIGHT = 220;

interface GroupProps {
  id: string;
  label: string;
  x: number;
  y: number;
  isSelected: boolean;
  onLabelChange?: (id: string, newLabel: string) => void;
  onSelect?: (id: string) => void;
}

const formatTextWithLineBreaks = (text: string): string => {
  if (!text) return '';
  // For group labels, we'll just ensure they fit in the width
  // Groups have a fixed width, so we'll truncate if needed
  return text.length > 30 ? text.substring(0, 27) + '...' : text;
};

export const Group: React.FC<GroupProps> = ({
  id,
  label,
  x,
  y,
  isSelected,
  onLabelChange,
  onSelect
}) => {
  const [groupLabel, setGroupLabel] = useState(label);
  const [formattedLabel, setFormattedLabel] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Format label
  useEffect(() => {
    setFormattedLabel(formatTextWithLineBreaks(groupLabel));
  }, [groupLabel]);

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id,
    data: { type: 'group' }
  });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    left: `${x}px`,
    top: `${y}px`,
    width: `${DEFAULT_WIDTH}px`,
    height: `${DEFAULT_HEIGHT}px`,
    minWidth: `${MIN_WIDTH}px`,
    minHeight: `${MIN_HEIGHT}px`,
  };

  const handleLabelChange = (newLabel: string) => {
    setGroupLabel(newLabel);
    if (onLabelChange) {
      onLabelChange(id, newLabel);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    // Only select if clicking on the border (not content)
    if (e.target === e.currentTarget && onSelect) {
      onSelect(id);
    }
  };

  const handleLabelClick = () => {
    // Start editing on single click
    setIsEditing(true);
  };

  const handleInputBlur = () => {
    setIsEditing(false);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setIsEditing(false);
    }
  };

  // Auto-focus when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleClick}
      className={`
        absolute
        border border-dashed ${isSelected ? 'border-blue-500' : 'border-gray-400'}
        rounded-lg
        bg-gray-50
        flex flex-col
        overflow-hidden
      `}
    >
      {/* Drag handle - top bar */}
      <div
        {...listeners}
        {...attributes}
        className="h-4 w-full cursor-move mb-1 flex justify-center"
      >
        <div className="h-1 w-12 bg-gray-400 rounded"></div>
      </div>
      
      {/* Label area - white background that breaks the border */}
      <div className="relative -mt-3 self-start">
        <div className="bg-white px-2 py-1 rounded border border-dashed border-gray-400">
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={groupLabel}
              onChange={(e) => handleLabelChange(e.target.value)}
              onBlur={handleInputBlur}
              onKeyDown={handleInputKeyDown}
              className="outline-none text-sm font-medium min-w-[50px] bg-blue-50 rounded p-1"
            />
          ) : (
            <div
              onClick={handleLabelClick}
              className="text-sm font-medium cursor-text hover:bg-gray-50 rounded p-1"
            >
              {formattedLabel || 'Group'}
            </div>
          )}
        </div>
      </div>
      
      {/* Content area */}
      <div className="flex-1 p-2">
        {/* This is where cards will be placed */}
      </div>
    </div>
  );
};

export default Group;