# Development of nas-picture-manager

## Structure

The Vue/TypeScript UI is in `src/`. A single Rust/Axum crate in `backend/` holds the image domain
and the HTTP service; it needs no native graphics library.

```text
src/
  App.vue                         # Opening, dragging, panels and protection of the edits
  components/layout/              # Toolbar, footer and container of the panels
  components/controls/            # Actions, options and zoom
  components/viewer/              # Details
  components/editor/              # Adjustments, crop, annotations and confirmation
  composables/                    # Viewer, editor, canvas, menus and shortcuts
  services/                       # HTTP transport, annotations and launcher context
  stores/                         # Shared state of the viewer and of the interface
  i18n/locales/                    # en and it catalogues
  styles/                         # Global styles, theme and SCSS partials
  types/types.ts                  # Frontend contracts
  tests/unit/                     # Specs mirroring the production modules
  tests/component/                # Specs mirroring the components
  tests/scripts/                  # Conventions
  tests/e2e/                      # Gherkin, steps and fixtures
backend/
  Cargo.toml, Cargo.lock
  src/main.rs, unix_socket.rs      # Start on the Unix socket and stop
  src/routes.rs                   # UI, health and security headers
  src/controllers/                # Queries, HTTP handlers, errors and concurrency
  src/images/viewer/              # Decoding, metadata and reading
  src/images/edit/                # Geometry, adjustments, preview and export
  tests/unit/images/              # Tests of the domain, included by the library
  tests/integration/              # API, UI and process on the socket
```

Local start, packaging, smoke test, versions, quality gate, merge, SFC formatter and
lockfiles are the `nas-base-app` command of the library `@valeriogc/nas-base-app`, which detects the
direct crate `backend/Cargo.toml`. The library also provides the iframe protections
(`guardFrame`) and the NAS palette (`_nas-theme.scss`, `_nas-apps.scss`); the theme of the viewer,
the reset and the launcher context (`services/nasShell.ts`, which validates and pins the origin)
stay the app's own. Sonar scanning and frontend/Rust coverage are direct commands in
`package.json`; the scanner reads `sonar.properties`.

## Conventions

Composition API with `<script setup lang="ts">`, imports through the `@/` and `@tests/` aliases,
scoped SFC styles, CSS names with `_` and UI texts in the catalogues `src/i18n/locales/en.ts` and
`it.ts`, with the same keys. No `any`: use a type or narrow `unknown`. Tokens for colours, spacing,
radii and durations in `src/styles/partials/_variables.scss`; `global.scss` emits no CSS. The
global styles are imported once from `main.ts`. A blank line separates the SCSS rules and
delimits script and style of the SFCs. Code, methods, test descriptions, README and guide are in
English. No em dash U+2014, no new dependency unless asked for.

The FE tests are in `src/tests/`, with the suffixes `.unit.spec.ts` and `.component.spec.ts`. The
production code excludes the tests. The E2E tests use `data-testid`, removed from the production
build. The Rust tests are in `backend/tests/`: the unit ones are included with `#[cfg(test)]` and
`#[path]`, those of the process and of HTTP are integration targets declared in Cargo.

The frontend always uses `httpImages.ts`, with no choice of platform. Viewer and editor share
their state in `viewerStore.ts`; menus and local interactions stay in the components. The preview
starts again from the original: EXIF orientation, rotation, flips, crop and RGB adjustments. The
debounce is 180 ms; the jobs are serialized and stale answers are ignored. Blob URLs are released
when the previews are replaced.

The annotations use Canvas with no further dependency. The coordinates are those of the original
image oriented by EXIF. The frontend transforms the notes and generates a transparent PNG layer in
the final size of the export; the backend validates it and composes it after the adjustments. The
display limits the Canvas to 2048 pixels per side. Gestures are undoable transactions, with the
pen samples grouped per frame and a history of 50 operations.

## Theme of the launcher

`services/initializeShell.ts` applies the URL parameters and registers the bridge
`services/nasShell.ts`. The frame sends `ready` to the parent on its own origin. Only `context`
messages from the parent with the same origin and protocol 1 update theme, language, accent and
palette. The seven surfaces `background`, `foreground`, `surface`, `sunken`, `hover`, `border`,
`muted` map onto the `--nas-*` tokens, as in the other applications. Every colour goes through
`CSS.supports`: a missing or invalid role removes the override and restores the local theme. The
download notification uses the same channel, without calling the HTTP API of the shell. Updates do
not remount the viewer.

## Opening NAS files

