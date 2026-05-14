/**
 * Default auto-save implementation — registers itself with the skeleton hook
 * at module load. Importing this file as a side-effect (in main.tsx) wires
 * the editor up; deleting that import yields a stateless OSS build.
 *
 * The body is the original useAutoSaveProject logic refactored to push state
 * via `emit()` instead of useState, so React's hooks rules don't constrain it.
 * Watches the auth + currentProject stores for eligibility changes, watches
 * the simulator + editor stores for dirty detection, debounces saves at
 * 2.5 s, flushes on beforeunload via fetch keepalive.
 */

import { updateProject } from '../services/projectService';
import { useAuthStore } from '../store/useAuthStore';
import { useEditorStore } from '../store/useEditorStore';
import { useProjectStore } from '../store/useProjectStore';
import { useSimulatorStore } from '../store/useSimulatorStore';
import { buildSavePayload, computeProjectStateHash } from '../utils/projectPayload';
import {
  installAutoSaveImpl,
  type AutoSaveImpl,
  type AutoSaveState,
  type AutoSaveStatus,
} from './useAutoSaveProject';

const DEBOUNCE_MS = 2500;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const realImpl: AutoSaveImpl = (emit) => {
  let status: AutoSaveStatus = 'idle';
  let lastSavedAt: number | null = null;
  let errorMessage: string | null = null;

  const push = () => emit({ status, lastSavedAt, errorMessage });
  const setStatus = (s: AutoSaveStatus) => { status = s; push(); };

  let lastSavedHash: string | null = null;
  let inFlight = false;
  let debounceTimer: number | null = null;
  let projectId: string | null = null;

  const flushSave = async () => {
    if (inFlight) return;
    if (!projectId) return;
    const currentHash = computeProjectStateHash();
    if (currentHash === lastSavedHash) return;

    inFlight = true;
    setStatus('saving');
    try {
      const payload = buildSavePayload();
      // updateProject tolerates an omitted name on update; auto-save never
      // renames a project, so strip the create-only fields explicitly.
      const { name: _name, description: _desc, is_public: _pub, ...rest } = payload;
      void _name; void _desc; void _pub;
      await updateProject(projectId, rest);
      lastSavedHash = currentHash;
      lastSavedAt = Date.now();
      errorMessage = null;
      setStatus('saved');
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { detail?: string } } };
      const detail = e?.response?.data?.detail;
      const sc = e?.response?.status;
      errorMessage = detail ?? (sc ? `HTTP ${sc}` : 'network error');
      setStatus('error');
    } finally {
      inFlight = false;
      // Coalesced changes during the in-flight save: re-evaluate.
      if (computeProjectStateHash() !== lastSavedHash) {
        scheduleSave();
      }
    }
  };

  const scheduleSave = () => {
    if (debounceTimer !== null) window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      debounceTimer = null;
      void flushSave();
    }, DEBOUNCE_MS);
  };

  const onChange = () => {
    if (!projectId) return;
    const currentHash = computeProjectStateHash();
    if (currentHash === lastSavedHash) {
      if (status !== 'saved' && status !== 'idle') setStatus('saved');
      return;
    }
    setStatus('dirty');
    scheduleSave();
  };

  const reset = () => {
    const user = useAuthStore.getState().user;
    const proj = useProjectStore.getState().currentProject;
    // Only the project owner can auto-save. Viewing someone else's project
    // (admin inspection, browsing public projects) leaves the hook idle —
    // the backend correctly rejects non-owner PUTs with 403, and surfacing
    // those failures as "save fail" to the user is misleading.
    const eligible =
      !!user && !!proj && UUID_RE.test(proj.id) && user.username === proj.ownerUsername;
    projectId = eligible ? proj!.id : null;
    // Take a snapshot of the freshly-loaded state — this is the baseline for
    // dirty detection. Without it, the very first change after load would
    // fire an auto-save of the just-loaded project against itself.
    lastSavedHash = eligible ? computeProjectStateHash() : null;
    errorMessage = null;
    setStatus('idle');
    if (debounceTimer !== null) {
      window.clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  };

  reset();

  const unsubAuth = useAuthStore.subscribe((s, prev) => {
    if (s.user?.id !== prev.user?.id) reset();
  });
  const unsubProject = useProjectStore.subscribe((s, prev) => {
    if (s.currentProject?.id !== prev.currentProject?.id) reset();
  });
  const unsubSim = useSimulatorStore.subscribe(onChange);
  const unsubEditor = useEditorStore.subscribe(onChange);

  // Best-effort flush on tab close — fetch keepalive survives unload
  // (unlike sendBeacon, it supports PUT and includes credentials).
  const onBeforeUnload = () => {
    if (!projectId) return;
    const currentHash = computeProjectStateHash();
    if (currentHash === lastSavedHash) return;
    const payload = buildSavePayload();
    const { name: _n, description: _d, is_public: _p, ...rest } = payload;
    void _n; void _d; void _p;
    try {
      fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        credentials: 'include',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rest),
      });
    } catch {
      /* no-op */
    }
  };
  window.addEventListener('beforeunload', onBeforeUnload);

  return () => {
    unsubAuth();
    unsubProject();
    unsubSim();
    unsubEditor();
    window.removeEventListener('beforeunload', onBeforeUnload);
    if (debounceTimer !== null) window.clearTimeout(debounceTimer);
  };
};

installAutoSaveImpl(realImpl);

// Re-export the public types so callers that previously imported them from
// './useAutoSaveProject' keep working if they accidentally pull from this
// module. The real source of truth is ./useAutoSaveProject.
export type { AutoSaveImpl, AutoSaveState, AutoSaveStatus };
