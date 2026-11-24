import { Card as CardType } from '../../types/Card';
import type { Connection } from '../../types/Connection.js';
import { lineRectEntryPoint } from '../../shared/geometry.js';

interface ConnectionRendererProps {
  cards: CardType[];
  connectionSourceId: string | null;
  connectionPointer: { x: number; y: number } | null;
  selectedTool: string;
  selectedConnectorIds: string[];
  onConnectorSelect: (id: string, ctrlKey: boolean) => void;
}

export const ConnectionRenderer: React.FC<ConnectionRendererProps> = ({
  cards,
  connectionSourceId,
  connectionPointer,
  selectedTool,
  selectedConnectorIds,
  onConnectorSelect,
}) => {
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
          zIndex: 2,
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
      const tip = lineRectEntryPoint(osx, osy, otx, oty, {
        x: target.x || 0,
        y: target.y || 0,
        width: target.width || 200,
        height: target.height || 60,
      });
      const odx = tip.x - osx;
      const ody = tip.y - osy;
      const odist = Math.sqrt(odx * odx + ody * ody);
      const angle = Math.atan2(ody, odx) * 180 / Math.PI;
      const isSelected = selectedConnectorIds.includes(conn.id);
      const handleConnectorClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (selectedTool === 'connection') return;
        onConnectorSelect(conn.id, e.ctrlKey);
      };
      return (
        <div key={conn.id} className="absolute" style={{
          left: osx,
          top: osy,
          width: odist,
          height: 2,
          backgroundColor: '#3b82f6',
          zIndex: 2,
          transformOrigin: '0% 50%',
          transform: `rotate(${angle}deg)`,
          boxShadow: isSelected ? `0 0 3px #3b82f6` : 'none',
        }}
        onClick={handleConnectorClick}
        >
          <div style={{
            position: 'absolute',
            right: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 0,
            height: 0,
            borderStyle: 'solid',
            borderWidth: '6px 0 6px 8px',
            borderColor: 'transparent transparent transparent #3b82f6',
          }} />
        </div>
      );
    });
  });

  return (
    <>
      {previewLine}
      {connectorLines.flat()}
    </>
  );
};
