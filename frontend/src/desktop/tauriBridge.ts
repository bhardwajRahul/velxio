/**
 * Thin typed wrapper around the Tauri IPC surface used by the desktop
 * frontend modules. Falls back to `null` when the global isn't present,
 * letting components render gracefully when the bundle is somehow
 * loaded outside Tauri (during `vite dev` against a regular browser
 * tab, for instance).
 */

export type ValidationResult = {
  valid: boolean;
  plan?: string | null;
  status?: string | null;
  reason_code?: string | null;
  trial_ends_at?: string | null;
  subscription_period_end?: string | null;
  entitlements?: Record<string, boolean>;
};

export type TauriInvoke = <T = unknown>(
  cmd: string,
  args?: Record<string, unknown>,
) => Promise<T>;

export type TauriListen = <T = unknown>(
  event: string,
  cb: (payload: { payload: T }) => void,
) => Promise<() => void>;

type TauriGlobal = {
  core?: { invoke?: TauriInvoke };
  invoke?: TauriInvoke;
  event?: { listen?: TauriListen };
};

function tauri(): TauriGlobal | null {
  const w = window as { __TAURI__?: TauriGlobal };
  return w.__TAURI__ ?? null;
}

export function isTauri(): boolean {
  return tauri() !== null;
}

export const invoke: TauriInvoke = async (cmd, args) => {
  const t = tauri();
  if (!t) throw new Error('Tauri runtime not available');
  const fn = t.core?.invoke ?? t.invoke;
  if (!fn) throw new Error('Tauri invoke handler not available');
  return fn(cmd, args);
};

export const listen: TauriListen = async (event, cb) => {
  const t = tauri();
  if (!t?.event?.listen) {
    // No-op subscription if event API isn't ready (e.g. during `vite dev`).
    return () => undefined;
  }
  return t.event.listen(event, cb);
};

export async function openExternal(url: string): Promise<void> {
  const t = tauri();
  if (!t) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  // tauri-plugin-shell exposes `plugin:shell|open`. The exact JS API
  // depends on the runtime version, so try both paths.
  try {
    await invoke('plugin:shell|open', { path: url });
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

function randomNonce(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function beginSignIn(apiBase = 'https://velxio.dev'): Promise<string> {
  const state = randomNonce();
  await invoke('license_register_nonce', { nonce: state });
  const signInUrl =
    `${apiBase.replace(/\/+$/, '')}/auth/desktop?state=${encodeURIComponent(state)}`;
  await openExternal(signInUrl);
  return state;
}
