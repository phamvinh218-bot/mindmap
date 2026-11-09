# Web Mindmap cá nhân — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A private, password-locked mindmap web app with per-map share links (own password, view/edit), deployed free on Vercel + Supabase.

**Architecture:** Next.js App Router app. All data access goes through server route handlers that use a Supabase service-role client behind a small repository interface, so route logic is unit-testable against an in-memory repo. The editor is a React Flow canvas driven by a Zustand store holding a pure `MapData` document. Pure tree functions handle every structural change. Saves are whole-document with optimistic version checks.

**Tech Stack:** Next.js 15 (App Router, TypeScript), React 19, `@xyflow/react` 12, Zustand 5, Tailwind CSS 4, zod, bcryptjs, jose, `@supabase/supabase-js` 2, Vitest + Testing Library, Playwright. Use the latest stable version of each at install time and pin exact versions in `package.json`.

**Spec:** `docs/superpowers/specs/2026-11-09-mindmap-design.md`

## Global Constraints

- All user-facing text is Vietnamese.
- Hosting: Vercel Hobby. Database: Supabase Free. Code goes on GitHub, and Vercel auto-deploys from `main`. Total cost: 0.
- The browser never talks to Supabase. Only route handlers use `SUPABASE_SERVICE_ROLE_KEY`. RLS is on for every table, with no policies.
- Env vars: `OWNER_PASSWORD_HASH`, `SESSION_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`.
- bcrypt cost 10. Session JWT HS256. Owner session 30 days, share session 7 days. Cookies are httpOnly, Secure (in production), SameSite=Lax.
- Rate limit: 5 failures within 15 minutes per `IP + target` → blocked for 15 minutes.
- Share token: 32 random bytes, base64url. Share URL: `/s/<token>`.
- Autosave debounce 1500 ms. Undo history: 100 steps. Max `data` size: 2 MB.
- Shapes: `rect`, `rounded` (default), `pill`, `ellipse`, `underline`. Palette of 10 colors plus a free color picker.
- Viewport and collapsed state live in localStorage per viewer per map. They are never in `data` and never mark the map dirty.
- Map `title` is a separate column, renamed only by the owner, and not version-checked. Root node text is independent of the title.

## Review Focus

1. **Vietnamese IME (Telex/VNI) typing:** pressing Enter while composing (`event.isComposing` / keyCode 229) must not finish the edit or create a sibling. → test in Task 7.
2. **Network failure during save:** status shows "Lỗi lưu", local edits stay in memory, retry every 5 s, and `beforeunload` warns while dirty. → test in Task 8.
3. **Session expired mid-edit (401 on save):** don't discard edits. Show "Phiên đã hết hạn" with a "Tải JSON" button, plus a login link (owner) or password re-entry (partner). → test in Task 8.
4. **Destructive tree edits:** the root can't be deleted. Deleting a node also removes connections touching any deleted node. Empty text after editing shows a placeholder ("Ý mới") and the node stays selectable. → tests in Task 4.
5. **Map deleted while other maps link to it:** the link icon shows "mindmap không còn tồn tại" and the owner can remove it. Saving still works. → test in Task 7.

---

## File Structure

