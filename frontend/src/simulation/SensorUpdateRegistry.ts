/**
 * SensorUpdateRegistry — module-level singleton for React UI → simulation communication.
 *
 * When a sensor's attachEvents() runs it registers a callback keyed by componentId.
 * The SensorControlPanel calls dispatchSensorUpdate() to push new values into the
 * running simulation without any React/Zustand dependency in the simulation layer.
 */

type SensorUpdateCallback = (values: Record<string, number | boolean>) => void;

const registry = new Map<string, SensorUpdateCallback>();

/**
 * Register a callback for a component. Called from inside attachEvents().
 * The callback receives a partial values object (only changed keys).
 */
export function registerSensorUpdate(componentId: string, cb: SensorUpdateCallback): void {
  registry.set(componentId, cb);
}

/**
 * Dispatch new sensor values for a component. Called from SensorControlPanel.
 * No-ops silently if the component has no registered callback.
 */
export function dispatchSensorUpdate(
  componentId: string,
  values: Record<string, number | boolean>,
): void {
  registry.get(componentId)?.(values);
}

/**
 * Unregister a component's callback. Called in the cleanup function returned
 * by attachEvents() so stale callbacks don't persist after simulation stops.
 */
export function unregisterSensorUpdate(componentId: string): void {
  registry.delete(componentId);
}
