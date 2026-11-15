# Contract of nas-picture-manager with the NAS launcher

The contract every application shares with the launcher (package, manifest, permissions, frame
protocol, launcher socket and providers) is `docs/development/external_apps/APPS.md` in the
nas-launcher repository, and the bridge is the one of `@valeriogc/nas-base-app`. This file keeps
only what is specific to nas-picture-manager, which builds and releases on its own.

## Identity

- id `nas-picture-manager`, category `media`
- permissions none beyond the template

## Specific to this application

An app runs inside an iframe, so the console's CSS does not style its page. Picture Manager loads
the shared surface rules only for its Axum build, and applies `app_surface` to its root.

The commands that check the repository are in [DEVELOPMENT.md](DEVELOPMENT.md).
