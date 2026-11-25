import { useState, useEffect, useRef } from 'react';
import { useElementSelection } from '../hooks/useElementSelection.js';
import ToolService from '../services/ToolService.js';
import Card from './Card.js';
import { Card as CardType } from '../../types/Card.js';
import { UNKNOWN_USER_COLOR } from '../../shared/userColorNormalization.js';

const DEFAULT_WIDTH = 440; // 2x2 cards + padding
const DEFAULT_HEIGHT = 300;
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
  onLabelCommit?: (id: string, newLabel: string) => void;
  onEditingChange?: (id: string, editing: boolean) => void;
  onSelect?: (id: string, ctrlKey?: boolean) => void;
  onGroupClick?: (id: string, ctrlKey: boolean) => void;
  onCardClick?: (id: string, ctrlKey: boolean) => void;
  onAddCard?: (x: number, y: number, groupId: string) => void;
  onCardTextChange?: (id: string, newText: string) => void;
  onCardTextCommit?: (id: string, newText: string) => void;
  onCardEditingChange?: (id: string, editing: boolean) => void;
  onDragStart?: (e: React.PointerEvent, id: string, type: 'card' | 'group') => void;
  createdBy?: string;
  createdColor?: string;
  autoFocus?: boolean;
  tool?: string;
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
  onLabelCommit,
  onEditingChange,
  onSelect,
  onGroupClick,
  onCardClick,
  onAddCard,
  onCardTextChange,
  onCardTextCommit,
  onCardEditingChange,
  onDragStart,
  createdBy,
  createdColor,
  autoFocus = false,
  tool = 'select',
}) => {
  const [groupLabel, setGroupLabel] = useState(label);
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoFocusRef = useRef(false);
  const groupRef = useRef<HTMLDivElement>(null);
  const { handleMouseDown: handleMouseDownSelection, handleMouseUp } = useElementSelection(
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

  const style = {
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
    // Start editing on single click (only when not in connection tool)
    if (tool === 'connection') return;
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

  // Auto-focus when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Enter edit mode on mount when autoFocus is true
  useEffect(() => {
    if (autoFocus && !autoFocusRef.current && !isEditing) {
      autoFocusRef.current = true;
      setIsEditing(true);
    }
  }, [autoFocus, isEditing]);

  return (
    <div
      ref={groupRef}
      style={style}
      data-group-id={id}
      onMouseDown={(e) => { if (tool !== 'connection') handleMouseDownSelection(e); }}
      onMouseUp={(e) => { if (tool !== 'connection') handleMouseUp(e); }}
onClick={(e) => {
        e.stopPropagation();
        if (ToolService.getInstance().getSelectedTool() !== 'card') return;
        const boardContainer = document.querySelector('.board-container');
        if (!boardContainer) return;
        const br = boardContainer.getBoundingClientRect();
        const boardX = e.clientX - br.left + boardContainer.scrollLeft;
        const boardY = e.clientY - br.top + boardContainer.scrollTop;
        console.log('Group content click (Add Card active)', { x: boardX, y: boardY });
        onAddCard?.(boardX, boardY, id);
      }}
      className={`absolute border-[1.33px] border-dashed border-gray-400 rounded-lg bg-white overflow-hidden group-component ${isSelected ? 'selected' : ''}`}
    >
      {/* Header with 8px visible bar and centered label; active drag area extends 6px below bar */}
      <div className="flex flex-col">
        {/* 8px visible colored bar, 14px active drag handle */}
        <div
          data-drag-handle="group"
          onPointerDown={(e) => { e.stopPropagation(); onDragStart?.(e, id, 'group'); }}
          style={{ touchAction: 'none', userSelect: 'none', background: `linear-gradient(to bottom, ${createdColor || UNKNOWN_USER_COLOR} 8px, transparent 8px)` }}
          className={`h-[14px] w-full drag-handle-area ${tool === 'select' ? 'cursor-move' : ''}`}
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
onClick={(e) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        const boardX = e.clientX - rect.left + e.currentTarget.scrollLeft;
        const boardY = e.clientY - rect.top + e.currentTarget.scrollTop;
        console.log('Group content click (board-global):', { x: boardX, y: boardY });
      }}
            />
          ) : (
            <div
              onClick={handleLabelClick}
              className={`text-sm font-medium ${tool === 'select' ? 'cursor-text' : ''} hover:bg-gray-50 rounded px-1 py-0.5 text-center`}
            >
              {groupLabel || 'Group'}
            </div>
          )}
        </div>
      </div>
      
      {/* Content area (cards are positioned on the canvas via their own references) */}
      <div className="flex-1" style={{ padding: '0.5rem', paddingTop: '0' }}></div>
    </div>
  );
};

export default Group;
