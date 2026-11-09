import { useState, useEffect, useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useElementSelection } from '../hooks/useElementSelection.js';
import { UNKNOWN_USER_COLOR } from '../../shared/userColorNormalization.js';

const CARD_WIDTH = 200; // px
const LINE_HEIGHT = 20; // px

interface CardProps {
  id: string;
  text: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  isSelected: boolean;
  dragOffset?: { x: number; y: number } | null;
  onTextChange?: (id: string, newText: string) => void;
  onTextCommit?: (id: string, newText: string) => void;
  onEditingChange?: (id: string, editing: boolean) => void;
  onSelect?: (id: string, ctrlKey?: boolean) => void;
  onCardClick?: (id: string, ctrlKey: boolean) => void;
  createdBy?: string;
  createdColor?: string;
  autoFocus?: boolean;
}

export const Card: React.FC<CardProps> = ({
  id,
  text,
  x,
  y,
  width = CARD_WIDTH,
  height = 60,
  isSelected = false,
  dragOffset = null,
  onTextChange,
  onTextCommit,
  onEditingChange,
  onSelect,
  onCardClick,
  createdBy,
  createdColor,
  autoFocus = false,
}) => {
  const [cardText, setCardText] = useState(text);
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(20);
  const { isDraggingRef, handleMouseDown, handleMouseUp, handleMouseMove } = useElementSelection(
    id,
    onCardClick,
    2
  );

  useEffect(() => {
    if (!isEditing && text !== cardText) {
      setCardText(text);
    }
  }, [text, isEditing, cardText]);

  useEffect(() => {
    onEditingChange?.(id, isEditing);
  }, [id, isEditing, onEditingChange]);

  useEffect(() => {
    if (!isEditing) {
      requestAnimationFrame(updateHeight);
    }
  }, [text, isEditing]);

  const updateHeight = () => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const height = textareaRef.current.scrollHeight;
      setContentHeight(Math.max(height, 20));
      textareaRef.current.style.height = `${height}px`;
    } else if (!isEditing && textRef.current) {
      const height = textRef.current.scrollHeight;
      setContentHeight(Math.max(height, 20));
    }
  };

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id,
    data: { type: 'card', x, y }
  });
  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : (dragOffset ? `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0)` : undefined),
    left: `${x}px`,
    top: `${y}px`,
    width: `${width}px`,
    minHeight: `${height}px`,
    zIndex: 2,
  };

  const handleTextChange = (newText: string) => {
    setCardText(newText);
    if (onTextChange) {
      onTextChange(id, newText);
    }
  };

  const commitText = () => {
    if (onTextCommit) {
      onTextCommit(id, cardText);
    }
  };



  const handleContentClick = () => {
    // Start editing on single click
    setIsEditing(true);
  };

  // Auto-focus and select all text when editing starts
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  // Enter edit mode on mount when autoFocus is true
  useEffect(() => {
    if (autoFocus && !isEditing) {
      setIsEditing(true);
    }
  }, [autoFocus, isEditing]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-card-id={id}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      onClick={(e) => e.stopPropagation()}
      className={`absolute border-2 border-solid border-gray-800 rounded-lg bg-white flex flex-col overflow-hidden card-component ${isSelected ? 'selected' : ''}`}
    >
      {/* Drag handle - 8px visible bar, 14px active area */}
      <div
        {...listeners}
        {...attributes}
        className="h-[14px] w-full cursor-move drag-handle-area"
        style={{
          background: `linear-gradient(to bottom, ${createdColor || UNKNOWN_USER_COLOR} 8px, transparent 8px)`
        }}
      ></div>
      
      {/* Content area */}
      <div className="flex-1">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={cardText}
            onChange={(e) => {
              handleTextChange(e.target.value);
            }}
            onBlur={() => {
              setIsEditing(false);
              commitText();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                setIsEditing(false);
                commitText();
              }
            }}
            className="outline-none w-full bg-blue-50 rounded resize-none"
            style={
              {
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                lineHeight: `${LINE_HEIGHT}px`,
                minHeight: '20px',
                boxSizing: 'border-box',
                border: 'none',
                marginLeft: '8px',
                marginRight: '8px',
                height: `${contentHeight}px`
              }
            }
          />
        ) : (
          <div
            ref={textRef}
            onClick={handleContentClick}
            className="w-full cursor-text hover:bg-gray-50 rounded"
            style={
              {
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                lineHeight: `${LINE_HEIGHT}px`,
                minHeight: '20px',
                boxSizing: 'border-box',
                marginLeft: '8px',
                marginRight: '8px',
                height: `${contentHeight}px`
              }
            }
          >
            {cardText || 'Click to edit'}
          </div>
        )}
      </div>
    </div>
  );
};

export default Card;
