use super::{adjust::apply_adjustments, preview::geometry_preview};
use crate::images::{
    validation::{validate_edits, validate_name},
    viewer::{
        decode_bytes,
        encoding::{document_from_preview, image_info, DecodedImage},
    },
    ImageDocument, ImageEdits, ImageError,
};

/**
 * Renders an image from the given bytes and edits, returning an `ImageDocument` containing the updated information and preview.
 *
 * **Arguments**
 *
 * * `name` - The name of the image file.
 * * `bytes` - The byte content of the original image.
 * * `edits` - The edits to be applied to the image.
 *
 * **Returns**
 *
 * * `Ok(ImageDocument)` if the image was successfully rendered with the edits.
 * * `Err(ImageError)` if there was an error during the rendering process.
 */
pub fn render_bytes(
    name: &str,
    bytes: &[u8],
    edits: &ImageEdits,
) -> Result<ImageDocument, ImageError> {
    validate_name(name)?;
    validate_edits(edits)?;
    let source = decode_bytes(name, bytes)?;
    render_decoded(&source, edits)
}

pub fn render_decoded(
    source: &DecodedImage,
    edits: &ImageEdits,
) -> Result<ImageDocument, ImageError> {
    validate_edits(edits)?;
    let (preview, width, height) = geometry_preview(source, edits)?;
    let mut info = image_info(
        &source.name,
        source.size,
        source.image.as_ref(),
        source.format,
    );
    info.width = width;
    info.height = height;
    let preview = apply_adjustments(preview, edits);
    document_from_preview(info, &preview)
}
