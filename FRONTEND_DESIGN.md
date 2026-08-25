# File Gateway Frontend — Design Document

---

## 1. Design Philosophy

The frontend follows a **"functional minimalism"** approach:

- **Single-file SPA** — All UI logic lives in `page.tsx` (396 lines), avoiding premature abstraction
- **Convention over configuration** — Uses Next.js App Router defaults with minimal customization
- **Utility-first styling** — Tailwind CSS with extracted `@layer components` classes for reuse
- **Server-state separation** — React Query manages all API state; local state is minimal

---

## 2. Architecture Decisions

### 2.1 Why Next.js App Router (not Pages Router)?

| Decision | Rationale |
|----------|-----------|
| App Router (`app/` directory) | Modern Next.js 15 default; Server Components for layout, Client Components for interactivity |
| No `pages/` directory | Avoids legacy pattern; app/ enables colocation of layout, styles, and page |
| `layout.tsx` as Server Component | Metadata export and root HTML structure rendered server-side |
| `page.tsx` as Client Component | Entire page needs `useState`, `useEffect`, React Query hooks — must be client-rendered |

### 2.2 Why a Single Page Component?

The `FileGateway` component in `page.tsx` is intentionally **not** decomposed into smaller files:

- **No component directory exists** — `tailwind.config.ts` references `./components/**/*.{ts,tsx}` but the directory doesn't exist
- All state (`query`, `dark`, mutations) is tightly coupled to the single view
- Sub-components like `StatCard` are defined inline at the bottom of the same file
- This keeps the mental model simple: one page, one file, one flow

### 2.3 Why React Query (not Redux/Zustand/Context)?

| Concern | React Query Handling |
|---------|---------------------|
| API caching | Built-in query cache with stale-while-revalidate |
| Polling | `refetchInterval: 5000` on stats and files queries |
| Mutations | `useMutation` for delete, custom `fetch` for upload |
| Cache invalidation | `queryClient.invalidateQueries()` after upload/delete |
| Loading/error states | `isLoading`, `isError` flags per query |

No client-side state library is needed because:
- The only client state is `query` (search input) and `dark` (theme toggle) — both `useState`
- There's no complex client-only state to manage

### 2.4 Why FilePond (not native `<input>` or react-dropzone)?

| Choice | Reason |
|--------|--------|
| FilePond | Rich built-in UI: drag-and-drop zone, file preview, progress, retry/cancel buttons |
| `filepond-plugin-file-validate-size` | Client-side size validation before upload |
| Custom `server.process` | Full control over FormData construction and API communication |
| `react-filepond` | React bindings for FilePond's vanilla JS library |

---

## 3. Data Flow Design

```
┌─────────────────────────────────────────────────────────┐
│                    React Query Cache                     │
│                                                          │
│  ["stats"] ←──── GET /api/stats (5s poll)               │
│  ["files"] ←──── GET /api/files (5s poll)               │
│  ["search", q] ← GET /api/search?q=... (on demand)     │
│                                                          │
│  invalidateQueries(["files"], ["stats"])                 │
│       ↑                   ↑                              │
│   upload success     delete success                      │
└─────────────────────────────────────────────────────────┘
         │                        │
         ▼                        ▼
   ┌───────────┐          ┌───────────┐
   │ FilePond  │          │  Delete   │
   │  upload   │          │ mutation  │
   │  handler  │          │           │
   └───────────┘          └───────────┘
         │                        │
         ▼                        ▼
   POST /api/upload        DELETE /api/files/:id
         │                        │
         ▼                        ▼
   ┌─────────────────────────────────┐
   │  Next.js Rewrite Proxy          │
   │  /api/* → http://127.0.0.1:3000 │
   └─────────────────────────────────┘
```

### Search Flow

```
User types → setQuery(e.target.value)
  → query.length > 0 enables search query
    → GET /api/search?q=<encoded>
      → search.data.results displayed
        OR
  → query.length === 0 → shows files.data.files instead
```

---

## 4. Styling Design System

### 4.1 Layer Structure

