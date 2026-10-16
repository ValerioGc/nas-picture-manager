# NAS distribution

The reference contract is [APPS.md](APPS.md). The permanent identity of the app is
`nas-picture-manager`, declared in `nas-app.json`.

## Build and package

On Linux, with Node/pnpm (versions given in `package.json`), Rust and GNU tar:

```bash
pnpm install
pnpm run nas:package
pnpm run nas:test
```

The build compiles the frontend and the Axum backend: the NAS needs no Node to run the app. The
binary requires a Linux system compatible with the architecture and the libraries of the build
machine. The CI release uses Ubuntu 22.04 x64; for ARM64, run the build on Linux ARM64. The test on
the target NAS also checks that the binary actually starts on that system.

Output on x64:

```text
release-assets/nas-picture-manager-0.1.4-linux-x64.tar.gz
release-assets/nas-picture-manager-0.1.4-linux-x64.tar.gz.sha256

Content of the archive:
nas-app.json
bin/nas-picture-manager-axum
icon.svg
dist/index.html
dist/assets/...
```

`pnpm run nas:package` builds the UI into `dist/axum/` and the backend from `backend/Cargo.toml`,
and assembles the frontend bundle as `dist/` in the archive. `pnpm run nas:test` checks
installability, API and version on the Unix socket from a directory outside the checkout.

Packaging and package checks come from `nas-base-app` (`@valeriogc/nas-base-app`), as in the
other applications, with the Cargo manifest of the single crate. The versions of package.json, NAS manifest, Cargo and Sonar must
match. The pipeline produces only the Linux NAS package and its checksum.

## Execution and catalogue

The launcher extracts the package into `/var/lib/nas-os/apps/nas-picture-manager/`. The executable
listens on the Unix socket passed with `--listen <path>`, or through `NAS_APP_SOCKET` when the
argument is missing. `--listen` takes precedence. In this mode no TCP port is opened and `PORT` is
ignored. UI and assets stay at the root of the origin (`/`, `/assets/...`), with the API on the
existing paths.

The socket is required in development too: `pnpm run backend:dev` sets it up in a temporary
directory. Without `--listen` or `NAS_APP_SOCKET` the process refuses to start. `NAS_UI_DIR` can
replace the frontend directory (prefer an absolute path). Normally the assets are resolved relative
to the executable: the process also works from a different directory. SIGINT and SIGTERM close the
server, letting the requests in progress finish, and remove the socket the process created. At
start an inactive socket is removed; an active socket, a regular file or a link are preserved and
the start fails. A `--listen` argument without a path, or an empty path, is an error.

To start the app by hand from the directory of the launcher project, after extracting the package
into `backend/data/dev-apps/nas-picture-manager/`:

```bash
mkdir -p backend/data/dev-sockets
backend/data/dev-apps/nas-picture-manager/bin/nas-picture-manager-axum \
  --listen backend/data/dev-sockets/nas-picture-manager.sock
```

The directory holding the socket must already exist and be writable.

The initial catalogue of the launcher includes this entry for `ValerioGc/nas-picture-manager`:

```json
{
  "id": "nas-picture-manager",
  "name": "Picture Manager",
  "info": "Visualizza e modifica immagini.",
  "provider": "github",
  "repository": "ValerioGc/nas-picture-manager",
  "asset": "nas-picture-manager-{version}-linux-x64.tar.gz"
}
```

The catalogue belongs to the launcher: the app does not change it. Inside the launcher, **Open
file** and **Ctrl+O** ask for the `file-picker` provider of Explorer (`nas-file-manager`), with
multiple selection and a filter for the supported images. The picker browses and searches the NAS
volumes Explorer can reach; it returns logical paths and authenticated download URLs. Without the
provider installed the app shows an error and keeps the current image. In standalone mode the local
picker of the browser remains; dragging from the computer remains available. A link
`?path=%2F...` loads the image from the authenticated download endpoint of Explorer. Picture Manager
does not browse NAS folders directly, so `permissions.paths` and `provides` are empty.

To turn the picker on in an existing NAS, update the launcher, Explorer and Picture Manager
together. Explorer must be installed and hold the `/srv/storage` permission; the launcher starts
the provider. Updating the launcher keeps the existing catalogue: if it still holds
`picture-manager`, replace that entry with `nas-picture-manager` and the repository and asset given
above. The new identity requires the `nas-picture-manager` package; an installation with the old ID
is not renamed automatically.