```
src/
  lib/
    types.ts              MapData, MindNode, Connection, Shape, Permission, palette
    schema.ts             zod schemas + validateMapData (tree validity, size)
    tree.ts               pure tree operations
    layout.ts             placeNewChild, tidyLayout
    auth/password.ts      hashPassword, verifyPassword
    auth/session.ts       sign/verify owner + share JWTs, cookie names
    auth/rateLimit.ts     checkAndRecord logic over AttemptsRepo
    auth/guards.ts        requireOwner(req), requireShare(req, token)
    db/repo.ts            repository interfaces
    db/supabaseRepo.ts    Supabase implementation
    db/memoryRepo.ts      in-memory implementation (tests, local dev without DB)
    db/index.ts           getRepo() — memory if no SUPABASE_URL, else Supabase
    viewerState.ts        localStorage viewport/collapsed (try/catch)
  editor/
    store.ts              Zustand store + undo/redo
    useAutosave.ts        autosave, conflict, visibility, retry
    Canvas.tsx            React Flow wiring
    MindNodeView.tsx      custom node (shapes, edit, collapse btn, link icon)
    BranchEdge.tsx        parent→child curve
    ConnectionEdge.tsx    bezier arrow with draggable control point
    NodePanel.tsx         color / shape / map link / "áp cho nhánh con"
    TopBar.tsx            title, save status, Sắp xếp gọn, Share
    ConflictBanner.tsx
    keyboard.ts           key → command mapping (pure, testable)
    ShareDialog.tsx
  app/
    login/page.tsx
    page.tsx              dashboard
    m/[id]/page.tsx       owner editor
    s/[token]/page.tsx    share password gate + partner editor
    api/auth/login/route.ts, api/auth/logout/route.ts
    api/maps/route.ts                  GET list, POST create
    api/maps/import/route.ts           POST
    api/maps/[id]/route.ts             GET, PATCH title, DELETE
    api/maps/[id]/data/route.ts        PUT save
    api/maps/[id]/version/route.ts     GET
    api/maps/[id]/duplicate/route.ts   POST
    api/maps/[id]/export/route.ts      GET
    api/maps/[id]/shares/route.ts      GET, POST
    api/shares/[shareId]/route.ts      PATCH, DELETE
    api/s/[token]/meta/route.ts        GET {title}
    api/s/[token]/login/route.ts       POST
    api/s/[token]/map/route.ts         GET, PUT
    api/s/[token]/version/route.ts     GET
    api/cron/daily/route.ts            keepalive + purge attempts
  middleware.ts
scripts/hash-password.mjs
supabase/migrations/0001_init.sql
vercel.json
tests/…                   mirrors src/
e2e/mindmap.spec.ts
```

## Shared Types (Task 1 produces; every task consumes)

```ts
// src/lib/types.ts
export type Shape = 'rect' | 'rounded' | 'pill' | 'ellipse' | 'underline';
export type Side = 'left' | 'right';
export type Permission = 'view' | 'edit';
export interface MindNode {
  id: string; parentId: string | null; text: string;
  color: string; shape: Shape; x: number; y: number;
  side?: Side;              // set on children of root; descendants inherit
  linkMapId?: string | null;
}
export interface Connection {
  id: string; from: string; to: string; color: string;
  control?: { x: number; y: number } | null;
}
export interface MapData { nodes: MindNode[]; edges: Connection[] }
export const PALETTE: readonly string[]; // 10 hex colors, readable in light+dark
export const DEFAULT_CONNECTION_COLOR = '#8a8f98';
```

---

### Task 1: Project scaffold, schema, repositories

**Files:**
- Create: the Next.js app (`create-next-app` with TS, Tailwind, App Router, `src/`), `vitest.config.ts`, `src/lib/types.ts`, `src/lib/schema.ts`, `src/lib/db/{repo,memoryRepo,supabaseRepo,index}.ts`, `supabase/migrations/0001_init.sql`, `.env.example`, `README.md` (setup + env vars, in Vietnamese)
- Test: `tests/lib/schema.test.ts`, `tests/lib/db/memoryRepo.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // schema.ts
  export const mapDataSchema: z.ZodType<MapData>;
  export function validateMapData(input: unknown):
    { ok: true; data: MapData } | { ok: false; error: 'invalid' | 'too_large' };
  // repo.ts
  export interface MapRow { id: string; title: string; data: MapData; version: number; created_at: string; updated_at: string }
  export interface ShareRow { id: string; map_id: string; token: string; label: string | null; permission: Permission; password_hash: string; enabled: boolean; session_version: number; created_at: string; last_used_at: string | null }
  export interface Repo {
    listMaps(): Promise<Pick<MapRow,'id'|'title'|'updated_at'>[]>;
    getMap(id: string): Promise<MapRow | null>;
    createMap(title: string, data: MapData): Promise<MapRow>;
    renameMap(id: string, title: string): Promise<boolean>;
    deleteMap(id: string): Promise<boolean>;            // cascades shares
    saveMapData(id: string, data: MapData, expectedVersion: number):
      Promise<{ ok: true; version: number } | { ok: false; reason: 'conflict'; version: number } | { ok: false; reason: 'not_found' }>;
    listShares(mapId: string): Promise<ShareRow[]>;
    getShareByToken(token: string): Promise<ShareRow | null>;
    getShare(id: string): Promise<ShareRow | null>;
    createShare(row: Omit<ShareRow,'id'|'created_at'|'last_used_at'|'session_version'|'enabled'>): Promise<ShareRow>;
    updateShare(id: string, patch: Partial<Pick<ShareRow,'label'|'permission'|'password_hash'|'enabled'|'session_version'|'last_used_at'>>): Promise<ShareRow | null>;
    deleteShare(id: string): Promise<boolean>;
    countRecentFailures(key: string, sinceIso: string): Promise<number>;
    recordFailure(key: string): Promise<void>;
    purgeAttemptsBefore(iso: string): Promise<void>;
    ping(): Promise<void>;
  }
  export function getRepo(): Repo;   // db/index.ts; singleton
  export function createMemoryRepo(): Repo;
  export function newMapData(rootText: string): MapData; // one root at (0,0), shape 'rounded', PALETTE[0]
  ```