```css
@tailwind base;      /* Browser reset, color-scheme */
@tailwind components; /* Custom reusable classes */
@tailwind utilities;  /* Tailwind utility classes */
```

### 4.2 Component Class Hierarchy

```
.btn (base)
├── .btn-primary    (blue-600 bg, white text)
├── .btn-danger     (red-500 bg, white text)
└── .btn-ghost      (transparent bg, gray text)

.badge (base)
├── .badge-green    (green-100 bg, green-800 text)
├── .badge-blue     (blue-100 bg, blue-800 text)
└── .badge-gray     (gray-100 bg, gray-600 text)

.card              (rounded-xl, border, shadow)
.stat-card         (card + p-5 + hover:shadow-md)
.file-row          (flex, border-b, hover:bg-gray-50)
.input             (w-full, border, focus:ring)
.skeleton          (animate-pulse, rounded, bg-gray-200)
```

### 4.3 Dark Mode Strategy

| Layer | Implementation |
|-------|---------------|
| CSS | `color-scheme: light dark` on `:root` |
| Tailwind | `dark:` variants on all component classes |
| JS | `useDarkMode` hook toggles `.dark` class on `<html>` |
| Persistence | `localStorage.getItem("fg-dark-mode")` |
| Default | `window.matchMedia("(prefers-color-scheme: dark)")` |
| SSR safety | `suppressHydrationWarning` on `<html>` element |

### 4.4 Color Semantics

| Color | Usage |
|-------|-------|
| Blue | Primary actions, file icons, search focus ring |
| Green | Dedup badges, stored size card |
| Red | Delete button, error banners |
| Amber | Dedup ratio stat card |
| Purple | Original size stat card |
| Gray | Text hierarchy, borders, skeletons, neutral badges |

### 4.5 Responsive Breakpoints

| Class | Breakpoint | Usage |
|-------|-----------|-------|
| Default | < 640px | Single column layout, 2-col stats grid |
| `sm:` | >= 640px | 4-col stats grid, wider padding |
| `lg:` | >= 1024px | Max-width container (`max-w-6xl`) |

---

## 5. Component Design

### 5.1 `FileGateway` (Main Component)

**State:**
```
query: string          — Search input value
dark: boolean          — Dark mode (via useDarkMode hook)
```

**Queries:**
```
stats: useQuery        — 5s polling, Stats type
files: useQuery        — 5s polling, { files: FileRecord[] }
search: useQuery       — on-demand, { results: FileRecord[] }, enabled when query > 0
```

**Mutations:**
```
deleteMutation: useMutation — DELETE /api/files/:id, invalidates ["files"] + ["stats"]
```

**Derived Values:**
```
visible = query.length > 0 ? search.data?.results ?? [] : files.data?.files ?? []
hasError = stats.isError || files.isError
isLoading = stats.isLoading || files.isLoading
```

**Render Sections:**
1. Header (title, subtitle, dark mode toggle)
2. Error banner (conditional)
3. FilePond upload zone
4. Stats grid (4 cards or skeletons)
5. Search input with clear button
6. File list card (loading / empty / file rows)
7. Footer

### 5.2 `StatCard` (Internal Sub-component)

```typescript
function StatCard({ title, value, icon }: {
  title: string;
  value: string;
  icon?: React.ReactNode;
})
```

Pure presentational component. No state, no hooks. Renders a `.stat-card` div with title, value, and optional icon.

### 5.3 `Providers` (Wrapper)

Creates `QueryClient` once via `useState(() => new QueryClient())`. Wraps children with `QueryClientProvider`. This pattern prevents recreating the client on every render.

### 5.4 `RootLayout` (Server Component)

Server-side only. Sets metadata, imports CSS, wraps in `Providers`. No client-side JS in this component.

---

## 6. API Proxy Design

```
Browser → http://localhost:3001/api/files
                │
                ▼
    Next.js Rewrite Middleware
    source: "/api/:path*"
    destination: "http://127.0.0.1:3000/api/:path*"
                │
                ▼
    Rust Axum Server (port 3000)
```