The Unix transport lets the proxy of the launcher reach the app directly. Managing the process and
its start remains the launcher's job.

## Theme, language and shell notifications

The frontend includes the `postMessage` protocol of APPS.md. Inside a frame it sends
`{ nas: 1, type: 'ready' }` to the parent on its own origin, even without a referrer. The messages
`{ nas: 1, type: 'context', context: { theme, accent, locale, palette } }` update theme, accent,
palette and language even after opening; `accent: ''` restores the colour of the theme. Only valid
messages from the parent window, with the same origin as the application, are accepted. Every role
of the palette updates the matching `--nas-*` token; missing roles or invalid colours remove the
override.

Starting the download of an exported copy sends a `notify` notification to that exact origin. The
shell API is never called from the browser. In standalone mode the `theme` and `lang` URL
parameters remain available.

## Reusable installability test

The package test is `scripts/axium/test-nas-package.mjs` of `@valeriogc/nas-base-app`, run by
`nas-base-app test-package` (and by `pnpm run nas:test` through `nas-base-app smoke`). The file
is self-contained and imports nothing of nas-picture-manager. It requires only **Node.js 22.18+**, uses the
built-in modules and needs no `npm install`. The `.mjs` extension lets it run outside a Node
project as well. The start test requires Linux with `/proc` reachable and a binary compatible with
the machine. Running the test needs no root, launcher, Python, Cargo or tar command.

```bash
pnpm exec nas-base-app test-package \
  release-assets/nas-picture-manager-0.1.4-linux-x64.tar.gz \
  --expected-id nas-picture-manager \
  --expected-version v0.1.4 \
  --asset-template 'nas-picture-manager-{version}-linux-x64.tar.gz' \
  --api-path /health --version-field version
```

For another app:

```bash
node test-nas-package.mjs other-app-1.2.0-linux-arm64.tar.gz \
  --expected-id other-app --expected-version 1.2.0 \
  --api-path /api/status
```

The test checks:

- Checksum `<archive>.sha256`, name/version and safe paths before the extraction.
- Manifest at the root, ID, protocol, declared socket, permissions and capabilities.
- Presence of the icon and of the executable, with execute permission.
- Start of the extracted binary in a temporary directory, with a working directory outside the
  package and a temporary socket passed with `--listen` and `NAS_APP_SOCKET`.
- HTML answer, availability of the local assets referenced directly in the HTML and JSON answers of
  the given endpoints.
- Version of the API answers, when `--version-field` is given.
- Ownership of the Unix listener by the started process, and no listening TCP port belonging to
  that process.
- Stop through SIGTERM, cleanup of the test processes and of the temporary files.

The result is an exit code 0 (success) or 1 (error), suitable for CI. Without the path of the
archive, the script uses `nas-app.json` and the local platform to look for the package in
`release-assets/`; given an explicit archive it stays self-contained and can be copied into other
projects. `--api-path` can be repeated and defaults to `/health`: this endpoint is a convention of
the test, not a requirement of APPS.md. `--version-field` applies to every given endpoint. The
probe calls are GET and expect HTTP 200 without redirect. `--ui-path`, `--env KEY=VALUE`,
`--timeout` and `--checksum` adapt the test; see `--help`.

The test reads tar or tar.gz archives, with USTAR/PAX headers and GNU long names. It also checks
the header checksums, duplicate paths and link targets. It refuses special files, setuid/setgid
privileges, sparse files and tar numeric fields in binary format. The archive is read in memory:
the default limit is 512 MiB for both the compressed file and the expanded tar, adjustable with
`--max-unpacked-mib`.

`--archive-only` checks the package without running it, even from a system other than the target.
The full mode **runs the program contained in the archive**: use it with trusted packages. The
temporary directory is no security sandbox. The test runs no JavaScript in the browser, does not
check the installation through the launcher API and certifies no hardware other than the machine
it runs on.

The regression tests of the script, faulty packages included, live in the library.

## Quality gate and release

`pnpm run release:check` checks versions and changelog. `pnpm run release:test` runs formatting,
lint, type check, unit, component, script and E2E tests, the Rust checks, the build of the package
and the smoke test. `pnpm run release:merge -- --dry-run` computes the version without changes; the
normal mode updates metadata and changelog, realigns the npm lock, repeats the quality gate, creates
the release commit, merges into `main` and pushes branch and tag. The tag starts the NAS pipeline;
the CI of the pull requests runs the same quality gate. The tests of the procedure simulate the
commands, without changing a repository or publishing a release.
