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
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
    if (onSelect) {
      onSelect(id);
    }
  };

  const handleLabelClick = () => {
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
      className={`
        absolute
        border border-dashed ${isSelected ? 'border-blue-500' : 'border-gray-400'}
        rounded-lg
        bg-white
        overflow-hidden
      `}
      onClick={handleClick}
    >
      {/* Make entire group draggable */}
      <div {...listeners} {...attributes} className="w-full h-full">
        {/* 8px high bar across entire width */}
        <div className="h-2 w-full bg-blue-500"></div>
        
        {/* Label area */}
        <div className="p-2">
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={groupLabel}
              onChange={(e) => handleLabelChange(e.target.value)}
              onBlur={handleInputBlur}
              onKeyDown={handleInputKeyDown}
              className="outline-none text-sm font-medium w-full bg-blue-50 rounded px-1 py-0.5"
            />
          ) : (
            <div
              onClick={handleLabelClick}
              className="text-sm font-medium cursor-text hover:bg-gray-50 rounded px-1 py-0.5"
            >
              {groupLabel || 'Group'}
            </div>
          )}
        </div>
        
        {/* Content area */}
        <div className="flex-1 p-2 pt-0">
          {/* This is where cards will be placed */}
        </div>
      </div>
    </div>
  );
};

export default Group;