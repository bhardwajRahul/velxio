export interface WireEndpoint {
  componentId: string;
  pinName: string;
  x: number;
  y: number;
}

export interface Wire {
  id: string;
  start: WireEndpoint;
  end: WireEndpoint;
  /** Intermediate waypoints clicked by the user during wire creation */
  waypoints: { x: number; y: number }[];
  color: string;
}

export interface WireInProgress {
  startEndpoint: WireEndpoint;
  waypoints: { x: number; y: number }[];
  color: string;
  currentX: number;
  currentY: number;
}
