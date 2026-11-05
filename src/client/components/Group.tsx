import { useState, useEffect, useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';
import Card from './Card.js';
import { Card as CardType } from '../../types/Card.js';

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
  cards?: CardType[];
  selectedIds?: string[];
  onLabelChange?: (id: string, newLabel: string) => void;
  onSelect?: (id: string, ctrlKey?: boolean) => void;
  onGroupClick?: (id: string, ctrlKey: boolean) => void;
  onCardClick?: (id: string, ctrlKey: boolean) => void;
  onCardTextChange?: (id: string, newText: string) => void;
}

export const Group: React.FC<GroupProps> = ({
  id,
  label,
  x,
  y,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  isSelected = false,
  cards = [],
  selectedIds = [],
  onLabelChange,
  onSelect,
  onGroupClick,
  onCardClick,
  onCardTextChange
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
    data: { type: 'group', x, y }
  });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    left: `${x}px`,
    top: `${y}px`,
    width: `${width}px`,
    height: `${height}px`,
    minWidth: `${MIN_WIDTH}px`,
    minHeight: `${MIN_HEIGHT}px`,
    zIndex: 1,
  };

  const handleLabelChange = (newLabel: string) => {
    setGroupLabel(newLabel);
    if (onLabelChange) {
      onLabelChange(id, newLabel);
    }
  };

  const handleMouseDownSelection = (e: React.MouseEvent) => {
    isDraggingRef.current = false;
    // Get the bounding rectangle of the group
    const rect = e.currentTarget.getBoundingClientRect();

    // Calculate click position relative to the group (includes border)
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const border = 1.33;

    // Check if click is in the drag handle (8px blue bar at top, inside border)
    const isInDragHandle = clickY >= border && clickY < border + 8;

    // Check if click is in the 6px selection zone inside the element border
    const innerTop = border;
    const innerLeft = border;
    const innerRight = rect.width - border;
    const innerBottom = rect.height - border;
    const zone = 6;

    const inInner =
      clickX >= innerLeft && clickX <= innerRight &&
      clickY >= innerTop && clickY <= innerBottom;
    const isInSelectionZone = inInner && (
      clickX < innerLeft + zone ||               // Left
      clickX > innerRight - zone ||              // Right
      clickY < innerTop + 8 + zone ||            // Top (8px bar + 6px)
      clickY > innerBottom - zone                // Bottom
    );

    if (isInDragHandle || isInSelectionZone) {
      e.stopPropagation();
      (e.currentTarget as any)._pendingGroupSelection = {
        groupId: id,
        ctrlKey: e.ctrlKey
      };
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    const pending = (e.currentTarget as any)._pendingGroupSelection;
    if (pending && !isDraggingRef.current) {
      e.stopPropagation();
      e.preventDefault();
      if (onGroupClick) {
        onGroupClick(pending.groupId, pending.ctrlKey);
      }
    }
    delete (e.currentTarget as any)._pendingGroupSelection;
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
      data-group-id={id}
      onMouseDown={handleMouseDownSelection}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      onClick={(e) => e.stopPropagation()}
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
      <div className="flex-1" style={{ padding: '0.5rem', paddingTop: '0', position: 'relative' }}>
        {cards.map(card => {
          const isCardSelected = selectedIds.includes(card.id);
          return (
            <Card
              key={card.id}
              id={card.id}
              text={card.text}
              x={card.x}
              y={card.y}
              width={card.width || 200}
              height={card.height || 60}
              isSelected={isCardSelected}
              onCardClick={onCardClick}
              onSelect={onSelect}
              onTextChange={onCardTextChange}
            />
          );
        })}
      </div>
    </div>
  );
};

export default Group;