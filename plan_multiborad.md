# Plan: Multi-Board Simulator UX — Full Design

## Context

The codebase already has a solid multi-board foundation: `boards[]` array in `useSimulatorStore`, per-board file groups in `useEditorStore`, separate simulator instances (`simulatorMap`, `pinManagerMap`), QEMU bridges for Raspberry Pi 3 and ESP32, and board-specific compilation via `BOARD_KIND_FQBN`. However, several UX layers are missing: the editor doesn't visually indicate which board you're editing, there's no way to compile/run all boards at once, the serial monitor only shows one board, and the Raspberry Pi 3 has no special terminal/VFS interface.

## What Already Exists (Do NOT Re-implement)

- `boards[]` + `addBoard()` / `removeBoard()` / `setActiveBoardId()` in `useSimulatorStore`
- `fileGroups` / `createFileGroup()` / `setActiveGroup()` in `useEditorStore`
- `simulatorMap`, `pinManagerMap`, `bridgeMap`, `esp32BridgeMap` runtime maps
- `compileBoardProgram()`, `startBoard()`, `stopBoard()`, `resetBoard()`
- `RaspberryPi3Bridge` with `sendSerialBytes()` / `onSerialData` callback
- `BOARD_KIND_FQBN`, `BOARD_KIND_LABELS` in `frontend/src/types/board.ts`
- `BoardPickerModal`, `BoardOnCanvas`, `SerialMonitor` components

---

## Phase 1 — Board-Aware Editor UI (Foundation)

### 1A. Canvas → Editor Sync
**File:** `frontend/src/components/simulator/BoardOnCanvas.tsx`

- Add `onBoardClick?: (boardId: string) => void` prop
- On click (not drag — detect by < 4px mouse movement), call `onBoardClick(board.id)`
- In `SimulatorCanvas.tsx`, pass `onBoardClick={(id) => useSimulatorStore.getState().setActiveBoardId(id)}`
  — `setActiveBoardId` already calls `useEditorStore.getState().setActiveGroup()`, so this is one line

### 1B. Board-Grouped FileExplorer
**File:** `frontend/src/components/editor/FileExplorer.tsx`

Replace flat `files.map()` with a grouped tree:
```
boards.map(board => (
  <BoardSection isActive={board.id === activeBoardId} onClick={() => setActiveBoardId(board.id)}>
    {fileGroups[board.activeFileGroupId].map(file => <FileItem />)}
    <NewFileButton /> // scoped to this group
  </BoardSection>
))
```
- Section header: board emoji icon + label + status dot (green=running, amber=compiled, gray=idle)
- `createFile`, `deleteFile`, `renameFile` operate on active group — clicking section header first sets the active board

### 1C. Board Context Pill in EditorToolbar
**File:** `frontend/src/components/editor/EditorToolbar.tsx`

Add a colored pill at the left of the toolbar:
- Shows: `{emoji} Arduino Uno #1`
- Color by family: Arduino=blue, Raspberry Pi=red, ESP32=green
- Clickable — opens a small dropdown to switch active board without going to the canvas

---

## Phase 2 — Compile All / Run All Orchestration

### 2A. New component: `CompileAllProgress`
**File:** `frontend/src/components/editor/CompileAllProgress.tsx` (new)

Sliding panel showing per-board compile status:
```typescript
interface BoardCompileStatus {
  boardId: string;
  boardKind: BoardKind;
  label: string;
  state: 'pending' | 'compiling' | 'success' | 'error' | 'skipped';
  error?: string;
}
```
- Each row: board icon + label + spinner/checkmark/X
- Error rows expand to show compiler stderr
- "Run All" button at bottom — enabled after all compilations finish; only starts boards that succeeded or skipped

### 2B. "Compile All" + "Run All" buttons in EditorToolbar
**File:** `frontend/src/components/editor/EditorToolbar.tsx`

