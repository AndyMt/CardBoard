import { useState } from 'react';
import { Card as CardType } from '../../types/Card';
import type { Connection } from '../../types/Card.js';

interface ConnectionRendererProps {
  cards: CardType[];
  selectedTool: 'select' | 'card' | 'group' | 'connection';
  connectionSourceId: string | null;
  setConnectionSourceId: (id: string | null) => void;
  connectionPointer: { x: number; y: number } | null;
  setConnectionPointer: (p: { x: number; y: number } | null) => void;
  getBoardCoords: (e: React.MouseEvent<HTMLDivElement>) => { x: number; y: number };
  onConnectionComplete: (sourceId: string, targetId: string) => void;
}

export const ConnectionRenderer: React.FC<ConnectionRendererProps> = ({
  cards,
  selectedTool,
  connectionSourceId,
  setConnectionSourceId,
  connectionPointer,
  setConnectionPointer,
  getBoardCoords,
  onConnectionComplete,
}) => {
  const handleConnectionMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (selectedTool !== 'connection' || !connectionSourceId) return;
    setConnectionPointer(getBoardCoords(e));
  };

  const handleConnectionMouseUp = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (selectedTool !== 'connection' || !connectionSourceId) return;
    e.preventDefault();
    e.stopPropagation();

    const el = document.elementFromPoint(e.clientX, e.clientY);
    const targetCardEl = el?.closest('[data-card-id]');
    const targetId = targetCardEl?.dataset.cardId ?? null;

    if (targetId && targetId !== connectionSourceId) {
      onConnectionComplete(connectionSourceId, targetId);
    }

    setConnectionSourceId(null);
    setConnectionPointer(null);
  };

  // Preview line during active connection drag
  let previewLine = null;
  if (connectionSourceId && connectionPointer) {
    const source = cards.find(c => c.id === connectionSourceId);
    if (source) {
      const sx = (source.x || 0) + (source.width || 200) / 2;
      const sy = (source.y || 0) + (source.height || 60) / 2;
      const px = connectionPointer.x;
      const py = connectionPointer.y;
      const dx = px - sx;
      const dy = py - sy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      previewLine = (
        <div className="absolute pointer-events-none" style={{
          left: sx,
          top: sy,
          width: dist,
          height: 2,
          backgroundColor: '#3b82f6',
          transformOrigin: '0% 50%',
          transform: `rotate(${angle}deg)`,
        }} />
      );
    }
  }

  // Connector lines
  const connectorLines = cards.map(sourceCard => {
    const connections = sourceCard.connections || [];
    const targetConnCount = new Map<string, number>();
    connections.forEach((conn: Connection) => {
      targetConnCount.set(conn.targetCardId, (targetConnCount.get(conn.targetCardId) || 0) + 1);
    });
    const targetConnIndex = new Map<string, number>();
    return connections.map((conn: Connection, i: number) => {
      const target = cards.find(c => c.id === conn.targetCardId);
      if (!target) return null;
      const sx = (sourceCard.x || 0) + (sourceCard.width || 200) / 2;
      const sy = (sourceCard.y || 0) + (sourceCard.height || 60) / 2;
      const tx = (target.x || 0) + (target.width || 200) / 2;
      const ty = (target.y || 0) + (target.height || 60) / 2;
      const dx = tx - sx;
      const dy = ty - sy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const total = targetConnCount.get(conn.targetCardId) || 1;
      let index = targetConnIndex.get(conn.targetCardId) || 0;
      targetConnIndex.set(conn.targetCardId, index + 1);
      let osx = sx, osy = sy, otx = tx, oty = ty;
      if (total > 1 && dist > 0) {
        const spacing = 15;
        const offset = (index - (total - 1) / 2) * spacing;
        const px = -dy / dist;
        const py = dx / dist;
        osx = sx + px * offset;
        osy = sy + py * offset;
        otx = tx + px * offset;
        oty = ty + py * offset;
      }
      const odx = otx - osx;
      const ody = oty - osy;
      const odist = Math.sqrt(odx * odx + ody * ody);
      const angle = Math.atan2(ody, odx) * 180 / Math.PI;
      return (
        <div key={`${sourceCard.id}-${i}`} className="absolute pointer-events-none" style={{
          left: osx,
          top: osy,
          width: odist,
          height: 2,
          backgroundColor: '#3b82f6',
          transformOrigin: '0% 50%',
          transform: `rotate(${angle}deg)`,
        }}>
          <div style={{
            position: 'absolute',
            right: -4,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 0,
            height: 0,
            borderStyle: 'solid',
            borderWidth: '4 0 4 6',
            borderColor: 'transparent transparent transparent #3b82f6',
          }} />
        </div>
      );
    });
  });

  const isConnectionActive = selectedTool === 'connection' && connectionSourceId !== null;

  return (
    <div
      className="absolute inset-0"
      style={{
        pointerEvents: isConnectionActive ? 'auto' : 'none',
      }}
      onMouseMove={handleConnectionMouseMove}
      onMouseUp={handleConnectionMouseUp}
    >
      {previewLine}
      {connectorLines.flat()}
    </div>
  );
};
