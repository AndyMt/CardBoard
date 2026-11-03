import { useState, useEffect, useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';

const MAX_CHARS_PER_LINE = 30;
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

const formatTextWithLineBreaks = (text: string): string => {
  if (!text) return '';

  const words = text.split(' ');
  let currentLine = '';
  let result = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= MAX_CHARS_PER_LINE) {
      // Add to current line
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      // Start new line
      if (result) result += '\n';
      result += currentLine;
      currentLine = word;
    }
  }

  // Add the last line
  if (currentLine) {
    if (result) result += '\n';
    result += currentLine;
  }

  return result;
};

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
  const [formattedText, setFormattedText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Format text with line breaks
  useEffect(() => {
    setFormattedText(formatTextWithLineBreaks(cardText));
  }, [cardText]);

  // Calculate height based on line count
  const lineCount = formattedText.split('\n').length;
  const cardHeight = lineCount * LINE_HEIGHT + 40; // 40px for padding/border

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id,
  });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    left: `${x}px`,
    top: `${y}px`,
    width: '200px',
    height: `${cardHeight}px`,
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      className={`
        absolute
        border-2 border-solid ${isSelected ? 'border-blue-500' : 'border-gray-800'}
        rounded-lg p-2
        bg-white shadow-sm
        cursor-pointer
        flex flex-col
        overflow-hidden
      `}
    >
      {isEditing ? (
        <div
          ref={contentRef}
          contentEditable
          suppressContentEditableWarning
          onInput={(e) => handleTextChange(e.currentTarget.textContent || '')}
          onBlur={() => setIsEditing(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              setIsEditing(false);
            }
          }}
          className="outline-none min-h-[20px] whitespace-pre-wrap"
        >
          {cardText}
        </div>
      ) : (
        <div
          onDoubleClick={() => setIsEditing(true)}
          className="min-h-[20px] whitespace-pre-wrap"
        >
          {formattedText || 'Double-click to edit'}
        </div>
      )}
    </div>
  );
};

export default Card;