/**
 * PinOverlay Component
 *
 * Renders clickable pin indicators over components to enable wire creation.
 * Shows when hovering over a component or when creating a wire.
 */

import React, { useEffect, useState } from 'react';

interface PinInfo {
  name: string;
  x: number;  // CSS pixels
  y: number;  // CSS pixels
  signals?: Array<{ type: string; signal?: string }>;
}

interface PinOverlayProps {
  componentId: string;
  componentX: number;
  componentY: number;
  onPinClick: (componentId: string, pinName: string, x: number, y: number) => void;
  showPins: boolean;
}

export const PinOverlay: React.FC<PinOverlayProps> = ({
  componentId,
  componentX,
  componentY,
  onPinClick,
  showPins,
}) => {
  const [pins, setPins] = useState<PinInfo[]>([]);

  useEffect(() => {
    // Get pin info from wokwi-element
    const element = document.getElementById(componentId);
    if (element && (element as any).pinInfo) {
      setPins((element as any).pinInfo);
    }
  }, [componentId]);

  if (!showPins || pins.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: `${componentX + 6}px`, // +6px for wrapper padding (4px padding + 2px border)
        top: `${componentY + 6}px`,
        pointerEvents: 'none',
        zIndex: 1002, // Above property dialog (1001)
      }}
    >
      {pins.map((pin) => {
        // Pin coordinates are already in CSS pixels
        const pinX = pin.x;
        const pinY = pin.y;

        return (
          <div
            key={pin.name}
            onClick={(e) => {
              e.stopPropagation();
              onPinClick(componentId, pin.name, componentX + 6 + pinX, componentY + 6 + pinY);
            }}
            style={{
              position: 'absolute',
              left: `${pinX - 6}px`,
              top: `${pinY - 6}px`,
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: 'rgba(0, 200, 255, 0.7)',
              border: '2px solid white',
              cursor: 'crosshair',
              pointerEvents: 'all',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(0, 255, 100, 1)';
              e.currentTarget.style.transform = 'scale(1.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(0, 200, 255, 0.7)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
            title={pin.name}
          />
        );
      })}
    </div>
  );
};