**Why this design:**
- Avoids CORS configuration on the backend
- Frontend code uses relative URLs (`/api/...`) — works in dev and production
- Single proxy rule handles all API endpoints

---

## 7. File Upload Design

```
User drops files into FilePond
        │
        ▼
FilePond calls server.process(field, file, metadata, load, error)
        │
        ▼
Custom handler:
  1. Create FormData
  2. formData.append("file", file)
  3. fetch("/api/upload", { method: "POST", body: formData })
  4. Check response.ok
  5. On success: load(file.name) → invalidates ["files"] + ["stats"]
  6. On error: error(e) → FilePond shows error state
```

**Design choices:**
- Single file per `FormData` (even though API supports multipart batch)
- Max 20 files enforced by FilePond's `maxFiles` prop
- No progress tracking (FilePond's default behavior)
- FilePond labels customized for UX clarity

---

## 8. Dark Mode Design

```
Initialization:
  localStorage("fg-dark-mode") exists?
    → use stored value
    → else: prefers-color-scheme: dark?
      → true: dark = true
      → false: dark = false

Toggle:
  setDark(d => !d)

Effect:
  dark ? add "dark" class : remove "dark" class
  localStorage.setItem("fg-dark-mode", String(dark))
```

**Design choices:**
- Class-based strategy (not media query) for manual control
- `suppressHydrationWarning` prevents React hydration mismatch warnings
- System preference detection only on first load

---

## 9. Loading State Design

| Section | Loading State | Implementation |
|---------|--------------|----------------|
| Stats grid | 4 skeleton cards | `[...Array(4)].map()` with `.skeleton` divs |
| File list | 3 skeleton rows | `[...Array(3)].map()` with `.skeleton` divs |
| Delete button | Disabled during mutation | `disabled={deleteMutation.isPending}` |

Skeletons use Tailwind's `animate-pulse` with `bg-gray-200 dark:bg-gray-700`.

---

## 10. Error Handling Design

| Error Type | Detection | UI |
|-----------|-----------|-----|
| Backend unreachable | `stats.isError \|\| files.isError` | Red banner with icon + message |
| Upload failure | FilePond `error()` callback | FilePond error state |
| Delete failure | Mutation throws | Button remains enabled, no UI feedback |
| Search failure | `search.isError` | Not explicitly handled (shows empty results) |

**Known gap:** Delete and search errors are not surfaced to the user.

---

## 11. Accessibility Considerations

| Feature | Implementation |
|---------|---------------|
| HTML lang | `lang="en"` on root |
| Color contrast | Dark mode uses `dark:text-gray-100` on `dark:bg-gray-950` |
| Focus indicators | `focus:ring-2 focus:ring-offset-2` on buttons and inputs |
| Disabled states | `disabled:cursor-not-allowed disabled:opacity-50` |
| Semantic HTML | `<main>`, `<header>`, `<section>`, `<footer>`, `<h1>`, `<h2>` |
| Title attributes | `title="Download file"`, `title="Delete file"` on icon buttons |
| Screen reader | SVG icons are decorative (no `aria-label`, but `title` on parent buttons) |

**Known gaps:** No `aria-label` on icon-only buttons, no keyboard navigation customization for FilePond.

---

## 12. Key Design Decisions Summary

| Decision | Chosen | Alternative | Reason |
|----------|--------|-------------|--------|
| State management | React Query only | Redux / Zustand | Only API state exists; no complex client state |
| Styling | Tailwind + @layer components | CSS Modules / styled-components | Utility-first, minimal CSS bundle, dark mode support |
| Component structure | Single page file | Component directory | Appropriate for current complexity level |
| File upload | FilePond | react-dropzone / native input | Rich UI out of the box with progress, retry, validation |
| API proxy | Next.js rewrites | CORS on backend | Zero backend configuration needed |
| Dark mode | Class toggle + localStorage | CSS media query only | User preference persistence + system fallback |
| Data polling | 5s interval | WebSocket / SSE | Simpler implementation, sufficient for this use case |
| TypeScript | Strict mode | Loose | Better type safety, catches errors at compile time |

---

*Design Document — File Gateway Frontend v2.0*
