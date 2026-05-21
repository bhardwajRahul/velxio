/**
 * Velxio Desktop grace banner.
 *
 * Reads `license_status` from the Tauri shell on mount and on every
 * `velxio://license-status` event (emitted by the background checkin
 * loop). Three visible states:
 *
 *   Active     → nothing rendered.
 *   SoftGrace  → amber banner at the top of the window with a
 *                "Reconnect" CTA. Compile + Run still work.
 *   HardGrace  → red banner; we also flip a body class
 *                `vlx-desktop-readonly` so editor buttons can
 *                CSS-disable themselves (the SPA listens for it).
 *   Locked /
 *   Tampered   → frontend should route to the welcome screen; this
 *                component still renders a small banner so the user
 *                isn't left without an explanation if the welcome
 *                screen unmount race wins.
 */

import { useEffect, useMemo, useState } from 'react';
import { invoke, listen } from './tauriBridge';

type Claims = {
  sub: string;
  plan: string;
  ent?: Record<string, boolean>;
  iat: number;
  exp: number;
  trial_ends_at?: number | null;
  subscription_period_end?: number | null;
  hard_grace_hours?: number;
};

type LicenseStatus =
  | { state: 'unauthenticated' }
  | { state: 'active'; claims: Claims }
  | { state: 'soft_grace'; claims: Claims; days_remaining: number }
  | { state: 'hard_grace'; claims: Claims; hours_remaining: number }
  | { state: 'locked'; last_plan: string | null }
  | { state: 'tampered' };

const READONLY_BODY_CLASS = 'vlx-desktop-readonly';

export const GraceBanner = () => {
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    invoke<LicenseStatus>('license_status').then(setStatus).catch(() => undefined);
    let dispose: (() => void) | null = null;
    listen<LicenseStatus>('velxio://license-status', (event) => {
      setStatus(event.payload);
    }).then((off) => {
      dispose = off;
    });
    return () => {
      if (dispose) dispose();
    };
  }, []);

  useEffect(() => {
    if (status?.state === 'hard_grace') {
      document.body.classList.add(READONLY_BODY_CLASS);
    } else {
      document.body.classList.remove(READONLY_BODY_CLASS);
    }
    return () => document.body.classList.remove(READONLY_BODY_CLASS);
  }, [status?.state]);

  const visible = useMemo(() => {
    if (!status) return false;
    return ['soft_grace', 'hard_grace', 'locked', 'tampered'].includes(status.state);
  }, [status]);

  if (!visible || !status) return null;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const next = await invoke<LicenseStatus>('license_refresh');
      setStatus(next);
    } catch (err) {
      console.warn('[license] manual refresh failed:', err);
    } finally {
      setRefreshing(false);
    }
  };

  let message = '';
  let tone: 'warn' | 'error' = 'warn';

  if (status.state === 'soft_grace') {
    const d = status.days_remaining;
    message = `Velxio Desktop is in offline grace. Reconnect to refresh your license. ${d} day${d === 1 ? '' : 's'} remaining.`;
    tone = 'warn';
  } else if (status.state === 'hard_grace') {
    const h = status.hours_remaining;
    message = `Compile and Save are temporarily disabled. Reconnect within ${h}h to restore full access.`;
    tone = 'error';
  } else if (status.state === 'locked') {
    message = `Your Velxio Desktop license has expired offline. Reconnect to continue using the editor.`;
    tone = 'error';
  } else if (status.state === 'tampered') {
    message = `Velxio could not verify the stored license. Sign out and sign in again.`;
    tone = 'error';
  }

  return (
    <div className={`vlx-desktop-grace vlx-desktop-grace-${tone}`}>
      <span className="vlx-desktop-grace-text">{message}</span>
      <button
        type="button"
        className="vlx-desktop-grace-cta"
        onClick={onRefresh}
        disabled={refreshing}
      >
        {refreshing ? 'Checking…' : 'Reconnect now'}
      </button>
    </div>
  );
};
