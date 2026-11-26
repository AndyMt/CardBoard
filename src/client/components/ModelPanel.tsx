import React from 'react';
import type { Card } from '../../types/Card.js';
import type { Group } from '../../types/Group.js';
import type { View } from '../../types/View.js';

interface ModelPanelProps {
  cards: Card[];
  groups: Group[];
  activeViewId?: string;
  onPlace?: (elementId: string, elementType: 'card' | 'group', x: number, y: number) => void;
}

export const ModelPanel: React.FC<ModelPanelProps> = ({
  cards,
  groups,
  activeViewId,
  onPlace,
}) => {
  const startDrag = (elementId: string, elementType: 'card' | 'group') => (e: React.DragEvent) => {
    e.dataTransfer.setData('application/cardboard-element', JSON.stringify({ elementId, elementType }));
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="w-80 bg-gray-50 border-r border-gray-200 flex flex-col h-full">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Model</h2>
        <p className="text-xs text-gray-500 mt-1">
          Elements available to place in the{activeViewId ? ' current view' : ' view'}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <div className="text-xs font-semibold text-gray-400 uppercase px-2 mb-1">Cards</div>
        {cards.slice().sort((a, b) => (a.text || '').localeCompare(b.text || '')).map((card) => (
          <div
            key={card.id}
            draggable
            onDragStart={startDrag(card.id, 'card')}
            className="group relative flex items-center justify-between px-3 py-2 rounded border border-gray-200 bg-white text-gray-700 text-sm cursor-grab active:cursor-grabbing hover:border-gray-300 hover:bg-gray-100 transition"
            data-element-id={card.id}
            data-element-type="card"
          >
            <span title={card.text}>{card.text}</span>
            <span className="text-[10px] text-gray-400 ml-2">{card.id}</span>
          </div>
        ))}
        {cards.length === 0 && (
          <div className="px-3 py-2 text-xs text-gray-400">No cards</div>
        )}
        <div className="text-xs font-semibold text-gray-400 uppercase px-2 mb-1 mt-3">Groups</div>
        {groups.slice().sort((a, b) => (a.label || '').localeCompare(b.label || '')).map((group) => (
          <div
            key={group.id}
            draggable
            onDragStart={startDrag(group.id, 'group')}
            className="group relative flex items-center justify-between px-3 py-2 rounded border border-gray-200 bg-white text-gray-700 text-sm cursor-grab active:cursor-grabbing hover:border-gray-300 hover:bg-gray-100 transition"
            data-element-id={group.id}
            data-element-type="group"
          >
            <span title={group.label}>{group.label}</span>
            <span className="text-[10px] text-gray-400 ml-2">{group.id}</span>
          </div>
        ))}
        {groups.length === 0 && (
          <div className="px-3 py-2 text-xs text-gray-400">No groups</div>
        )}
      </div>
    </aside>
  );
};

export default ModelPanel;
