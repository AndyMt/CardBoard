import { useState, useEffect, useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useElementSelection } from '../hooks/useElementSelection.js';
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
  dragOffset?: { x: number; y: number } | null;
  cards?: CardType[];
  selectedIds?: string[];
  onLabelChange?: (id: string, newLabel: string) => void;
  onLabelCommit?: (id: string, newLabel: string) => void;
  onEditingChange?: (id: string, editing: boolean) => void;
  onSelect?: (id: string, ctrlKey?: boolean) => void;
  onGroupClick?: (id: string, ctrlKey: boolean) => void;
  onCardClick?: (id: string, ctrlKey: boolean) => void;
  onCardTextChange?: (id: string, newText: string) => void;
  onCardTextCommit?: (id: string, newText: string) => void;
  onCardEditingChange?: (id: string, editing: boolean) => void;
  createdBy?: string;
  createdColor?: string;
}

export const Group: React.FC<GroupProps> = ({
  id,
  label,
  x,
  y,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  isSelected = false,
  dragOffset = null,
  cards = [],
  selectedIds = [],
  onLabelChange,
  onLabelCommit,
  onEditingChange,
  onSelect,
  onGroupClick,
  onCardClick,
  onCardTextChange,
  onCardTextCommit,
  onCardEditingChange,
  createdBy,
  createdColor = '#3b82f6',
}) => {
  const [groupLabel, setGroupLabel] = useState(label);
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { isDraggingRef, handleMouseDown: handleMouseDownSelection, handleMouseUp, handleMouseMove } = useElementSelection(
    id,
    onGroupClick,
    1.33
  );

  useEffect(() => {
    if (!isEditing && label !== groupLabel) {
      setGroupLabel(label);
    }
  }, [label, isEditing, groupLabel]);

  useEffect(() => {
    onEditingChange?.(id, isEditing);
  }, [id, isEditing, onEditingChange]);

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id,
    data: { type: 'group', x, y }
  });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : (dragOffset ? `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0)` : undefined),
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

  const commitLabel = () => {
    if (onLabelCommit) {
      onLabelCommit(id, groupLabel);
    }
  };

  const handleLabelClick = () => {
    setIsEditing(true);
  };

  const handleInputBlur = () => {
    setIsEditing(false);
    commitLabel();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setIsEditing(false);
      commitLabel();
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
        {/* 8px high colored bar - this is the drag handle */}
        <div
          {...listeners}
          {...attributes}
          className="h-2 w-full cursor-move drag-handle-area"
          style={{ backgroundColor: createdColor }}
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
              onTextCommit={onCardTextCommit}
              onEditingChange={onCardEditingChange}
            />
          );
        })}
      </div>
    </div>
  );
};

export default Group;
