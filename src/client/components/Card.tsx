import { useState, useEffect, useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';
import logger from '../utils/logger';

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
  onTextChange?: (id: string, newText: string) => void;
  onSelect?: (id: string) => void;
}

export const Card: React.FC<CardProps> = ({
  id,
  text,
  x,
  y,
  width = CARD_WIDTH,
  height = 60,
  isSelected = false,
  onTextChange,
  onSelect
}) => {
  const [cardText, setCardText] = useState(text);
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(20);

  logger.card(`Rendering card ${id}, isSelected=${isSelected}`);

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
    width: `${width}px`,
    minHeight: `${height}px`,
  };

  const handleTextChange = (newText: string) => {
    setCardText(newText);
    if (onTextChange) {
      onTextChange(id, newText);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    // Get the bounding rectangle of the card
    const rect = e.currentTarget.getBoundingClientRect();
    
    // Calculate click position relative to the card
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    // Check if click is in the drag handle (blue bar)
    const isInDragHandle = clickY < 8; // Blue bar is 8px tall
    
    // Check if click is in the 6px selection zone inside the border
    // For left, right, and bottom borders
    const isInSelectionZone =
      clickX < 6 ||                     // Left selection zone (6px)
      clickX > rect.width - 6 ||        // Right selection zone (6px)
      clickY > rect.height - 6;         // Bottom selection zone (6px)
    
    logger.card(`Click on card ${id} at (${clickX}, ${clickY}), drag handle: ${isInDragHandle}, selection zone: ${isInSelectionZone}`);
    
    if (isInDragHandle || isInSelectionZone) {
      e.stopPropagation();
      e.preventDefault();
      if (onSelect) {
        logger.card(`Calling onSelect for ${id} from ${isInDragHandle ? 'drag handle' : 'selection zone'}`);
        onSelect(id);
      } else {
        logger.card(`onSelect handler not defined for ${id}`);
      }
      return;
    }
    
    // For content area, proceed with normal click handling
    // (which will trigger text editing)
    logger.card(`Click in content area of card ${id}`);
  };

  const handleContentClick = () => {
    logger.card(`Content click on card ${id}, entering edit mode`);
    // Start editing on single click
    setIsEditing(true);
  };

  // Auto-enter edit mode when card is created with empty text
  useEffect(() => {
    if (cardText === '' && !isEditing) {
      logger.card(`Empty text in card ${id}, auto-entering edit mode`);
      setIsEditing(true);
    }
  }, [cardText]);

  // Auto-focus and select all text when editing starts
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      logger.card(`Editing mode in card ${id}, focusing textarea`);
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleClick}
      className={`absolute border-2 border-solid border-gray-800 rounded-lg bg-white flex flex-col overflow-hidden card-component ${isSelected ? 'selected' : ''}`}
    >
      {/* Drag handle - 8px blue bar at top */}
      <div
        {...listeners}
        {...attributes}
        className="h-2 w-full bg-blue-500 cursor-move drag-handle-area"
      ></div>
      
      {/* Content area */}
      <div className="flex-1" style={{ padding: '0.5rem' }}>
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={cardText}
            onChange={(e) => {
              handleTextChange(e.target.value);
              // Update height as user types
              setTimeout(updateHeight, 0);
            }}
            onBlur={() => {
              logger.card(`Editing blur in card ${id}, exiting edit mode`);
              setIsEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                logger.card(`Enter pressed in card ${id}, exiting edit mode`);
                setIsEditing(false);
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