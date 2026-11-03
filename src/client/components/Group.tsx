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
  width?: number;
  height?: number;
  isSelected: boolean;
  onLabelChange?: (id: string, newLabel: string) => void;
  onSelect?: (id: string) => void;
}

export const Group: React.FC<GroupProps> = ({
  id,
  label,
  x,
  y,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  isSelected = false,
  onLabelChange,
  onSelect
}) => {
  const [groupLabel, setGroupLabel] = useState(label);
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isDraggingRef = useRef(false);



  const handleMouseMove = () => {
    isDraggingRef.current = true;
  };

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id,
    data: { type: 'group' }
  });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    left: `${x}px`,
    top: `${y}px`,
    width: `${width}px`,
    height: `${height}px`,
    minWidth: `${MIN_WIDTH}px`,
    minHeight: `${MIN_HEIGHT}px`,
  };

  const handleLabelChange = (newLabel: string) => {
    setGroupLabel(newLabel);
    if (onLabelChange) {
      onLabelChange(id, newLabel);
    }
  };

  const handleMouseDownSelection = (e: React.MouseEvent) => {
    // Get the bounding rectangle of the group
    const rect = e.currentTarget.getBoundingClientRect();

    // Calculate click position relative to the group
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Check if click is in the drag handle (8px blue bar)
    const isInDragHandle = clickY < 8;

    // Check if click is in the 6px selection zone inside the border
    const isInSelectionZone =
      clickX < 6 ||                     // Left selection zone (6px)
      clickX > rect.width - 6 ||        // Right selection zone (6px)
      clickY < 14 ||                    // Top selection zone (8px dragging bar + 6px below)
      clickY > rect.height - 6;         // Bottom selection zone (6px)

    // Only trigger selection if the mouse has not moved (i.e., it's a click, not a drag)
    if ((isInDragHandle || isInSelectionZone) && !isDraggingRef.current) {
      e.stopPropagation();
      e.preventDefault();
      if (onSelect) {
        onSelect(id);
      }
      
    }
    
    // For content area, proceed with normal click handling
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

  // Auto-enter edit mode when group is created with empty label
  useEffect(() => {
    if (groupLabel === '' && !isEditing) {
      setIsEditing(true);
    }
  }, [groupLabel]);

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
      onMouseDown={handleMouseDownSelection}
      onMouseMove={handleMouseMove}
      className={`absolute border-[1.33px] border-dashed border-gray-400 rounded-lg bg-white overflow-hidden group-component ${isSelected ? 'selected' : ''}`}
    >
      {/* Header with 8px blue bar and centered label */}
      <div className="flex flex-col">
        {/* 8px high blue bar - this is the drag handle */}
        <div
          {...listeners}
          {...attributes}
          className="h-2 w-full bg-blue-500 cursor-move drag-handle-area"
        ></div>
        
        {/* Label area - centered */}
        <div className="px-2 py-1 flex justify-center">
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={groupLabel}
              onChange={(e) => handleLabelChange(e.target.value)}
              onBlur={handleInputBlur}
              onKeyDown={handleInputKeyDown}
              className="outline-none text-sm font-medium text-center bg-blue-50 rounded px-1 py-0.5"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div
              onClick={handleLabelClick}
              className="text-sm font-medium cursor-text hover:bg-gray-50 rounded px-1 py-0.5 text-center"
            >
              {groupLabel || 'Group'}
            </div>
          )}
        </div>
      </div>
      
      {/* Content area */}
      <div className="flex-1" style={{ padding: '0.5rem', paddingTop: '0' }}>
        {/* This is where cards will be placed */}
      </div>
    </div>
  );
};

export default Group;