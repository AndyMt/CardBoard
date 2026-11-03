import { useState, useEffect, useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';

const CARD_WIDTH = 200; // px
const LINE_HEIGHT = 20; // px

interface CardProps {
  id: string;
  text: string;
  x: number;
  y: number;
  isSelected: boolean;
  onTextChange?: (id: string, newText: string) => void;
  onSelect?: (id: string) => void;
}

export const Card: React.FC<CardProps> = ({
  id,
  text,
  x,
  y,
  isSelected,
  onTextChange,
  onSelect
}) => {
  const [cardText, setCardText] = useState(text);
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(20);

  // Measure text height and update both elements
  const updateHeight = () => {
    if (isEditing && textareaRef.current) {
      // For textarea, temporarily set to auto height to measure
      textareaRef.current.style.height = 'auto';
      const height = textareaRef.current.scrollHeight;
      setContentHeight(Math.max(height, 20));
      textareaRef.current.style.height = `${height}px`;
    } else if (!isEditing && textRef.current) {
      // For div, use scrollHeight
      const height = textRef.current.scrollHeight;
      setContentHeight(Math.max(height, 20));
    }
  };

  // Update height when text or mode changes
  useEffect(() => {
    updateHeight();
  }, [cardText, isEditing]);

  // Also update height when refs become available
  useEffect(() => {
    if (textRef.current) updateHeight();
  }, [textRef.current]);

  useEffect(() => {
    if (textareaRef.current) updateHeight();
  }, [textareaRef.current]);

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id,
    data: { type: 'card' }
  });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    left: `${x}px`,
    top: `${y}px`,
    width: `${CARD_WIDTH}px`,
  };

  const handleTextChange = (newText: string) => {
    setCardText(newText);
    if (onTextChange) {
      onTextChange(id, newText);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    // Only select if clicking on the border (not content)
    if (e.target === e.currentTarget && onSelect) {
      onSelect(id);
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleClick}
      className={`
        absolute
        border-2 border-solid ${isSelected ? 'border-blue-500' : 'border-gray-800'}
        rounded-lg
        bg-white
        flex flex-col
        overflow-hidden
      `}
    >
      {/* Drag handle - 8px blue bar at top */}
      <div
        {...listeners}
        {...attributes}
        className="h-2 w-full bg-blue-500 cursor-move"
      ></div>
      
      {/* Content area */}
      <div className="flex-1 p-2">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={cardText}
            onChange={(e) => {
              handleTextChange(e.target.value);
              // Update height as user types
              setTimeout(updateHeight, 0);
            }}
            onBlur={() => setIsEditing(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                setIsEditing(false);
              }
            }}
            className="outline-none w-full bg-blue-50 rounded resize-none"
            style={{
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
              fontFamily: 'inherit',
              fontSize: 'inherit',
              lineHeight: `${LINE_HEIGHT}px`,
              minHeight: '20px',
              boxSizing: 'border-box',
              border: 'none',
              height: `${contentHeight}px`
            }}
          />
        ) : (
          <div
            ref={textRef}
            onClick={handleContentClick}
            className="w-full cursor-text hover:bg-gray-50 rounded"
            style={{
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
              fontFamily: 'inherit',
              fontSize: 'inherit',
              lineHeight: `${LINE_HEIGHT}px`,
              minHeight: '20px',
              boxSizing: 'border-box',
              height: `${contentHeight}px`
            }}
          >
            {cardText || 'Click to edit'}
          </div>
        )}
      </div>
    </div>
  );
};

export default Card;