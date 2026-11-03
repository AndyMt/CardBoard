import { useState } from 'react';
import { DndContext, DragEndEvent } from '@dnd-kit/core';
import Card from './Card.js';
import Group from './Group.js';
import { Card as CardType } from '../../types/Card.js';
import { Group as GroupType } from '../../types/Group.js';

// Client-side model helpers (following MVC pattern)
const createCard = (x: number, y: number): CardType => ({
  id: `card-${Date.now()}`,
  text: '',
  x: x - 100, // Center the card
  y: y - 30,  // Account for header
  width: 200,
  height: 60,
  isSelected: false
});

const createGroup = (x: number, y: number): GroupType => ({
  id: `group-${Date.now()}`,
  label: '',
  x: x - 220, // Center the group
  y: y - 30,  // Account for header
  width: 440,
  height: 440,
  isSelected: false
});

interface BoardViewProps {
  selectedTool: 'select' | 'card' | 'group';
}

export const BoardView: React.FC<BoardViewProps> = ({ selectedTool }) => {
  // State with proper typing
  const [cards, setCards] = useState<CardType[]>([
    {
      id: 'card-1',
      text: 'This is a sample card with some text that should wrap to multiple lines based on the character limit.',
      x: 50,
      y: 100,
      width: 200,
      height: 80,
      isSelected: false,
    },
    {
      id: 'card-2',
      text: 'Short text',
      x: 300,
      y: 100,
      width: 200,
      height: 60,
      isSelected: false,
    },
    {
      id: 'card-3',
      text: 'Another card with a very long text that should demonstrate the word wrapping functionality properly when rendered.',
      x: 50,
      y: 300,
      width: 200,
      height: 80,
      isSelected: false,
    }
  ]);

  const [groups, setGroups] = useState<GroupType[]>([
    {
      id: 'group-1',
      label: 'Sample Group',
      x: 400,
      y: 50,
      width: 440,
      height: 440,
      isSelected: false,
    },
    {
      id: 'group-2',
      label: 'Another Group with a Longer Label',
      x: 400,
      y: 300,
      width: 440,
      height: 440,
      isSelected: false,
    }
  ]);

  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  // Controller methods
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;

    if (active.data.current?.type === 'card') {
      setCards(prev => prev.map(card =>
        card.id === active.id
          ? { ...card, x: card.x + delta.x, y: card.y + delta.y }
          : card
      ));
    } else if (active.data.current?.type === 'group') {
      setGroups(prev => prev.map(group =>
        group.id === active.id
          ? { ...group, x: group.x + delta.x, y: group.y + delta.y }
          : group
      ));
    }
  };

  const handleCardTextChange = (id: string, newText: string) => {
    setCards(prev => prev.map(card =>
      card.id === id ? { ...card, text: newText } : card
    ));
  };

  const handleGroupLabelChange = (id: string, newLabel: string) => {
    setGroups(prev => prev.map(group =>
      group.id === id ? { ...group, label: newLabel } : group
    ));
  };

  const handleSelect = (id: string, type: 'card' | 'group') => {
    setSelectedItems(prev =>
      prev.includes(id)
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const handleBoardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Deselect all when clicking on empty space
    setSelectedItems([]);

    if (selectedTool === 'select') return;

    // Get click position
    const boardRect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - boardRect.left;
    const y = e.clientY - boardRect.top;

    if (selectedTool === 'card') {
      setCards(prev => [...prev, createCard(x, y)]);
    } else if (selectedTool === 'group') {
      setGroups(prev => [...prev, createGroup(x, y)]);
    }
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div
        className="relative w-full h-full bg-gray-100 overflow-auto"
        onClick={handleBoardClick}
      >
        {/* Groups */}
        {groups.map(group => (
          <Group
            key={group.id}
            id={group.id}
            label={group.label}
            x={group.x}
            y={group.y}
            isSelected={selectedItems.includes(group.id)}
            onLabelChange={handleGroupLabelChange}
            onSelect={() => handleSelect(group.id, 'group')}
          />
        ))}

        {/* Cards */}
        {cards.map(card => (
          <Card
            key={card.id}
            id={card.id}
            text={card.text}
            x={card.x}
            y={card.y}
            isSelected={selectedItems.includes(card.id)}
            onTextChange={handleCardTextChange}
            onSelect={() => handleSelect(card.id, 'card')}
          />
        ))}
      </div>
    </DndContext>
  );
};

export default BoardView;