`handleCompileAll` logic:
1. Iterate `boards[]` **sequentially** (not parallel — `arduino-cli` is CPU-heavy, shares temp dirs)
2. For `raspberry-pi-3`: mark `skipped`, continue
3. For each other board: read files via `useEditorStore.getState().getGroupFiles(board.activeFileGroupId)`
4. Call `compileCode(sketchFiles, fqbn)`, on success call `compileBoardProgram(boardId, program)`
5. **Always continue to next board on error** — never abort
6. If panel is closed mid-run, compilation continues in background

`handleRunAll`: iterate boards, call `startBoard(id)` for all that have `compiledProgram !== null` or are Pi/ESP32

---

## Phase 3 — Multi-Board Serial Monitor

**File:** `frontend/src/components/simulator/SerialMonitor.tsx`

Redesign with a tab strip (one tab per board):
- Each tab: board emoji + short label + unread dot (new output since tab last viewed)
- Output area/input row operates on `activeTab` board
- Add to `useSimulatorStore`:
  - `serialWriteToBoard(boardId, text)` — like `serialWrite` but with explicit boardId (6 lines)
  - `clearBoardSerialOutput(boardId)` — like `clearSerialOutput` with explicit boardId (4 lines)
- Default active tab follows `activeBoardId`

---

## Phase 4 — Raspberry Pi 3 Special Workspace

This is the most complex phase. When `activeBoard.boardKind === 'raspberry-pi-3'`, the left panel switches from Monaco editor to a specialized workspace.

### 4A. Install xterm.js
```bash
cd frontend
npm install @xterm/xterm @xterm/addon-fit
```
Use scoped packages (`@xterm/xterm` v5+), NOT deprecated `xterm` v4.

### 4B. New store: `useVfsStore`
**File:** `frontend/src/store/useVfsStore.ts` (new)

Keep separate from `useSimulatorStore` (which is already 970+ lines). VFS is a tree structure, fundamentally different from the flat file-group lists in `useEditorStore`.

```typescript
interface VfsNode {
  id: string;
  name: string;
  type: 'file' | 'directory';
  content?: string;
  children?: VfsNode[];
  parentId: string | null;
}

// State: trees: Record<boardId, VfsNode>  (root "/" per board)
// Actions: createNode, deleteNode, renameNode, setContent, setSelectedNode, initBoardVfs
```

Default tree for new Pi board:
```
/
  home/pi/
    script.py    (default Python template)
    hello.sh
```

Call `initBoardVfs(boardId)` inside `useSimulatorStore.addBoard()` when `boardKind === 'raspberry-pi-3'`.

### 4C. New: `PiTerminal.tsx`
**File:** `frontend/src/components/raspberry-pi/PiTerminal.tsx` (new)