- [ ] **Step 1: Scaffold** with `npx create-next-app@latest . --ts --tailwind --app --src-dir --eslint --import-alias "@/*" --use-npm`, then add deps (`@xyflow/react zustand zod bcryptjs jose @supabase/supabase-js nanoid`) and dev deps (`vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/user-event @playwright/test`). Add scripts `test`, `test:e2e`, and `hash-password`. Commit.
- [ ] **Step 2: Write failing tests** in `schema.test.ts`:
  - `newMapData('Dự án A')` passes `validateMapData`.
  - Two roots → `invalid`. A `parentId` pointing to a missing node → `invalid`. A parent cycle (a→b→a) → `invalid`. A connection to a missing node → `invalid`. An unknown shape → `invalid`.
  - A payload over 2 MB JSON (`JSON.stringify(...).length > 2*1024*1024`) → `too_large`.
- [ ] **Step 3: Write failing tests** in `memoryRepo.test.ts`:
  - `saveMapData` with the right version returns `{ok:true, version: v+1}`. With a stale version it returns `{ok:false, reason:'conflict', version: current}`.
  - `deleteMap` removes its shares.
  - `countRecentFailures` only counts entries at or after `since`.
- [ ] **Step 4: Run** `npx vitest run tests/lib` → FAIL.
- [ ] **Step 5: Implement** `types.ts`, `schema.ts`, `repo.ts`, `memoryRepo.ts`, and `newMapData`.
- [ ] **Step 6: Run** `npx vitest run tests/lib` → PASS.
- [ ] **Step 7: Write** `0001_init.sql` with tables `maps`, `shares`, `login_attempts` exactly as in spec §7:
  - `maps.version int not null default 1`
  - `shares.session_version int not null default 1`, `enabled bool not null default true`, `permission check in ('view','edit')`, `map_id references maps on delete cascade`, unique `token`
  - `login_attempts(key text not null, attempted_at timestamptz not null default now())` + index `(key, attempted_at)`
  - `alter table … enable row level security` on all three tables
  - a SQL function `save_map_data(p_id uuid, p_data jsonb, p_expected int)` that runs `UPDATE maps SET data=p_data, version=version+1, updated_at=now() WHERE id=p_id AND version=p_expected RETURNING version`. When no row is updated it returns the current version (or null if the map doesn't exist).
- [ ] **Step 8: Implement** `supabaseRepo.ts`, calling `save_map_data` via `rpc`. Implement `getRepo()`: if `SUPABASE_URL` is unset, return a process-wide memory repo for local dev. Commit.

### Task 2: Auth primitives

**Files:**
- Create: `src/lib/auth/{password,session,rateLimit}.ts`, `scripts/hash-password.mjs`
- Test: `tests/lib/auth/*.test.ts`

**Interfaces:**
- Consumes: `Repo` (Task 1)
- Produces:
  ```ts
  export function hashPassword(pw: string): Promise<string>;
  export function verifyPassword(pw: string, hash: string): Promise<boolean>;
  export const OWNER_COOKIE = 'mm_owner';
  export function shareCookieName(token: string): string; // 'mm_sh_' + first 16 hex chars of sha256(token)
  export function signOwnerSession(): Promise<string>;      // {kind:'owner'}, exp 30d
  export function verifyOwnerSession(jwt: string | undefined): Promise<boolean>;
  export function signShareSession(shareId: string, sessionVersion: number): Promise<string>; // exp 7d
  export function verifyShareSession(jwt: string | undefined): Promise<{ shareId: string; sv: number } | null>;
  export const RATE = { max: 5, windowMs: 15 * 60_000 };
  export function isBlocked(repo: Repo, key: string, now?: Date): Promise<boolean>;
  export function recordFailure(repo: Repo, key: string): Promise<void>;
  export function generateShareToken(): string; // 32 bytes base64url
  ```

- [ ] **Step 1: Write failing tests:**
  - `verifyPassword('abc', await hashPassword('abc'))` is true, and `'abd'` is false.
  - A signed owner session verifies. A tampered one, or one signed with a different `SESSION_SECRET`, does not. A share session round-trips `{shareId, sv}`.
  - After 4 recorded failures `isBlocked` is false. After 5 it is true. With `now` = 15 min + 1 ms after the first failure it is false again, because the oldest failure has aged out.
  - `generateShareToken()` is 43 characters, matches `/^[A-Za-z0-9_-]+$/`, and two calls differ.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** Session secret comes from `process.env.SESSION_SECRET` as `TextEncoder` bytes. Throw if it is missing or shorter than 32 characters.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5:** Write `scripts/hash-password.mjs`: read the password from a hidden stdin prompt and print the bcrypt hash. Commit.

### Task 3: Owner login, guards, middleware

**Files:**
- Create: `src/lib/auth/guards.ts`, `src/middleware.ts`, `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`, `src/app/login/page.tsx`
- Test: `tests/api/auth.test.ts`

**Interfaces:**
- Consumes: Task 2
- Produces:
  ```ts
  export function clientIp(req: Request): string; // x-forwarded-for first entry, else 'unknown'
  export function requireOwner(req: NextRequest): Promise<NextResponse | null>; // null = ok, else 401 JSON {error:'unauthorized'}
  export function requireShare(req: NextRequest, token: string):
    Promise<{ share: ShareRow } | { response: NextResponse }>; // 401 if no/invalid cookie, share disabled/missing, or sv mismatch; permission read from DB
  ```
  `POST /api/auth/login {password}` → 200 + cookie | 401 `{error:'wrong_password'}` | 429 `{error:'locked'}`. Rate-limit key: `owner:<ip>`.

- [ ] **Step 1: Write failing route tests.** Call the handlers directly with `new NextRequest(...)` and the memory repo:
  - Wrong password → 401. After 5 wrong attempts the 6th, even with the correct password, → 429.
  - Correct password → 200 and a `Set-Cookie` with `mm_owner`, `HttpOnly`, and `Max-Age=2592000`.
  - Logout clears the cookie.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.**
  - Middleware: redirect to `/login` when there is no valid owner cookie, for `/` and `/m/:path*`. Return 401 JSON for `/api/maps/:path*` and `/api/shares/:path*`.
  - Let through `/login`, `/s/*`, `/api/s/*`, `/api/auth/*`, `/api/cron/*`, and static files.
  - Route handlers also call `requireOwner` (defense in depth).
  - Login page: one password field, "Đăng nhập" button. Errors: "Sai mật khẩu" and "Nhập sai quá nhiều lần, thử lại sau 15 phút".
- [ ] **Step 4: Run** → PASS. Commit.

### Task 4: Tree operations and layout (pure)

**Files:**
- Create: `src/lib/tree.ts`, `src/lib/layout.ts`
- Test: `tests/lib/tree.test.ts`, `tests/lib/layout.test.ts`

**Interfaces:**
- Produces (every function returns a new `MapData`; inputs are never mutated):
  ```ts
  export const NEW_NODE_TEXT = 'Ý mới';
  export function getRoot(d: MapData): MindNode;
  export function childrenOf(d: MapData, id: string): MindNode[]; // ordered by y
  export function descendantIds(d: MapData, id: string): Set<string>;
  export function addChild(d: MapData, parentId: string): { data: MapData; id: string };
  export function addSibling(d: MapData, nodeId: string): { data: MapData; id: string }; // on root → addChild
  export function deleteNodes(d: MapData, ids: string[]): MapData; // subtree + touching connections; root ignored
  export function reparent(d: MapData, nodeId: string, newParentId: string): MapData; // no-op if newParent ∈ descendants ∪ {nodeId} or node is root
  export function moveSubtree(d: MapData, nodeId: string, dx: number, dy: number): MapData;
  export function updateNodes(d: MapData, ids: string[], patch: Partial<Pick<MindNode,'text'|'color'|'shape'|'linkMapId'>>, opts?: { includeDescendants?: boolean }): MapData;
  export function addConnection(d: MapData, from: string, to: string): { data: MapData; id: string } | null; // null if from===to or duplicate
  export function updateConnection(d: MapData, id: string, patch: Partial<Pick<Connection,'color'|'control'>>): MapData;
  export function deleteConnections(d: MapData, ids: string[]): MapData;
  export function displayText(n: MindNode): string; // text.trim() || NEW_NODE_TEXT
  // layout.ts
  export const H_GAP = 220, V_GAP = 56;
  export function placeNewChild(d: MapData, parentId: string): { x: number; y: number; side: Side };
  export function tidyLayout(d: MapData): MapData;
  ```
  New nodes take their parent's color (`PALETTE[i % 10]` for children of root, round-robin) and shape `rounded`. `placeNewChild`: children of root go on the side with fewer children (right on a tie). x = parent.x ± H_GAP. y = the lowest sibling's y + V_GAP, or parent.y if there are no siblings. `side` is inherited from the parent for non-root parents.

- [ ] **Step 1: Write failing tests:**
  - `deleteNodes` of the root leaves the data unchanged. Deleting a middle node removes its whole subtree and every connection whose `from`/`to` was in it.
  - `reparent(a, descendantOfA)` is a no-op. A valid reparent changes `parentId`, and the moved node's subtree takes the new parent's `side`.
  - `moveSubtree` shifts every descendant by (dx, dy).
  - `updateNodes(..., {color:'#f00'}, {includeDescendants:true})` colors the whole subtree. Without the option, only the selected nodes.
  - `addConnection(a, a)` is null. A duplicate pair is null.
  - `displayText({text:'  '})` is `'Ý mới'`.
  - Layout: first root child goes right, second left, third right. A second child of a node sits V_GAP below the first.
  - `tidyLayout` on a 3-level, 12-node map: no two nodes share the same rounded (x, y); every left-side node has x < root.x and every right-side node has x > root.x; parents are vertically centered on their children's span within ±1.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** For `tidyLayout`, lay out each side as a tree where subtree height = max(48, sum of child subtree heights + gaps), depth × H_GAP for x, parent centered on its children.
- [ ] **Step 4: Run** → PASS. Commit.

### Task 5: Maps API

**Files:**
- Create: the `src/app/api/maps/**` routes listed in File Structure
- Test: `tests/api/maps.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4
- Produces:
  - `GET /api/maps` → `[{id,title,updated_at}]`, newest first
  - `POST /api/maps {title}` → `{id}` (data = `newMapData(title)`)
  - `GET /api/maps/:id` → `{id,title,data,version}`
  - `PATCH /api/maps/:id {title}` → 204
  - `DELETE /api/maps/:id` → 204
  - `PUT /api/maps/:id/data {data, version}` → 200 `{version}` | 409 `{error:'conflict', version}` | 413 `{error:'too_large'}` | 400 `{error:'invalid'}`
  - `GET /api/maps/:id/version` → `{version}`
  - `POST /api/maps/:id/duplicate` → `{id}` (title "`<title>` (bản sao)")
  - `GET /api/maps/:id/export` → JSON attachment `{title, data}`, filename = `slug(title).json`
  - `POST /api/maps/import {title, data}` → `{id}` (validated)

- [ ] **Step 1: Write failing tests:**
  - Every route without the owner cookie → 401.
  - Save with a stale version → 409 carrying the current version. Invalid data → 400. 2 MB+ → 413.
  - Duplicate title ends with " (bản sao)".
  - Import → export round-trips the data deep-equal.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS. Commit.

### Task 6: Editor store with undo and viewer state

**Files:**
- Create: `src/editor/store.ts`, `src/lib/viewerState.ts`
- Test: `tests/editor/store.test.ts`, `tests/lib/viewerState.test.ts`

**Interfaces:**
- Consumes: Task 4
- Produces:
  ```ts
  export interface EditorState {
    data: MapData; version: number; readOnly: boolean;
    dirty: boolean; selectedNodeIds: string[]; selectedEdgeIds: string[];
    editingNodeId: string | null; collapsed: Set<string>;
    load(data: MapData, version: number, readOnly: boolean): void; // resets history, dirty=false
    apply(fn: (d: MapData) => MapData): void; // pushes history (cap 100), dirty=true; no-op when readOnly
    undo(): void; redo(): void;
    markSaved(version: number, savedData: MapData): void; // dirty=false only if data === savedData
    select(nodeIds: string[], edgeIds?: string[]): void;
    toggleCollapsed(id: string): void; // persists via viewerState, does NOT touch dirty
  }
  export function createEditorStore(mapKey: string): UseBoundStore<StoreApi<EditorState>>;
  // viewerState.ts — all access wrapped in try/catch, falls back silently
  export function loadViewerState(mapKey: string): { viewport?: {x:number;y:number;zoom:number}; collapsed: string[] };
  export function saveViewerState(mapKey: string, s: { viewport?: {...}; collapsed: string[] }): void;
  ```
  `mapKey` is `owner:<id>` or `share:<token>`.

- [ ] **Step 1: Write failing tests:**
  - 101 applies, then 100 undos, gets back to the state after apply #1 (the cap holds). Redo after undo restores. A new apply after undo clears the redo stack.
  - `toggleCollapsed` leaves `dirty` false and writes localStorage.
  - `apply` when `readOnly` changes nothing.
  - `markSaved` with stale `savedData` (an edit landed during the save) keeps `dirty` true.
  - `loadViewerState` returns `{collapsed: []}` when `localStorage.getItem` throws.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS. Commit.

### Task 7: Editor canvas UI

**Files:**
- Create: `src/editor/{Canvas,MindNodeView,BranchEdge,ConnectionEdge,NodePanel,TopBar,keyboard}.ts(x)`, `src/app/m/[id]/page.tsx`
- Test: `tests/editor/keyboard.test.ts`, `tests/editor/MindNodeView.test.tsx`, `tests/editor/NodePanel.test.tsx`

**Interfaces:**
- Consumes: Tasks 4, 5, 6
- Produces:
  ```ts
  export type Command = 'addChild'|'addSibling'|'delete'|'edit'|'undo'|'redo'|'save'|null;
  export function keyToCommand(e: { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; isComposing?: boolean; keyCode?: number }, ctx: { editing: boolean }): Command;
  export function Editor(props: { mapKey: string; initial: {title:string; data:MapData; version:number}; mode: 'owner' | 'edit' | 'view'; api: EditorApi; mapTitles?: Record<string,string> }): JSX.Element;
  export interface EditorApi { save(data: MapData, version: number): Promise<SaveResult>; getVersion(): Promise<number>; load(): Promise<{data:MapData; version:number}> }
  export type SaveResult = { ok: true; version: number } | { ok: false; status: 409; version: number } | { ok: false; status: 401 | 413 | 400 | 0 }; // 0 = network
  ```
  Behavior (spec §6):
  - Branch edges are derived from `parentId`, drawn as smooth curves in the child's color.
  - Connection edges are bezier curves with an arrowhead and a draggable control point (`control`).
  - Dragging a node moves its subtree. Dropping onto another node reparents it (use React Flow intersection on drag stop).
  - Collapsed nodes hide their descendants.
  - The "Nối" button or a drag from a handle creates a connection.
  - Box select, and Shift+click for multi-select.
  - Fit-view button. Viewport saved to `viewerState` on move end (debounced 500 ms).
  - The link icon opens `/m/<linkMapId>` for the owner. In share modes it shows a toast "Bạn chưa được chia sẻ mindmap này". If the target id is missing from `mapTitles` (owner mode), show "mindmap không còn tồn tại" with a "Gỡ link" action.
  - `NodePanel` color swatches = `PALETTE` + `<input type="color">` + checkbox "áp cho nhánh con". Shape buttons for the 5 shapes. A map-link select (owner only). With a connection selected, the panel shows only the color swatches and a "Xóa đường nối" button.
  - Text editing uses a textarea: Enter finishes (unless composing), Shift+Enter inserts a newline, Escape cancels.
  - `TopBar`: inline title edit (owner only; PATCH title), save status, "Sắp xếp gọn" (via `apply(tidyLayout)`, so it is undoable), "Chia sẻ" (owner only).

- [ ] **Step 1: Write failing tests:**
  - `keyToCommand`:
    - Tab → addChild. Enter → addSibling (not editing). Delete/Backspace → delete (not editing). F2 → edit. Ctrl+Z → undo. Ctrl+Shift+Z → redo. Ctrl+S → save.
    - **Enter with `isComposing:true` or `keyCode:229` → null.**
    - Enter while editing → null, because the input handles it.
  - `MindNodeView` renders `Ý mới` for empty text. Each shape value maps to its distinct CSS class. In `view` mode a double-click doesn't open the editor.
  - Owner editor with a node whose `linkMapId` isn't in `mapTitles` → text "mindmap không còn tồn tại". "Gỡ link" sets `linkMapId` null.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** the components. The owner page loads the map server-side via the repo, plus `mapTitles` from `listMaps`. **Step 4: Run** → PASS.
- [ ] **Step 5: Manual check** with `npm run dev` (memory repo):
  - Create a node tree with Tab/Enter.
  - Type Vietnamese with Telex in a node.
  - Color with and without subtree, change shapes, connect two nodes across branches, bend the curve.
  - Drag to reparent, run Sắp xếp gọn, undo it.
  - Reload: viewport and collapse are kept.
  - Commit.

### Task 8: Autosave and conflict handling

**Files:**
- Create: `src/editor/useAutosave.ts`, `src/editor/ConflictBanner.tsx`. Modify: `TopBar.tsx`, `Editor` (wire it in).
- Test: `tests/editor/useAutosave.test.tsx` (fake timers, mocked `EditorApi`)

**Interfaces:**
- Consumes: Tasks 6, 7
- Produces:
  ```ts
  export type SaveStatus = 'saved'|'saving'|'dirty'|'error'|'conflict'|'expired';
  export function useAutosave(store, api: EditorApi, opts: { debounceMs?: number /*1500*/; retryMs?: number /*5000*/ }): { status: SaveStatus; saveNow(): void; reloadLatest(): Promise<void> };
  ```
  Status labels: saving → "Đang lưu…", saved → "Đã lưu", error → "Lỗi lưu – đang thử lại", conflict → banner "Có người vừa lưu phiên bản mới hơn", expired → "Phiên đã hết hạn".
  Banner buttons:
  - "Tải bản mới" (everyone)
  - "Lưu bản của tôi thành bản sao" (owner: `POST /api/maps/import` with title `<title> (bản sao)`, then navigate to it)
  - "Tải JSON" (everyone; downloads the current local data)

- [ ] **Step 1: Write failing tests:**
  - An edit, then 1499 ms → no save. At 1500 ms → one save with the current version.
  - A 409 → status `conflict` and no further saves on later edits.
  - **A network failure (status 0) → `error`, edits are kept, a retry after 5000 ms succeeds → `saved`.**
  - **A 401 → `expired`, data not discarded, no retries.**
  - A `beforeunload` handler is registered while dirty and absent when saved.
  - `visibilitychange` to visible: a newer version while not dirty → `load` called and the store reloaded. A newer version while dirty → `conflict`.
  - Ctrl+S (`saveNow`) saves immediately.
  - In `view` mode, nothing is ever saved.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS. Commit.

### Task 9: Dashboard

**Files:**
- Create: `src/app/page.tsx` + `src/app/_dashboard/*` components
- Test: `tests/app/dashboard.test.tsx`

- [ ] **Step 1: Write failing tests:**
  - Renders cards sorted by `updated_at` desc with relative time in Vietnamese ("2 giờ trước", via `Intl.RelativeTimeFormat('vi')`).
  - The search box filters case- and diacritic-insensitively (`"du an"` matches `"Dự án"`, via NFD + strip marks).
  - Delete asks for confirmation ("Xóa mindmap này? Không thể hoàn tác.") before calling the API.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.**
  - Grid of cards. "Mindmap mới" prompts for a name, then opens the editor.
  - Card menu: Đổi tên, Nhân bản, Chia sẻ (opens the editor with the share dialog, via `?share=1`), Xuất JSON, Xóa.
  - "Nhập JSON" button. "Đăng xuất" in the header.
  - Light and dark via `prefers-color-scheme`.
- [ ] **Step 4: Run** → PASS. Commit.

### Task 10: Sharing

**Files:**
- Create: `src/app/api/maps/[id]/shares/route.ts`, `src/app/api/shares/[shareId]/route.ts`, `src/app/api/s/[token]/{meta,login,map,version}/route.ts`, `src/editor/ShareDialog.tsx`, `src/app/s/[token]/page.tsx`
- Test: `tests/api/shares.test.ts`, `tests/editor/ShareDialog.test.tsx`

**Interfaces:**
- Consumes: Tasks 1–3, 5, 7, 8
- Produces:
  - `GET /api/maps/:id/shares` → `[{id,label,permission,enabled,url,created_at,last_used_at}]`. Never returns `password_hash`.
  - `POST /api/maps/:id/shares {label?, permission, password}` → the row. Password must be ≥ 4 characters, else 400 `{error:'password_short'}`.
  - `PATCH /api/shares/:shareId {label?, permission?, password?, enabled?}`. A password change or `enabled:false` increments `session_version`.
  - `DELETE /api/shares/:shareId`.
  - `GET /api/s/:token/meta` → `{title}`, or 404 if missing/disabled.
  - `POST /api/s/:token/login {password}` → cookie `shareCookieName(token)` (Max-Age 604800) | 401 | 429. Rate key `share:<token>:<ip>`. Sets `last_used_at`.
  - `GET /api/s/:token/map` → `{title, data, version, permission}`.
  - `PUT /api/s/:token/map {data, version}` → like the owner save; 403 `{error:'read_only'}` when permission is `view`.
  - `GET /api/s/:token/version`.

- [ ] **Step 1: Write failing tests:**
  - List never includes `password_hash` or the hash string.
  - A share for map A can't read map B. The routes take no map id; the map comes from the share row.
  - A `view` share PUT → 403. An `edit` share PUT with the correct version → 200.
  - After an owner password change or disable, the old share cookie → 401.
  - Changing permission edit→view applies to an existing session immediately (403 on the next PUT).
  - 5 wrong passwords → 429.
  - A deleted share token → meta 404.
  - `ShareDialog`: creating a link shows the full URL with a "Sao chép" button. Toggling Tắt/Bật calls PATCH.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.**
  - The `/s/[token]` page checks the share session server-side. Without it, show the password form with the map title ("Nhập mật khẩu để mở «<title>»"). With it, render `Editor` in `edit` or `view` mode with share `EditorApi` and `mapKey='share:<token>'`.
  - Hide the share button, title edit, map-link picker and the "save as copy" button.
  - Show a small badge "Chỉ xem" or "Được sửa".
- [ ] **Step 4: Run** → PASS. Commit.

### Task 11: Daily cron, E2E, deploy

**Files:**
- Create: `src/app/api/cron/daily/route.ts`, `vercel.json`, `e2e/mindmap.spec.ts`, `playwright.config.ts`
- Test: `tests/api/cron.test.ts`, `e2e/mindmap.spec.ts`

**Interfaces:**
- `GET /api/cron/daily` requires header `Authorization: Bearer ${CRON_SECRET}` (else 401). It calls `repo.ping()` and `purgeAttemptsBefore(now − 1 day)`, then returns 200 `{ok:true}`.
- `vercel.json`: `{"crons":[{"path":"/api/cron/daily","schedule":"0 3 * * *"}]}`

- [ ] **Step 1: Write the cron test** (401 without the secret, 200 with it, old attempts purged). Run → FAIL. Implement. Run → PASS.
- [ ] **Step 2: Write the E2E test** against `npm run build && npm start` with the memory repo and test env values written to `.env.test` (generated hash for a test password):
  - Log in, create "Dự án thử", add 3 nodes, color one, connect two, wait for "Đã lưu".
  - Create an edit share with a password and open its URL in a second browser context. Wrong password shows an error; the right one opens the editor.
  - The partner edits and saves. The owner edits a stale copy → the conflict banner appears.
  - A view share is read-only (double-click doesn't open the editor).
- [ ] **Step 3: Run** `npx playwright test` → PASS. Run the full `npx vitest run` → PASS. Commit.
- [ ] **Step 4: Deploy.** Every external action here needs the owner's go-ahead in chat first.
  1. GitHub: `gh` is not installed. Ask the owner to create an empty private repo (e.g. `mindmap`) under `phamvinh218-bot` and give the URL. Then `git remote add origin <url>` and `git push -u origin main`.
  2. Supabase: create a free project via the Supabase MCP (confirm the $0 cost first), apply `0001_init.sql`, and read the project URL. The service-role key is copied by the owner from the Supabase dashboard into Vercel. Never print it in chat.
  3. Vercel: create a project linked to the GitHub repo. Set the env vars:
     - `SESSION_SECRET` and `CRON_SECRET`: random 48-byte base64url, generated locally.
     - `OWNER_PASSWORD_HASH`: the owner runs `npm run hash-password` and pastes the result in themself.
  4. Verify on the production URL: login, create map, save, share, partner open. Then `GET /api/cron/daily` with the secret → 200.
