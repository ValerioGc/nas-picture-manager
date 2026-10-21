use crate::images::ImageError;

const MAX_METADATA_BYTES: usize = 4 * 1024 * 1024;

/// Validate chunk ranges before the codec can allocate from an untrusted EXIF length.
pub(super) fn validate_container(bytes: &[u8]) -> Result<(), ImageError> {
    let header = bytes.get(..12).ok_or(ImageError::InvalidImage)?;
    let length = u32::from_le_bytes(
        header[4..8]
            .try_into()
            .map_err(|_| ImageError::InvalidImage)?,
    ) as usize;
    let end = length.checked_add(8).ok_or(ImageError::InvalidImage)?;
    if end < 12 || end > bytes.len() {
        return Err(ImageError::InvalidImage);
    }
    let mut offset = 12;
    let mut metadata_bytes = 0_usize;
    while offset < end {
        let chunk_header_end = offset.checked_add(8).ok_or(ImageError::InvalidImage)?;
        let header = bytes
            .get(offset..chunk_header_end)
            .filter(|_| chunk_header_end <= end)
            .ok_or(ImageError::InvalidImage)?;
        let length = u32::from_le_bytes(
            header[4..8]
                .try_into()
                .map_err(|_| ImageError::InvalidImage)?,
        ) as usize;
        offset = chunk_header_end
            .checked_add(length)
            .and_then(|value| value.checked_add(length % 2))
            .filter(|value| *value <= end)
            .ok_or(ImageError::InvalidImage)?;
        if matches!(&header[..4], b"EXIF" | b"ICCP" | b"XMP ") {
            metadata_bytes = metadata_bytes
                .checked_add(length)
                .filter(|value| *value <= MAX_METADATA_BYTES)
                .ok_or(ImageError::DecodeMemoryLimitExceeded)?;
        }
    }
    Ok(())
}
