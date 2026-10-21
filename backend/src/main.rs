mod launcher_only;
use std::{ffi::OsString, io, path::PathBuf};

mod unix_socket;

/// Read the socket path from `--listen` or from `NAS_APP_SOCKET`.
fn socket_path(
    mut arguments: impl Iterator<Item = OsString>,
    environment: Option<OsString>,
) -> io::Result<PathBuf> {
    let mut socket = None;
    while let Some(argument) = arguments.next() {
        if argument != "--listen" || socket.is_some() {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "expected --listen <socket-path> (at most once)",
            ));
        }
        socket = Some(
            arguments
                .next()
                .filter(|value| !value.is_empty())
                .ok_or_else(|| {
                    io::Error::new(
                        io::ErrorKind::InvalidInput,
                        "--listen requires a socket path",
                    )
                })?,
        );
    }
    socket
        .or(environment)
        .map(|value| {
            if value.is_empty() {
                Err(io::Error::new(
                    io::ErrorKind::InvalidInput,
                    "socket path cannot be empty",
                ))
            } else {
                Ok(PathBuf::from(value))
            }
        })
        .transpose()?
        .ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::InvalidInput,
                "provide --listen or NAS_APP_SOCKET",
            )
        })
}

/// Locate the UI from `NAS_UI_DIR` or next to the installed binary.
fn ui_directory() -> io::Result<PathBuf> {
    if let Some(directory) = std::env::var_os("NAS_UI_DIR") {
        return Ok(PathBuf::from(directory));
    }
    let executable = std::env::current_exe()?;
    let directory = executable.parent().ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::InvalidInput,
            "executable has no parent directory",
        )
    })?;
    Ok(directory.join("../dist"))
}

/// Wait for Ctrl+C or for the SIGTERM of the service manager.
async fn shutdown_signal() {
    let interrupt = async {
        tokio::signal::ctrl_c()
            .await
            .expect("unable to listen for Ctrl+C");
    };

    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("unable to listen for SIGTERM")
            .recv()
            .await;
    };

    tokio::select! {
        _ = interrupt => {},
        _ = terminate => {},
    }

    println!("shutdown requested, closing the server");
}

#[tokio::main]
async fn main() -> io::Result<()> {
    let socket = socket_path(
        std::env::args_os().skip(1),
        std::env::var_os("NAS_APP_SOCKET"),
    )?;

    let app = nas_picture_manager_axum::build_router_with_ui(ui_directory()?);
    let (listener, _cleanup) = unix_socket::bind(&socket).await?;
    println!("nas-picture-manager listening on {}", socket.display());
    axum::serve(launcher_only::LauncherOnly::new(listener), app)
        .with_graceful_shutdown(shutdown_signal())
        .await
}
