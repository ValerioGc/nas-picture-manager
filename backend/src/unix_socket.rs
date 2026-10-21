use std::{
    fs, io,
    os::unix::fs::{FileTypeExt, MetadataExt},
    path::{Path, PathBuf},
};
use tokio::net::{UnixListener, UnixStream};

pub struct Cleanup {
    path: PathBuf,
    device: u64,
    inode: u64,
}

impl Drop for Cleanup {
    fn drop(&mut self) {
        if let Ok(metadata) = fs::symlink_metadata(&self.path) {
            if metadata.file_type().is_socket()
                && metadata.dev() == self.device
                && metadata.ino() == self.inode
            {
                let _ = fs::remove_file(&self.path);
            }
        }
    }
}

/// Bind the socket, replacing a stale socket but never a live one or a different file.
pub async fn bind(path: &Path) -> io::Result<(UnixListener, Cleanup)> {
    match fs::symlink_metadata(path) {
        Ok(metadata) => {
            if !metadata.file_type().is_socket() {
                return Err(io::Error::new(
                    io::ErrorKind::AlreadyExists,
                    format!("refusing to remove a non-socket path: {}", path.display()),
                ));
            }
            match UnixStream::connect(path).await {
                Ok(_) => {
                    return Err(io::Error::new(
                        io::ErrorKind::AddrInUse,
                        "Unix socket is already in use",
                    ))
                }
                Err(error) if error.kind() == io::ErrorKind::ConnectionRefused => {
                    let current = fs::symlink_metadata(path)?;
                    if current.dev() != metadata.dev() || current.ino() != metadata.ino() {
                        return Err(io::Error::new(
                            io::ErrorKind::AlreadyExists,
                            "socket changed during startup",
                        ));
                    }
                    fs::remove_file(path)?;
                }
                Err(error) => return Err(error),
            }
        }
        Err(error) if error.kind() == io::ErrorKind::NotFound => {}
        Err(error) => return Err(error),
    }
    let listener = UnixListener::bind(path)?;
    let metadata = fs::symlink_metadata(path)?;
    let cleanup = Cleanup {
        path: path.to_path_buf(),
        device: metadata.dev(),
        inode: metadata.ino(),
    };
    Ok((listener, cleanup))
}
