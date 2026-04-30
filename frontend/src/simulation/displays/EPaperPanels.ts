/**
 * EPaperPanels — per-panel geometry + controller assignments.
 *
 * Phase 1 ships the SSD168x mono family. Adding a panel = add an entry
 * here; the Web Component, simulation hook, and ESP32 backend slave all
 * key off the `id` field. See `test/test_epaper/autosearch/06_svg_layouts.md`
 * for sources.
 */

export type EPaperControllerFamily = 'ssd168x';

export interface EPaperPanelConfig {
  /** Unique kebab-case identifier — also the metadataId used by the registry. */
  id: string;
  /** Human-readable label (gallery card). */
  name: string;
  /** Active area resolution, in panel-native pixels. */
  width: number;
  height: number;
  /** Panel body width including bezel + FPC strip (CSS px). */
  bodyW: number;
  bodyH: number;
  /** Bezel margin on the canvas (CSS px). */
  bezelPx: number;
  /** FPC tail height (CSS px). */
  fpcStripPx: number;
  /** Default refresh duration the emulator drives BUSY high for (ms). */
  refreshMs: number;
  /** Controller family — picks the decoder. */
  controllerFamily: EPaperControllerFamily;
  /** Concrete controller IC (informational, drives the Inspector tooltip). */
  controllerIc: string;
}

export const PANEL_CONFIGS: Record<string, EPaperPanelConfig> = {
  // ── 1.54" 200×200 — the canonical Phase-1 panel ─────────────────────
  'epaper-1in54-bw': {
    id: 'epaper-1in54-bw',
    name: '1.54" ePaper (200×200, B/W)',
    width: 200,
    height: 200,
    bodyW: 240,
    bodyH: 280,
    bezelPx: 14,
    fpcStripPx: 36,
    refreshMs: 50,
    controllerFamily: 'ssd168x',
    controllerIc: 'SSD1681',
  },

  // ── 2.13" 250×122 — most popular community badge size ───────────────
  'epaper-2in13-bw': {
    id: 'epaper-2in13-bw',
    name: '2.13" ePaper (250×122, B/W)',
    width: 250,
    height: 122,
    bodyW: 290,
    bodyH: 170,
    bezelPx: 14,
    fpcStripPx: 32,
    refreshMs: 50,
    controllerFamily: 'ssd168x',
    controllerIc: 'SSD1675A / IL3897',
  },

  // ── 2.9" 296×128 — slightly bigger badge size ───────────────────────
  'epaper-2in9-bw': {
    id: 'epaper-2in9-bw',
    name: '2.9" ePaper (296×128, B/W)',
    width: 296,
    height: 128,
    bodyW: 340,
    bodyH: 180,
    bezelPx: 16,
    fpcStripPx: 32,
    refreshMs: 50,
    controllerFamily: 'ssd168x',
    controllerIc: 'SSD1680',
  },

  // ── 4.2" 400×300 — mid-size, popular for dashboards ─────────────────
  'epaper-4in2-bw': {
    id: 'epaper-4in2-bw',
    name: '4.2" ePaper (400×300, B/W)',
    width: 400,
    height: 300,
    bodyW: 440,
    bodyH: 360,
    bezelPx: 16,
    fpcStripPx: 36,
    refreshMs: 80,
    controllerFamily: 'ssd168x',
    controllerIc: 'SSD1683 / UC8176',
  },

  // ── 7.5" 800×480 — biggest mono panel we ship in Phase 1 ────────────
  'epaper-7in5-bw': {
    id: 'epaper-7in5-bw',
    name: '7.5" ePaper (800×480, B/W)',
    width: 800,
    height: 480,
    bodyW: 860,
    bodyH: 540,
    bezelPx: 24,
    fpcStripPx: 36,
    refreshMs: 100,
    controllerFamily: 'ssd168x',
    controllerIc: 'UC8179 / GD7965',
  },
};

export const PANEL_IDS = Object.keys(PANEL_CONFIGS);

/** Default if the Web Component is mounted without a panel-kind attribute. */
export const DEFAULT_PANEL_KIND = 'epaper-1in54-bw';

export function getPanelConfig(panelKind: string | null | undefined): EPaperPanelConfig {
  return PANEL_CONFIGS[panelKind ?? DEFAULT_PANEL_KIND] ?? PANEL_CONFIGS[DEFAULT_PANEL_KIND];
}
