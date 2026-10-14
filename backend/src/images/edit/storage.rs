use crate::images::ImageError;
use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::Path,
    sync::atomic::{AtomicU64, Ordering},
};
static NEXT_TEMP: AtomicU64 = AtomicU64::new(0);

/**
 * Saves a copy of the given bytes to the specified destination path.
 *
 * **Arguments**
 *
 * * `destination` - The path where the copy should be saved.
 * * `bytes` - The byte content to be written to the destination.
 * * `original` - An optional reference to the original file path to prevent overwriting it.
 *
 * **Returns**
 *
 * * `Ok(())` if the copy was successfully saved.
 * * `Err(ImageError)` if there was an error during the save process or if attempting to overwrite the original file.
 */
pub fn save_copy(
    destination: &Path,
    bytes: &[u8],
    original: Option<&Path>,
) -> Result<(), ImageError> {
    if let Some(original) = original {
        if destination == original
            || destination
                .canonicalize()
                .ok()
                .zip(original.canonicalize().ok())
                .is_some_and(|(a, b)| a == b)
        {
            return Err(ImageError::OverwriteOriginal);
        }
    }

    let parent = destination.parent().ok_or(ImageError::SaveFailed)?;
    let temporary = parent.join(format!(
        ".picture-manager-{}-{}.tmp",
        std::process::id(),
        NEXT_TEMP.fetch_add(1, Ordering::Relaxed)
    ));

    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temporary)
        .map_err(|_| ImageError::SaveFailed)?;

    let result = file.write_all(bytes).and_then(|()| file.sync_all());
    drop(file);
    let result = result.and_then(|()| fs::rename(&temporary, destination));
    if result.is_err() {
        let _ = fs::remove_file(temporary);
    }
    result.map_err(|_| ImageError::SaveFailed)
}
