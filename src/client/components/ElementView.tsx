import React from 'react';

export interface ElementViewProps {
  x: number;
  y: number;
  width?: number;
  height?: number;
  isSelected?: boolean;
  style?: React.CSSProperties;
  className?: string;
  children?: React.ReactNode;
}

export const ElementView = React.forwardRef<HTMLDivElement, ElementViewProps & React.HTMLAttributes<HTMLDivElement>>(
  ({ x, y, width, height, isSelected, style, className, children, ...rest }, ref) => {
    return (
      <div
        ref={ref}
        className={className}
        style={{
          position: 'absolute',
          left: `${x}px`,
          top: `${y}px`,
          width: width ? `${width}px` : undefined,
          minHeight: height ? `${height}px` : undefined,
          ...style,
        }}
      >
        {children}
      </div>
    );
  }
);

ElementView.displayName = 'ElementView';
export default ElementView;
