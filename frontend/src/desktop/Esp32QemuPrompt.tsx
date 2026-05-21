/**
 * ESP32 QEMU optional-download prompt.
 *
 * Active only in the Tauri desktop build (mounted from main.tsx
 * behind `VITE_DESKTOP=true`). Watches `useSimulatorStore.boards` for
 * the first ESP32 selection; if QEMU isn't installed in the user's
 * data folder, shows a one-time modal asking whether to download it
 * (~42 MB, takes a minute on a decent connection).
 *
 * Phase 2: the Tauri `esp32_qemu_install` command returns an error
 * ("not wired up yet"). The modal still renders the install affordance
 * so we can verify the UX flow end-to-end; the wiring lands in
 * Phase 5 alongside the rest of the distribution endpoints.
 */

import { useEffect, useState } from 'react';
import { useSimulatorStore } from '../store/useSimulatorStore';
import type { BoardKind } from '../types/board';

const ESP32_KINDS: BoardKind[] = ['esp32', 'esp32-s3', 'esp32-c3'];

type QemuStatus = { installed: boolean; path?: string | null; version?: string | null };

type TauriInvoke = <T = unknown>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

function tauriInvoke(): TauriInvoke | null {
  const w = window as { __TAURI__?: { core?: { invoke?: TauriInvoke }; invoke?: TauriInvoke } };
  return w.__TAURI__?.core?.invoke ?? w.__TAURI__?.invoke ?? null;
}

export const Esp32QemuPrompt = () => {
  const boards = useSimulatorStore((s) => s.boards);
  const hasEsp32 = boards.some((b) => ESP32_KINDS.includes(b.boardKind));
  const [status, setStatus] = useState<QemuStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const invoke = tauriInvoke();
    if (!invoke) return;
    invoke<QemuStatus>('esp32_qemu_status').then(setStatus).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!hasEsp32 || !status || status.installed || dismissed) return;
    setOpen(true);
  }, [hasEsp32, status, dismissed]);

  if (!open) return null;

  const onInstall = async () => {
    setErr(null);
    setInstalling(true);
    const invoke = tauriInvoke();
    if (!invoke) {
      setErr('Tauri runtime not available.');
      setInstalling(false);
      return;
    }
    try {
      await invoke('esp32_qemu_install');
      const fresh = await invoke<QemuStatus>('esp32_qemu_status');
      setStatus(fresh);
      if (fresh.installed) setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setInstalling(false);
    }
  };

  const onSkip = () => {
    setDismissed(true);
    setOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 9500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: 420,
          background: '#1e1e23',
          color: '#e6e6e9',
          border: '1px solid #2c2c33',
          borderRadius: 8,
          padding: 24,
          boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
        }}
      >
        <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>
          ESP32 support not installed
        </h2>
        <p style={{ margin: '0 0 16px', color: '#aaa', lineHeight: 1.5 }}>
          ESP32 boards need an additional QEMU runtime (~42 MB). One-time
          download. You can keep using AVR and RP2040 boards without it.
        </p>
        {err && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 4,
              background: '#3a1a1a',
              color: '#ff8585',
              fontSize: 13,
              marginBottom: 12,
            }}
          >
            {err}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onSkip}
            disabled={installing}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              color: '#aaa',
              border: '1px solid #2c2c33',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Not now
          </button>
          <button
            type="button"
            onClick={onInstall}
            disabled={installing}
            style={{
              padding: '8px 16px',
              background: '#007acc',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: installing ? 'wait' : 'pointer',
              opacity: installing ? 0.7 : 1,
            }}
          >
            {installing ? 'Downloading…' : 'Download ESP32 support'}
          </button>
        </div>
      </div>
    </div>
  );
};
