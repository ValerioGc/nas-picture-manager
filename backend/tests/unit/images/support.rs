use crate::images::{
    decode_bytes, document_decoded, export_decoded, render_decoded, validate_edits,
    validation::validate_name, ExportFormat, ImageDocument, ImageEdits, ImageError,
};

pub fn read_bytes(name: &str, bytes: &[u8]) -> Result<ImageDocument, ImageError> {
    document_decoded(&decode_bytes(name, bytes)?)
}

pub fn render_bytes(
    name: &str,
    bytes: &[u8],
    edits: &ImageEdits,
) -> Result<ImageDocument, ImageError> {
    validate_name(name)?;
    validate_edits(edits)?;
    render_decoded(&decode_bytes(name, bytes)?, edits)
}

pub fn export_bytes(
    bytes: &[u8],
    edits: &ImageEdits,
    format: ExportFormat,
) -> Result<Vec<u8>, ImageError> {
    export_annotated_bytes(bytes, edits, format, None)
}

pub fn export_annotated_bytes(
    bytes: &[u8],
    edits: &ImageEdits,
    format: ExportFormat,
    annotations: Option<&[u8]>,
) -> Result<Vec<u8>, ImageError> {
    export_with_layer(bytes, edits, format, annotations, false)
}

pub fn export_overlay_bytes(
    bytes: &[u8],
    edits: &ImageEdits,
    format: ExportFormat,
    overlay: Option<&[u8]>,
) -> Result<Vec<u8>, ImageError> {
    export_with_layer(bytes, edits, format, overlay, true)
}

fn export_with_layer(
    bytes: &[u8],
    edits: &ImageEdits,
    format: ExportFormat,
    layer: Option<&[u8]>,
    transformed: bool,
) -> Result<Vec<u8>, ImageError> {
    validate_edits(edits)?;
    export_decoded(
        decode_bytes("image", bytes)?,
        edits,
        format,
        layer,
        transformed,
    )
}
