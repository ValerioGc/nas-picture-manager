#![cfg(unix)]

use std::{
    fs,
    io::{Read, Write},
    os::unix::{
        fs::symlink,
        net::{UnixListener, UnixStream},
    },
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::atomic::{AtomicUsize, Ordering},
    thread,
    time::{Duration, Instant},
};

static NEXT: AtomicUsize = AtomicUsize::new(0);

struct Fixture {
    directory: PathBuf,
    children: Vec<Child>,
}

impl Fixture {
    fn new() -> Self {
        let directory = std::env::temp_dir().join(format!(
            "pm-socket-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir(&directory).unwrap();
        fs::create_dir(directory.join("ui")).unwrap();
        fs::write(
            directory.join("ui/index.html"),
            "<!doctype html><html>Unix socket UI</html>",
        )
        .unwrap();
        Self {
            directory,
            children: vec![],
        }
    }

    fn command(&self) -> Command {
        let mut command = Command::new(env!("CARGO_BIN_EXE_nas-picture-manager-axum"));
        command
            .current_dir(&self.directory)
            .env_remove("NAS_APP_SOCKET")
            .env("PORT", "not-a-port")
            .env("NAS_UI_DIR", self.directory.join("ui"))
            .stdout(Stdio::null());
        command
    }

    fn start(&mut self, mut command: Command) {
        self.children.push(command.spawn().unwrap());
    }

    fn wait_for_socket(&mut self, name: &str) -> PathBuf {
        let path = self.directory.join(name);
        let deadline = Instant::now() + Duration::from_secs(10);
        loop {
            if UnixStream::connect(&path).is_ok() {
                return path;
            }
            assert!(
                self.children
                    .last_mut()
                    .unwrap()
                    .try_wait()
                    .unwrap()
                    .is_none(),
                "server exited before opening its socket"
            );
            assert!(Instant::now() < deadline, "server did not open its socket");
            thread::sleep(Duration::from_millis(20));
        }
    }

    fn stop(&mut self) {
        let child = self.children.last_mut().unwrap();
        assert!(Command::new("kill")
            .args(["-TERM", &child.id().to_string()])
            .status()
            .unwrap()
            .success());
        let deadline = Instant::now() + Duration::from_secs(5);
        loop {
            if let Some(status) = child.try_wait().unwrap() {
                assert!(
                    status.success(),
                    "SIGTERM must shut down gracefully: {status}"
                );
                break;
            }
            assert!(Instant::now() < deadline, "server ignored SIGTERM");
            thread::sleep(Duration::from_millis(20));
        }
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        for child in &mut self.children {
            let _ = child.kill();
            let _ = child.wait();
        }
        let _ = fs::remove_dir_all(&self.directory);
    }
}

fn request(socket: &Path, path: &str) -> String {
    for _ in 0..3 {
        let mut stream = UnixStream::connect(socket).unwrap();
        stream
            .set_read_timeout(Some(Duration::from_secs(3)))
            .unwrap();
        if write!(
            stream,
            "GET {path} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n"
        )
        .is_err()
        {
            thread::sleep(Duration::from_millis(20));
            continue;
        }
        let mut response = String::new();
        stream.read_to_string(&mut response).unwrap();
        assert!(response.starts_with("HTTP/1.1 200"), "{response}");
        return response;
    }
    panic!("server closed each readiness connection before accepting a request");
}

#[test]
fn cli_socket_serves_ui_and_api_overrides_env_and_cleans_up() {
    let mut fixture = Fixture::new();
    let mut command = fixture.command();
    command
        .args(["--listen", "cli.sock"])
        .env("NAS_APP_SOCKET", "unused.sock");
    fixture.start(command);
    let socket = fixture.wait_for_socket("cli.sock");
    assert!(request(&socket, "/").contains("Unix socket UI"));
    assert!(request(&socket, "/health").contains(env!("CARGO_PKG_VERSION")));
    assert!(!fixture.directory.join("unused.sock").exists());
    fixture.stop();
    assert!(!socket.exists());
}

#[test]
fn environment_socket_replaces_stale_socket() {
    let mut fixture = Fixture::new();
    let socket = fixture.directory.join("env.sock");
    drop(UnixListener::bind(&socket).unwrap());
    let mut command = fixture.command();
    command.env("NAS_APP_SOCKET", &socket);
    fixture.start(command);
    let socket = fixture.wait_for_socket("env.sock");
    request(&socket, "/health");
    fixture.stop();
    assert!(!socket.exists());
}

#[test]
fn refuses_active_sockets_regular_files_and_symlinks() {
    let fixture = Fixture::new();
    let active_path = fixture.directory.join("active.sock");
    let _listener = UnixListener::bind(&active_path).unwrap();
    let file = fixture.directory.join("file");
    fs::write(&file, "keep me").unwrap();
    let link = fixture.directory.join("link");
    symlink(&file, &link).unwrap();
    for path in [&active_path, &file, &link] {
        let output = fixture
            .command()
            .arg("--listen")
            .arg(path)
            .output()
            .unwrap();
        assert!(!output.status.success());
        assert!(path.exists());
    }
    assert!(UnixStream::connect(active_path).is_ok());
    assert_eq!(fs::read_to_string(file).unwrap(), "keep me");
    assert!(fs::symlink_metadata(link).unwrap().file_type().is_symlink());
}

#[test]
fn missing_socket_argument_does_not_start_tcp() {
    let fixture = Fixture::new();
    let output = fixture.command().arg("--listen").output().unwrap();
    assert!(!output.status.success());
    assert!(String::from_utf8_lossy(&output.stderr).contains("--listen requires a socket path"));
}

#[test]
fn requires_a_socket_even_with_a_development_port() {
    let fixture = Fixture::new();
    let output = fixture.command().env("PORT", "3030").output().unwrap();
    assert!(!output.status.success());
    assert!(String::from_utf8_lossy(&output.stderr).contains("provide --listen or NAS_APP_SOCKET"));
}

#[test]
fn rejects_unknown_duplicate_and_empty_socket_arguments() {
    let fixture = Fixture::new();
    for arguments in [
        vec!["--unknown"],
        vec!["--listen", "one.sock", "--listen", "two.sock"],
        vec!["--listen", ""],
    ] {
        assert!(!fixture
            .command()
            .args(arguments)
            .output()
            .unwrap()
            .status
            .success());
    }
    assert!(!fixture
        .command()
        .env("NAS_APP_SOCKET", "")
        .output()
        .unwrap()
        .status
        .success());
}

#[test]
fn socket_server_resolves_binary_relative_assets_and_shuts_down_on_interrupt() {
    let mut fixture = Fixture::new();
    let mut command = fixture.command();
    command
        .args(["--listen", "binary.sock"])
        .env_remove("NAS_UI_DIR");
    fixture.start(command);
    let socket = fixture.wait_for_socket("binary.sock");
    assert!(request(&socket, "/health").contains(env!("CARGO_PKG_VERSION")));
    let child = fixture.children.last_mut().unwrap();
    assert!(Command::new("kill")
        .args(["-INT", &child.id().to_string()])
        .status()
        .unwrap()
        .success());
    assert!(child.wait().unwrap().success());
    assert!(!socket.exists());
}