`nasShell.ts` sends `pick-files` with a request ID, multiple selection and the image extensions.
It accepts the answer only from the parent on the same origin, with URLs under
`/apps/<provider>/api/`. The launcher opens the installed `file-picker` provider; the browser does
not open its local picker in the NAS frame. The viewer keeps the references of the files and loads
their bytes at the first opening, reusing them for editing and export through the existing Axum
endpoints. Cancelling and errors of the picker keep the current image and edits.

## Image API

- `GET /health`: `{ status: "ok", version }`.
- `GET /api/status`: `{ online: true, version }`.
- `POST /api/images/inspect`: binary original image, at most 30 MiB.
- `POST /api/images/render`: binary original and adjustments in the query.
- `POST /api/images/export`: binary original, adjustments and `format` in the query; answers the
  bytes.
- `POST /api/images/export_annotated`: original length as little-endian `u32`, original and PNG of
  the annotations in the original coordinates.
- `POST /api/images/export_overlay`: same envelope with the PNG already in the final size.

The bodies are `application/octet-stream`. The two envelopes have a limit of 60 MiB + 4 bytes,
with 30 MiB per image. `rotation` is 0-3; `flipHorizontal` and `flipVertical` are booleans;
`brightness` and `contrast` are -100..100; `sharpness` is 0..100. The crop uses `cropX`, `cropY`,
`cropWidth` and `cropHeight`, all together, after rotation and flips. Unknown parameters and
rectangles beyond the edges are refused. `format` is png, jpeg, webp, gif, bmp, tiff or ico.

Inspect/render answer `{ info, preview }`. With `Accept: application/vnd.picture-manager.image`
they answer the JSON length as little-endian `u32`, UTF-8 metadata and raw PNG: it is the
pre-existing binary contract used by the frontend. Dates are Unix milliseconds or null; name and
last modification come from the `File`. The errors `{ error }` are typed: invalid
input/format/image/adjustments (400), limits exceeded (413), unavailable or job already running
(503).

Decoding and processing run in `spawn_blocking`, with one permit per application that stays in the
worker even if the client cancels the request. The frontend retries only `busy`, up to 60 seconds.
Bodies have a 30-second timeout; `cross-site` uploads are refused. The cache holds a single decoded
source up to 256 MiB, checking the bytes before reusing it; the export consumes its buffer. WebP
validates chunks and the metadata budget before the codec. No filesystem path comes from the image
endpoints and no error exposes details of the system. UI and API apply a CSP; image answers use
`no-store` and `nosniff`.

## Dependencies and lockfiles

Locally dependencies are installed with pnpm; the pipelines use `npm ci`. `pnpm install` realigns
`package-lock.json` through `postinstall`; after `pnpm add`, `update` or `remove` run
`pnpm run lock:npm`. `lint` checks the alignment and `release:merge` repeats it before the quality
gate. Do not edit the lockfiles by hand: the npm lock changes through `lock:npm`, `Cargo.lock`
through Cargo. `pnpm-lock.yaml` stays local.

## Shared library

The launcher bridge, styles, shared components and helpers, and the build, package and release scripts come from `@valeriogc/nas-base-app`, published on GitHub Packages; the commands of `package.json` use its `nas-base-app`. The `.npmrc` of the project points the `@valeriogc` scope to its registry; locally a classic token with `read:packages` is needed in your own `~/.npmrc` (`//npm.pkg.github.com/:_authToken=...`), while the pipelines use the token of the workflow. For a new version of the library, update the number in `package.json` and run `pnpm install`. The local `pnpm-workspace.yaml` has `'@valeriogc/nas-base-app': false` under `allowBuilds`.

## Checks

```bash
pnpm install
pnpm run format:check
pnpm run lint
pnpm run type-check
pnpm test
pnpm run test:e2e
pnpm run test:coverage
pnpm run coverage:rust
cargo fmt --manifest-path backend/Cargo.toml --all --check
cargo clippy --manifest-path backend/Cargo.toml --all-targets -- -D warnings
cargo test --locked --manifest-path backend/Cargo.toml
pnpm run nas:package
pnpm run nas:test
pnpm run release:check
```

`format` applies Prettier, ESLint and the SFC formatter; do not format the SFCs with Prettier by
hand. The E2E tests start Vite on port 1421 and the backend on its dedicated temporary socket,
using deterministic PNG fixtures. `npx playwright install chromium` prepares the browser. The
frontend coverage requires 80% of the lines per file; Rust produces the LCOV report for Sonar.
`RUSTC_WRAPPER=` turns off an unusable local wrapper, without changing the global configuration.
The full quality gate is `pnpm run release:test`.

`release:merge` changes versions, creates a commit, merges into main and pushes a tag: do not run
it in the checkout during development. Its tests simulate the commands and check that nothing is
published if the quality gate fails.
