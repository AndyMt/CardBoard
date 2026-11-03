import { useState, useEffect, useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';

const DEFAULT_WIDTH = 440; // 2x2 cards + padding
const DEFAULT_HEIGHT = 440;
const MIN_WIDTH = 220; // 1x1 card + padding
const MIN_HEIGHT = 220;
const LINE_HEIGHT = 20; // px

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
  const contentRef = useRef<HTMLDivElement>(null);

  // Format label
  useEffect(() => {
    setFormattedLabel(formatTextWithLineBreaks(groupLabel));
  }, [groupLabel]);

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id,
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      className={`
        absolute
        border border-dashed ${isSelected ? 'border-blue-500' : 'border-gray-400'}
        rounded-lg
        bg-gray-50
        cursor-pointer
        flex flex-col
        overflow-hidden
      `}
    >
      {/* Label area - white background that breaks the border */}
      <div className="relative -mt-3 self-start">
        <div className="bg-white px-2 py-1 rounded border border-dashed border-gray-400">
          {isEditing ? (
            <div
              ref={contentRef}
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => handleLabelChange(e.currentTarget.textContent || '')}
              onBlur={() => setIsEditing(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setIsEditing(false);
                }
              }}
              className="outline-none text-sm font-medium min-w-[50px]"
            >
              {groupLabel}
            </div>
          ) : (
            <div
              onDoubleClick={() => setIsEditing(true)}
              className="text-sm font-medium"
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