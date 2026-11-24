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
  editingConnectorId: string | null;
  connectorNameDraft: string;
  onConnectorNameStart: (id: string) => void;
  onConnectorNameChange: (id: string, newName: string) => void;
  onConnectorNameCommit: (id: string, newName: string) => void;
  onConnectorNameCancel: (id: string) => void;
}

const LABEL_OFFSET = 4;

export const ConnectionRenderer: React.FC<ConnectionRendererProps> = ({
  cards,
  connectionSourceId,
  connectionPointer,
  selectedTool,
  selectedConnectorIds,
  onConnectorSelect,
  editingConnectorId,
  connectorNameDraft,
  onConnectorNameStart,
  onConnectorNameChange,
  onConnectorNameCommit,
  onConnectorNameCancel,
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
      const sourceTip = lineRectEntryPoint(otx, oty, osx, osy, {
        x: sourceCard.x || 0,
        y: sourceCard.y || 0,
        width: sourceCard.width || 200,
        height: sourceCard.height || 60,
      });
      const tip = lineRectEntryPoint(osx, osy, otx, oty, {
        x: target.x || 0,
        y: target.y || 0,
        width: target.width || 200,
        height: target.height || 60,
      });
      const odx = tip.x - sourceTip.x;
      const ody = tip.y - sourceTip.y;
      const odist = Math.sqrt(odx * odx + ody * ody);
      const angle = Math.atan2(ody, odx) * 180 / Math.PI;
      const isEditing = conn.id === editingConnectorId;
      const isSelected = selectedConnectorIds.includes(conn.id);
      const handleConnectorClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (selectedTool === 'connection') return;
        onConnectorSelect(conn.id, e.ctrlKey);
      };
      const handleLabelClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onConnectorNameStart?.(conn.id);
      };
      const handleLabelInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation();
        onConnectorNameChange(conn.id, e.target.value);
      };
      const handleLabelInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        e.stopPropagation();
        onConnectorNameCommit(conn.id, e.target.value);
      };
      const handleLabelInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          onConnectorNameCommit(conn.id, e.currentTarget.value);
        } else if (e.key === 'Escape') {
          onConnectorNameCancel(conn.id);
        }
      };

      // Label position: anchor the label's inner edge at a gap distance from
      // the connector line so longer labels never overlap the line.
      // Roughly vertical connectors -> label to the right of the line.
      // Roughly horizontal connectors -> label below the line.
      const absAngle = Math.abs(angle);
      const isVertical = absAngle > 45 && absAngle < 135;
      const mx = (sourceTip.x + tip.x) / 2;
      const my = (sourceTip.y + tip.y) / 2;
      let labelLeft: number | null = null;
      let labelTop: number | null = null;
      let labelTransform: string;
      if (isVertical) {
        // Label to the right of the line; left edge of box at the gap,
        // text left-aligned so it extends rightward (away from the line).
        labelLeft = mx + LABEL_OFFSET;
        labelTop = my;
        labelTransform = 'translateY(-50%)';
      } else {
        // Label below the line; left edge of box at midpoint,
        // text left-aligned so it extends rightward below the line.
        labelLeft = mx;
        labelTop = my + LABEL_OFFSET;
        labelTransform = 'none';
      }

      const labelValue = isEditing ? connectorNameDraft : (conn.name || '');
      const labelDisplay = isEditing ? labelValue : (conn.name || '?');

      return (
        <>
          <div key={conn.id + '-line'} className="absolute" style={{
            left: sourceTip.x,
            top: sourceTip.y,
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
          <div key={conn.id + '-label'} style={{
            position: 'absolute',
            left: labelLeft,
            top: labelTop,
            transform: labelTransform,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            zIndex: 2,
            pointerEvents: 'auto',
            userSelect: 'none',
          }}
          onClick={handleLabelClick}
          >
            {isEditing ? (
              <input
                autoFocus
                value={labelValue}
                onChange={handleLabelInputChange}
                onBlur={handleLabelInputBlur}
                onKeyDown={handleLabelInputKeyDown}
                style={{
                  fontSize: '12px',
                  padding: '2px 4px',
                  border: 'none',
                  borderRadius: 0,
                  outline: 'none',
                  width: 'auto',
                  minWidth: '60px',
                  textAlign: 'left',
                  lineHeight: 1,
                  background: 'transparent',
                }}
              />
            ) : (
              <span style={{
                fontSize: '11px',
                padding: '1px 4px',
                border: 'none',
                borderRadius: 0,
                background: 'transparent',
                color: '#111827',
                cursor: 'default',
                whiteSpace: 'nowrap',
                lineHeight: 1,
                textAlign: 'left',
              }}>
                {labelDisplay}
              </span>
            )}
          </div>
        </>
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
