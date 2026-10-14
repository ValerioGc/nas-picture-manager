use super::{decode_bytes, document_decoded, DecodedImage};
use crate::images::{validation::validate_name, ImageDocument, ImageError, MAX_FILE_BYTES};
use std::{
    fs::File,
    io::Read,
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};

fn timestamp(time: std::io::Result<SystemTime>) -> Option<u64> {
    time.ok()?
        .duration_since(UNIX_EPOCH)
        .ok()
        .map(|duration| duration.as_millis() as u64)
}

/**
 * Reads an image file from the given path and returns an `ImageDocument` containing its information and preview.
 *
 * **Arguments**
 *
 * * `path` - A reference to the path of the image file to be read.
 *
 * **Returns**
 *
 * * `Ok(ImageDocument)` if the image was successfully read and decoded.
 * * `Err(ImageError)` if there was an error reading or decoding the image.
 */
pub fn read_file(path: &Path) -> Result<ImageDocument, ImageError> {
    Ok(read_file_decoded(path)?.1)
}

pub fn read_file_decoded(path: &Path) -> Result<(DecodedImage, ImageDocument), ImageError> {
    let (name, bytes) = file_bytes(path)?;
    let decoded = decode_bytes(&name, &bytes)?;
    let mut document = document_decoded(&decoded)?;
    let metadata = std::fs::metadata(path).map_err(|_| ImageError::Unavailable)?;
    document.info.folder = path
        .parent()
        .and_then(Path::file_name)
        .map(|name| name.to_string_lossy().into_owned());
    document.info.created = timestamp(metadata.created());
    document.info.modified = timestamp(metadata.modified());
    Ok((decoded, document))
}

/**
 * Reads the bytes of an image file from the given path and returns the file name and byte vector.
 *
 * **Arguments**
 *
 * * `path` - A reference to the path of the image file to be read.
 *
 * **Returns**
 *
 * * `Ok((String, Vec<u8>))` containing the file name and bytes if successful.
 * * `Err(ImageError)` if there was an error reading the file.
 */
pub fn file_bytes(path: &Path) -> Result<(String, Vec<u8>), ImageError> {
    let file = File::open(path).map_err(|_| ImageError::Unavailable)?;
    let metadata = file.metadata().map_err(|_| ImageError::Unavailable)?;
    if !metadata.is_file() {
        return Err(ImageError::InvalidInput);
    }
    if metadata.len() > MAX_FILE_BYTES as u64 {
        return Err(ImageError::FileTooLarge);
    }
    let name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or(ImageError::InvalidInput)?;
    let mut bytes = Vec::new();
    file.take((MAX_FILE_BYTES + 1) as u64)
        .read_to_end(&mut bytes)
        .map_err(|_| ImageError::Unavailable)?;
    validate_name(name)?;
    Ok((name.to_owned(), bytes))
}
