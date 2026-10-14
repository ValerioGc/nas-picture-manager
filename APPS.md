# Writing an application for this NAS

Written for whoever builds an application that the launcher installs and shows. It is the contract:
what an application has to be, how it is packaged and released, and which APIs of the launcher it
may call.

**An application is a separate process, in a separate repository.** It is not a plugin, it is not
compiled into the launcher, and the launcher never imports its code. Updating it does not mean
releasing the launcher.

**You install it through the launcher.** You publish a release, an entry in the catalogue points at
it, and the application manager fetches, checks, unpacks and registers it.

---

## What an application is

|                      |                                                                                                                                                                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Identity**         | An `id` of ASCII letters, digits, `-` and `_`, at most 64 characters. It is the key everywhere: the catalogue, the register, the directory, the unit and the port the gateway gives you. **Choose it once and never change it.** |
| **Shape**            | One process that serves its own HTTP interface and its own API over a unix socket.                                                                                                                                               |
| **Where it lives**   | `/var/lib/nas-os/apps/<id>/`, unpacked from your release.                                                                                                                                                                        |
| **Where it answers** | `/run/nas-os/apps/<id>.sock`, and nowhere else.                                                                                                                                                                                  |
| **How it is opened** | The gateway gives you a port of your own on the address of the NAS, the launcher proxies it onto that socket, and the shell shows it in a frame.                                                                                 |
| **Who runs it**      | The launcher, through one systemd template: `nas-app@<id>.service`. See [Running it](#running-it).                                                                                                                               |
| **Who it talks to**  | The launcher, over HTTP. Nothing else on the NAS.                                                                                                                                                                                |

### The manifest

`app.system` is an optional boolean, defaulting to `false`. It classifies an application as a
system app independently of `app.category`. External system apps retain their own process,
package updates and management. The catalogue can also mark an entry with `system`.
Its `preinstall` flag selects initial installation and creates a desktop shortcut during setup,
independently of the preference for later interactive installs.

Put a `nas-app.json` at the root of your package. The launcher reads it at every start, and a
package without a readable one is a package it will not open.

```json
{
  "manifest_version": 1,
  "app": {
    "id": "fileExplorer",
    "name": "Esplora file",
    "version": "1.2.0",
    "icon": "icon.svg"
  },
  "run": {
    "exec": "bin/file-explorer",
    "socket": "/run/nas-os/apps/fileExplorer.sock"
  },
  "ui": { "protocol": 1 },
  "provides": [{ "capability": "search", "version": 1, "endpoint": "/api/search" }],
  "permissions": { "paths": ["/srv/storage"] }
}
```

`app.id` has to be the name of the directory the package unpacks into, which is the `id` of the
catalogue entry. The launcher checks it: a package that claimed another application's id would be
handed that application's socket and that application's place in the shell.

**`run.socket` is documentation, not configuration.** The launcher derives the path from the
identifier (`/run/nas-os/apps/<id>.sock`) and connects to that and nothing else. Declare
the same path or leave the field out; anything else is written to the log and ignored.

`app.icon` is a file inside your package (a symlink that leads out of it is refused) and the
launcher serves it at `/api/apps/<id>/icon`: it is the icon the menu and the desktop draw. `svg`,
`png`, `jpg`, `webp` or `ico`, under 512 KiB.
Without one the shell falls back to its own default logo.

`provides` declares the services you offer the shell, each with the path that answers it. The shell
calls that path directly, at `/apps/<id><endpoint>`, so it sits outside `/internal/`: a path under
it, one with `..` or one that is not absolute is ignored. `permissions.paths` declares the
directories of the NAS you need; it is not an automatic grant. The installation gives the trusted
`system-explorer` instance a dedicated systemd drop-in for `/srv/storage`. Other apps need an
administrator-created grant before accessing host paths.

The one capability the shell uses today is `search`, the file search of the global search:

- a `GET` with `q` (the text), and `type` and `ext` when the file filters are set
- an answer of `200` with a JSON array of results within 10 seconds, or the shell names you among
  those that did not answer
- each result carries `id`, `name`, `path`, `type` (`folder`, `document`, `image`, `audio`, `video`,
  `archive`), `extension`, `size` in bytes, `modified` (ISO 8601) and `target`, the query string
  your page opens on when the result is chosen (`?path=%2Fdocs`); a `target` that does not start
  with `?` opens the page as it is

Everything under `/internal/` is for the launcher only: the proxy answers 403 to a browser asking
for it. Put your interface on one side of that line and the services you offer the launcher on the
other.

---

### Installed, by hand

**A directory with a manifest is an installed application.** The launcher reads
`/var/lib/nas-os/apps/*/nas-app.json` at every request, so unpacking your package there is
all it takes to see it in the menu: no installation, no catalogue, no release. It is how you try a
build before publishing one:

```bash
mkdir -p /var/lib/nas-os/apps/fileExplorer
tar --extract --file file-explorer-1.2.0-linux-x64.tar.gz \
  --directory /var/lib/nas-os/apps/fileExplorer
```

The directory name has to be your `id`, which is what the manifest has to declare too. At the next launcher start the manifest is also recorded in SQLite. The version comes from the
manifest; the launcher does not infer which release asset produced the files.

---

## Being opened

The launcher is a reverse proxy in front of you. A browser asking for
`http://<address of the NAS>/apps/<id>/…` reaches the gateway, which checks that the user signed
in and hands the request to the launcher, which takes the prefix off, connects to
`/run/nas-os/apps/<id>.sock` and hands your answer back. The shell then shows that address in a
frame. Nothing on the network has to know about it: it works wherever the launcher does, one
forwarded port included.

Your application shares the origin of the console: the frame is not a boundary, and the
JavaScript inside could reach the parent document and the session. That is why only applications
the administrator trusts are installed, and why your page keeps to its own paths.

What that asks of you:

- **Serve at your own root, and link relatively.** Your server sees `/` and `/assets/...`: the
  prefix is taken off before the request reaches you, and handed over in `X-Forwarded-Prefix`. The
  browser, though, is at `/apps/<id>/`, so every address your page writes has to be relative:
  `base: './'` in Vite, `fetch('api/items')` rather than `fetch('/api/items')`. An absolute one
  reaches the launcher, not you. A redirect of yours to `/login` is put back under the prefix.
- **Listen on the socket, on nothing else.** It is handed to you as `--listen`; the directory is
  there already and the permissions are the template's business, not yours.
- **Keep the path short.** A unix socket path is a fixed field of 108 bytes in the kernel: worth
  knowing when you point `NAS_APP_SOCKETS` at a development directory.
- **Do not refuse to be framed.** `X-Frame-Options: DENY` or `frame-ancestors 'none'` means a blank
  window in the shell. If you set the header, allow the launcher's origin.
- **Keep your state out of cookies, and name what you store.** You share the origin with the
  console and every other application, so their cookies, `localStorage` and `IndexedDB` are the
  same as yours: prefix your keys with your `id`. The cookie of the console's session is taken out
  before a request reaches you, and a cookie of yours with its name is dropped.
- **A WebSocket goes through.** Open it on a relative address (`new WebSocket(new URL('live',
location.href.replace(/^http/, 'ws')))`): the gateway and the launcher carry the upgrade to your
  socket, with the same session check as any other request. Any other upgrade is a 501.
- **Take who is asking from `X-NAS-User`.** The launcher writes that header on every request it
  forwards and drops whatever arrived under that name, so it is the only word on the subject worth
  reading. Its value is the name of the user signed in to the NAS; a request that reaches the
  launcher without the gateway in front, as in development, says `local`.

If your application is installed but not listening, the launcher answers 503 and names you.

### Running it

The launcher starts and stops you. There is one systemd template on the NAS, `nas-app@.service`,
and your application runs as an instance of it: `nas-app@fileExplorer.service`, started when the
package is installed, restarted when it is updated, stopped when it is removed, and started again
whenever somebody presses the button in the application manager. You do not write a unit and you do
not enable anything.

What the template does with your package:

```
ExecStart   run-app.sh <id>, which reads run.exec out of your manifest and executes it
            with --listen /run/nas-os/apps/<id>.sock
Working dir /var/lib/nas-os/apps/<id>
User        one systemd makes up for this instance: it owns nothing on the machine
Writable    /run/nas-os/apps for the socket, and $STATE_DIRECTORY for you
Restart     on-failure, after two seconds
```

So three things are asked of your program:

- **Accept `--listen <path>`** and bind that unix socket. The same path also arrives as
  `NAS_APP_SOCKET`, and your identifier as `NAS_APP_ID`.
- **Keep `run.exec` inside the package.** It is relative to your directory; an absolute path or one
  that climbs out of it is refused and the unit does not start.
- **Write only into `$STATE_DIRECTORY`**, which is `/var/lib/nas-app/<id>`, created for you with
  mode `0700`. Everything else on the machine is read-only for the process, `/tmp` included: it is
  private and thrown away when you stop.
- **Use HTTP or HTTPS for outbound connections.** The base firewall permits TCP 80 and 443 for
  application units, plus DNS and NTP. Other outbound ports need a future per-app permission.

`systemctl status nas-app@<id>` and `journalctl -u nas-app@<id>` are where your logs are: write to
stdout and stderr, not to a file of your own.

---

## Talking to the shell

Your page shares the origin of the console, but it does not call the launcher's API: an absolute
`/api/...` would reach the launcher, a relative `api/...` reaches your own server. What it has
instead is one message channel with the shell, `postMessage`, with the origin checked on both
sides.

Every message carries `nas: 1`. Anything else arriving in your window is not the launcher.

```js
let shell = null;

window.addEventListener('message', (event) => {
  const message = event.data;
  if (!message || message.nas !== 1) return;

  if (message.type === 'context') {
    shell = event.origin; // where to answer, from now on
    document.documentElement.dataset.theme = message.context.theme; // 'light' or 'dark'
    applyAccent(message.context.accent); // a CSS colour, or '' for the theme's own
    setLanguage(message.context.locale); // 'it' or 'en'
  }
});

// Say you are there. It carries nothing about you, which is why it may go before the shell is
// known; everything after this goes back to the origin the context came from.
window.parent.postMessage({ nas: 1, type: 'ready' }, '*');
```

The shell sends `context` when your frame loads, whenever you say `ready`, and again whenever the
theme, the accent or the language changes. Two things you may send back:

| Message                                                         |                                                                                                                                               |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `{ nas: 1, type: 'notify', title, message?, tone?, log? }`      | Leaves a notification. It is signed with your identifier by the shell, from the frame it arrived in, never with a field you send.             |
| `{ nas: 1, type: 'open', app: '<id>', location?: '?path=...' }` | Opens another installed application in the shell, optionally at a query string within that app. An identifier nobody installed opens nothing. |
| `{ nas: 1, type: 'describe', notifications: [...] }`            | Asks for notifications you read from `/api/notifications` in the language of the page. Answered with `described`, see below.                  |

The texts of the launcher's own notifications are translated by the shell: the API gives their
English text, a `key` and its `params`. Send what you read in `describe`, and the shell answers
`{ nas: 1, type: 'described', notifications: [{ id, title, message, source }] }`, with the title and
the text in the language of the page and the source named as the user knows it.

The shell may open you on a page of your own: the log manager, for instance, is opened at
`/apps/log-manager/?notification=12` from a notification. Read your query string when you start.
To open an Explorer result in another app, send `location` beginning with `?` and URL encode the
file path in it. The shell rejects locations longer than 2048 characters or with another prefix.

An application can ask the launcher to select NAS files with
`{ nas: 1, type: 'pick-files', requestId, multiple?, extensions?, directory? }`.
`extensions` is an optional array of up to 32 dot-prefixed extensions, such as
`['.png', '.jpg']`; `directory` is an optional initial logical path starting with `/`.
The shell opens the installed `file-picker` provider with `nasPicker`, `multiple=1`,
comma-separated `extensions` and `directory` query parameters. The provider browses only
its authorized volumes and returns `{ nas: 1, type: 'files-picked', token, files:
[{ name, path, download }], cancelled? }`, where `download` is relative `api/...`.
The shell checks the requested extensions and answers the requesting frame with
`{ nas: 1, type: 'pick-files-result', requestId, files: [{ name, path, url }], cancelled,
error? }`. The resolved URLs are on the NAS under the provider's API. A multiple selection
accepts at most 100 files. Cancellation returns no files; a missing provider returns an error.

An app runs inside an iframe, so the console's CSS does not style its page. Each app packages its
own copy of the shared surface rules from `src/apps/styles/_external-apps.scss` and applies
`app_surface` to its root. Picture Manager loads that stylesheet only for its Axum build.

Always answer to `event.origin`, never to `'*'`: that is the one address you know belongs to the
launcher.

---

## Packaging

A package is **a tar archive** with your application inside it. Nothing else: no installer, no
script that runs as root, no `.deb`.

```
file-explorer-1.2.0-linux-x64.tar.gz
├── nas-app.json
├── bin/file-explorer
├── icon.svg
└── …whatever else your application needs
```

Paths inside the archive are relative. Absolute paths and `..` are refused: the launcher unpacks
with `tar`, which does not allow a package to escape its own directory.

### Building and releasing

```bash
# 1. Build the two halves into one tree
npm run build                       # your interface, into dist/
cargo build --release               # your binary

# 2. Lay out exactly what the NAS will have
mkdir -p package/bin
cp target/release/file-explorer package/bin/
cp -r dist package/
cp nas-app.json icon.svg package/

# 3. One archive, named with the version, plus its checksum
VERSION=1.2.0
ASSET=file-explorer-$VERSION-linux-x64.tar.gz
tar --create --gzip --file "$ASSET" --directory package .
sha256sum "$ASSET" > "$ASSET.sha256"

# 4. Publish both as assets of a release tagged v$VERSION
gh release create "v$VERSION" "$ASSET" "$ASSET.sha256"
```

Three rules the launcher relies on:

- **The tag is the version.** `v1.2.0` and `1.2.0` are the same thing; versions are compared
  number by number, so `1.10.0` is newer than `1.9.0`.
- **The asset name carries the version.** The catalogue names it as a template,
  `file-explorer-{version}-linux-x64.tar.gz`, and `{version}` is the tag without its `v`.
- **Publish the checksum beside it**, as `<asset>.sha256`, in the `sha256sum` format. Without one
  the package still installs, but the launcher records a warning saying it could not be checked.
  With one, a package that does not match is thrown away and nothing is written.

> A checksum proves the file arrived intact. It does **not** prove who made it: whoever can publish
> the release can publish the checksum. The account that owns the repository is the trust boundary,
> so protect it.

### Where the launcher gets it

An entry in `/etc/nas-os/catalogue.json` on the NAS: which is a file, editable by hand or
by the administrator, not something compiled into anything:

```json
{
  "version": 1,
  "apps": [
    {
      "id": "fileExplorer",
      "name": "Esplora file",
      "info": "Sfoglia i file del NAS.",
      "provider": "github",
      "repository": "ValerioGc/nas-file-explorer",
      "asset": "file-explorer-{version}-linux-x64.tar.gz"
    }
  ]
}
```

`provider` is `github` or `gitlab`, and `preinstall` marks the applications the NAS installs by
itself right after the setup wizard. There is one release token, set in the setup wizard, in the
App Manager or with `sudo system/packages/ui_configuration/install.sh`; systemd stores it encrypted
and passes it to the launcher, which sends it on every request to the forge, for the launcher and
for every application alike, and nowhere else.

---

## The APIs you may call

Base `http://127.0.0.1:3000/api` on the machine, `/api` from a browser. JSON in, JSON out. Every
mutation needs `Content-Type: application/json`, **even with an empty body**: send `{}`.

A failure is always a status plus `{ "error": "…" }`, and the message is meant to be shown. Every
endpoint of the launcher, with its fields and its errors, is in [docs/API.md](https://github.com/ValerioGc/nas-launcher/blob/main/docs/API.md).

### Notifications: tell the user something happened

`POST /api/notifications`, from your process. From your page, where the API is out of reach, the
same thing is the `notify` message of [the frame protocol](#talking-to-the-shell).

```bash
curl -s http://127.0.0.1:3000/api/notifications \
  -H 'Content-Type: application/json' \
  -d '{
        "title": "Copia completata",
        "message": "30 GB copiati in /srv/backup.",
        "source": "fileExplorer",
        "tone": "success"
      }'
```

| Field     |                                                                                              |
| --------- | -------------------------------------------------------------------------------------------- |
| `title`   | Up to 160 characters, not empty.                                                             |
| `message` | Up to 2000 characters.                                                                       |
| `source`  | **Your `id`.** ASCII letters, digits, `-` and `_`, up to 64. It is what the user filters on. |
| `tone`    | `info`, `success`, `warning` or `error`. It decides the colour and the icon.                 |
| `log`     | Optional. The absolute path of a file that tells more, which the log manager will open.      |

The answer carries `id`, `at` (Unix milliseconds) and `read: false`. The log keeps the 500 most
recent and survives a restart.

Notifications are **text**: the launcher renders them as text and never as markup. Do not send
HTML, it will be shown as it is.

Use one for something the user should know about after the fact. For something that is _happening_,
use an operation instead.

### Operations: show what you are doing

The launcher keeps a register of work in progress, and a widget in the header shows it. **The
launcher does not run your work**: you register it, report where you are, and close it.

```bash
# 1. Register, when the work starts
curl -s http://127.0.0.1:3000/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{
        "id": "fileExplorer-copy-4821",
        "source": "fileExplorer",
        "name": "Copia in corso",
        "detail": "0 di 30 GB",
        "progress": 0,
        "pausable": true,
        "cancellable": true
      }'

# 2. Report, as often as you like
curl -s -X PATCH http://127.0.0.1:3000/api/tasks/fileExplorer-copy-4821 \
  -H 'Content-Type: application/json' \
  -d '{ "progress": 42, "detail": "12 di 30 GB" }'

# 3. Close it, whichever way it went
curl -s -X PATCH http://127.0.0.1:3000/api/tasks/fileExplorer-copy-4821 \
  -H 'Content-Type: application/json' \
  -d '{ "state": "done", "progress": 100, "detail": "30 di 30 GB" }'
```

| Field                     |                                                                                                                                                                                         |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                      | Yours to choose, unique on the NAS. Prefix it with your own id. Registering the same one again **replaces** it, so work that restarts finds its own row instead of leaving a stale one. |
| `source`                  | Your `id`.                                                                                                                                                                              |
| `name`                    | What the user sees. Up to 160 characters.                                                                                                                                               |
| `detail`                  | One line underneath, up to 500. Where you are, in words.                                                                                                                                |
| `progress`                | 0–100, **or absent**. Leave it out when you cannot tell: the widget draws a bar with no position rather than a convincing zero. Send an explicit `null` to go back to not knowing.      |
| `pausable`, `cancellable` | What you agree to be asked for. Default `false`.                                                                                                                                        |

States are `running`, `paused`, `done`, `failed` and `cancelled`. **A closed operation cannot be
reopened**: register a new one instead of moving a row the user has already read. Closing with
`failed` also leaves a notification, because that is the outcome nobody should miss.

#### How pause and stop reach you

The launcher cannot pause your work. When the user presses pause or stop, it **writes the state**
and expects you to honour it:

```bash
# Read your own operation, on whatever rhythm your work allows
curl -s http://127.0.0.1:3000/api/tasks | jq '.[] | select(.id == "fileExplorer-copy-4821")'
```

- `paused` → stop working, keep your place, and keep the row as it is.
- `running` after a pause → carry on.
- `cancelled` → stop and clean up, then either `DELETE` the row or leave it as the record.

This is why `pausable` and `cancellable` default to `false`: a button the owner would ignore is
worse than a button that is not there, so the launcher only draws the ones you asked for.

`DELETE /api/tasks/{id}` removes one. `POST /api/tasks/finished` clears the finished ones: that is
the user's button, not yours.

### Reading the machine

These are read-only and need nothing from you.

|                                   |                                                                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/apps`                   | What is installed, including your own version once you are.                                                                    |
| `GET /api/system/telemetry`       | Processor, memory, temperature and the heaviest processes.                                                                     |
| `GET /api/network`                | How the NAS is connected.                                                                                                      |
| `GET /api/notifications`          | The log, with filters.                                                                                                         |
| `GET /api/notifications/{id}/log` | The log behind a notification: the file it names, under `/var/log`, or the journal of the unit that wrote it around that time. |
| `GET /api/tasks`                  | The register, including your own operations.                                                                                   |

### What you must not do

- **Do not write the settings, the desktop shortcuts or the access rules.** They belong to the
  user and to the launcher. Your own configuration is yours to store.
- **Do not build a shell command out of anything a user typed.** The launcher never does, and
  neither should you: fixed program, separate arguments.
- **Do not listen anywhere but your socket.** A port on the machine is a door around the launcher,
  and nothing guards it.
- **Do not treat the launcher as an authentication service.** It does not authenticate anybody.
  `X-NAS-User` is its word about who is asking: trust it because only the launcher can reach your
  socket, and never forward what a client sent you under that name.

---

## Trying it without a NAS

The launcher runs on a development machine, and so does the whole package path:

```bash
npm run backend:dev                      # the API on 127.0.0.1:3000
npm run dev                              # the interface on 5173
```

By default the launcher **reaches no repository at all**: package operations need
`NAS_PACKAGES_MODE=real`, exactly like power, network and firewall changes need theirs. To exercise
an installation without touching the internet, point it at a forge of your own: that is what the
end-to-end suite does, in `src/tests/e2e/fixtures/forge.mjs`:

```bash
node src/tests/e2e/fixtures/forge.mjs 3002      # a forge that answers like GitHub

NAS_PACKAGES_MODE=real \
NAS_GITHUB_API=http://127.0.0.1:3002 \
NAS_CATALOGUE_PATH=./my-catalogue.json \
NAS_APPS_DIR=./apps \
cargo run --manifest-path backend/axum/Cargo.toml
```

Then install from the application manager, and watch the operation in the header. That is the same
path a real release takes, with the repository replaced.

On a development machine the launcher **starts nothing**: `NAS_APPS_MODE=real` is what makes it
ask systemd, and without it the application manager says so instead of drawing a button that
cannot work. So you start your own application by hand, on the socket the launcher derives:

```bash
NAS_PACKAGES_MODE=real \
NAS_APPS_DIR=./apps \
NAS_APP_SOCKETS=./sockets \
cargo run --manifest-path backend/axum/Cargo.toml

# your application, on the socket named after its id
./my-app --listen ./sockets/myApp.sock
```

In a browser, `npm run dev` forwards `/apps` to the backend like `/api`: open the shell and then
your application from the menu. From the shell the launcher alone is enough:

```bash
curl http://127.0.0.1:3000/apps/myApp/
```

The end-to-end suite does the same thing in `src/tests/e2e/fixtures/app.mjs`: a stand-in
application on a socket, opened at `/apps/fileExplorer/`.
