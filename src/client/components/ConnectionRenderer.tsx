import { Card as CardType } from '../../types/Card.js';
import type { Connection } from '../../types/Connection.js';
import type { Point } from '../../shared/geometry.js';
import type { ConnectorLabelAnchor, ConnectorRoute } from '../controller/ConnectorLayoutCoordinator.js';

interface ConnectionRendererProps {
  cards: CardType[];
  routes: Map<string, ConnectorRoute>;
  labels: Map<string, ConnectorLabelAnchor>;
  previewRoute: ConnectorRoute | null;
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

const CONNECTOR_COLOR = '#3b82f6';

const renderArrowhead = (dx: number, dy: number): React.ReactNode => {
  let style: React.CSSProperties;
  if (Math.abs(dx) >= Math.abs(dy)) {
    style = dx >= 0
      ? { position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', width: 0, height: 0, borderStyle: 'solid', borderWidth: '6px 0 6px 8px', borderColor: `transparent transparent transparent ${CONNECTOR_COLOR}` }
      : { position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 0, height: 0, borderStyle: 'solid', borderWidth: '6px 8px 6px 0', borderColor: `transparent ${CONNECTOR_COLOR} transparent transparent` };
  } else {
    style = dy >= 0
      ? { position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderStyle: 'solid', borderWidth: '8px 6px 0 6px', borderColor: `${CONNECTOR_COLOR} transparent transparent transparent` }
      : { position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderStyle: 'solid', borderWidth: '0 6px 8px 6px', borderColor: `transparent transparent ${CONNECTOR_COLOR} transparent` };
  }
  return <div style={style} />;
};

export const ConnectionRenderer: React.FC<ConnectionRendererProps> = ({
  cards,
  routes,
  labels,
  previewRoute,
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
  const renderRoute = (
    points: Point[],
    keyPrefix: string,
    opts: { connId?: string; selected: boolean; arrow: boolean },
  ): React.ReactNode[] => {
    const segs: React.ReactNode[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const horizontal = Math.abs(dy) < 0.5;
      const isLast = i === points.length - 2;
      segs.push(
        <div
          key={keyPrefix + '-seg-' + i}
          className="absolute"
          style={{
            left: Math.min(a.x, b.x),
            top: Math.min(a.y, b.y),
            width: horizontal ? Math.max(Math.abs(dx), 2) : 2,
            height: horizontal ? 2 : Math.max(Math.abs(dy), 2) + 2,
            backgroundColor: CONNECTOR_COLOR,
            zIndex: 2,
            pointerEvents: opts.connId ? 'auto' : 'none',
            boxShadow: opts.selected ? `0 0 3px ${CONNECTOR_COLOR}` : 'none',
          }}
          onClick={opts.connId
            ? (e: React.MouseEvent) => {
                e.stopPropagation();
                if (selectedTool === 'connection') return;
                onConnectorSelect(opts.connId!, e.ctrlKey);
              }
            : undefined}
        >
          {opts.arrow && isLast ? renderArrowhead(dx, dy) : null}
        </div>
      );
    }
    return segs;
  };

  const connectorElements = cards.flatMap(sourceCard =>
    (sourceCard.connections || []).map((conn: Connection) => {
      const route = routes.get(conn.id);
      if (!route) return null;
      const anchor = labels.get(conn.id);
      const isEditing = conn.id === editingConnectorId;
      const isSelected = selectedConnectorIds.includes(conn.id);

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

      const isVertical = anchor ? anchor.vertical : false;
      const labelLeft = anchor ? anchor.x : (route.points[0]?.x ?? 0);
      const labelTop = anchor ? anchor.y : (route.points[0]?.y ?? 0);
      const labelTransform = isVertical ? 'translateY(-50%)' : 'translateX(-50%)';

      const labelValue = isEditing ? connectorNameDraft : (conn.name || '');
      const labelDisplay = isEditing ? labelValue : (conn.name || '?');

      const nodes: React.ReactNode[] = renderRoute(route.points, conn.id, {
        connId: conn.id,
        selected: isSelected,
        arrow: true,
      });
      if (anchor) {
        nodes.push(
          <div key={conn.id + '-label'} style={{
            position: 'absolute',
            left: labelLeft,
            top: labelTop,
            transform: labelTransform,
            display: 'flex',
            alignItems: 'center',
            justifyContent: isVertical ? 'flex-start' : 'center',
            zIndex: 3,
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
                padding: '1px',
                border: 'none',
                borderRadius: 0,
                outline: 'none',
                width: 'auto',
                minWidth: '60px',
                textAlign: isVertical ? 'left' : 'center',
                lineHeight: 1,
                background: 'rgba(238, 238, 238, 0.5)',
                }}
              />
            ) : (
              <span style={{
                fontSize: '11px',
                padding: '1px',
                border: 'none',
                borderRadius: 0,
                background: 'rgba(238, 238, 238, 0.5)',
                color: '#111827',
                cursor: 'default',
                whiteSpace: 'nowrap',
                lineHeight: 1,
                textAlign: isVertical ? 'left' : 'center',
              }}>
                {labelDisplay}
              </span>
            )}
          </div>
        );
      }
      return nodes;
    })
  );

  return (
    <>
      {previewRoute ? renderRoute(previewRoute.points, 'preview', { selected: false, arrow: false }) : null}
      {connectorElements.flat()}
    </>
  );
};