- Mounts xterm.js Terminal into a `ref` div
- `term.onData(data => bridge.sendSerialBytes(...))` — input → QEMU
- Intercept `bridge.onSerialData` to write to terminal (save+restore prev callback to keep store's `serialOutput` in sync)
- `ResizeObserver` → `fitAddon.fit()` for responsive layout
- Lazy-loaded via `React.lazy()` in EditorPage to keep xterm.js out of the main bundle

### 4D. New: `VirtualFileSystem.tsx`
**File:** `frontend/src/components/raspberry-pi/VirtualFileSystem.tsx` (new)

- Recursive tree component, reads from `useVfsStore`
- Expand/collapse directories
- Click file → calls `onFileSelect(nodeId, content, filename)`
- Right-click context menu: New File, New Folder, Rename, Delete
- "Upload to Pi" button in header: serializes tree to `{path, content}[]` and calls `bridge.sendFile(path, content)` for each node (requires new `sendFile` method on `RaspberryPi3Bridge` and backend protocol message `{ type: 'vfs_write', data: { path, content } }`)

### 4E. New: `RaspberryPiWorkspace.tsx`
**File:** `frontend/src/components/raspberry-pi/RaspberryPiWorkspace.tsx` (new)

Two-pane layout:
- **Left**: `VirtualFileSystem`
- **Right**: Tab strip with "Terminal" tab + open file tabs
  - Terminal tab → `PiTerminal`
  - File tab → Monaco `CodeEditor` (content synced to `useVfsStore.setContent`)
- Pi-specific toolbar: Connect / Disconnect / Upload Files to Pi

### 4F. EditorPage — conditional render
**File:** `frontend/src/pages/EditorPage.tsx`

```typescript
const isRaspberryPi3 = activeBoard?.boardKind === 'raspberry-pi-3';

// In JSX:
{isRaspberryPi3 && activeBoardId
  ? <React.Suspense fallback={<div>Loading...</div>}>
      <RaspberryPiWorkspace boardId={activeBoardId} />
    </React.Suspense>
  : <CodeEditor />
}
```
Hide `FileTabs` when in Pi mode (VFS replaces them).

---

## Phase 5 — Board Status Indicators on Canvas

**File:** `frontend/src/components/simulator/BoardOnCanvas.tsx`

Add two overlays (absolutely positioned, `pointerEvents: none`):

1. **Active board highlight ring**: 2px `#007acc` border around board bounds when `board.id === activeBoardId`
2. **Status dot**: 12px circle at top-right corner
   - Green (`#22c55e`) = running
   - Amber (`#f59e0b`) = compiled, not running
   - Gray (`#6b7280`) = idle

Pass `activeBoardId` as a prop from `SimulatorCanvas`.

---

## Implementation Order

```
Phase 1A → 1B → 1C   (foundation — pure UI, no new deps)
     │
     ↓
Phase 5              (30 min, canvas badges — immediate visual feedback)
     │
     ↓
Phase 3              (serial monitor tabs — adds 2 store actions)
     │
     ↓
Phase 2              (compile all — uses existing store APIs)
     │
     ↓
Phase 4A → 4B → 4C → 4D → 4E → 4F   (Pi workspace — most complex, new npm dep)
```

---

## Critical Files to Modify

| File | Phase | Changes |
|------|-------|---------|
| `frontend/src/components/simulator/BoardOnCanvas.tsx` | 1A, 5 | `onBoardClick` prop, status badges, active ring |
| `frontend/src/components/simulator/SimulatorCanvas.tsx` | 1A | Pass `onBoardClick` handler |
| `frontend/src/components/editor/FileExplorer.tsx` | 1B | Board-grouped tree replacing flat list |
| `frontend/src/components/editor/EditorToolbar.tsx` | 1C, 2B | Board pill, Compile All, Run All |
| `frontend/src/store/useSimulatorStore.ts` | 3 | Add `serialWriteToBoard`, `clearBoardSerialOutput` |
| `frontend/src/components/simulator/SerialMonitor.tsx` | 3 | Board tabs |
| `frontend/src/pages/EditorPage.tsx` | 4F | Conditional Pi workspace vs CodeEditor |

## New Files to Create

| File | Phase |
|------|-------|
| `frontend/src/components/editor/CompileAllProgress.tsx` | 2A |
| `frontend/src/store/useVfsStore.ts` | 4B |
| `frontend/src/components/raspberry-pi/PiTerminal.tsx` | 4C |
| `frontend/src/components/raspberry-pi/VirtualFileSystem.tsx` | 4D |
| `frontend/src/components/raspberry-pi/RaspberryPiWorkspace.tsx` | 4E |

## Verification

1. **Phase 1**: Click an Arduino on the canvas → FileExplorer highlights that board's files, toolbar pill updates
2. **Phase 2**: Add 2 Arduino boards with different code → "Compile All" → progress panel shows both → "Run All" starts both
3. **Phase 3**: 2 boards running → Serial Monitor has 2 tabs, unread dot appears when output arrives on background tab
4. **Phase 4**: Add Raspberry Pi 3 → editor area switches to VFS/terminal; create a `script.py` in VFS, upload to Pi, run it from terminal
5. **Phase 5**: Canvas shows green dot on running boards, amber on compiled-not-running, gray on idle; blue ring on active board
