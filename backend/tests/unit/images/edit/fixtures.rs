use crate::images::{ExportFormat, ImageEdits};
use crate::tests::images::support::export_bytes;
use image::{DynamicImage, ImageFormat, Rgba, RgbaImage};
use std::io::Cursor;

pub fn source() -> Vec<u8> {
    let mut bytes = Cursor::new(Vec::new());
    DynamicImage::ImageRgba8(RgbaImage::from_fn(3, 2, |x, y| {
        Rgba([40 + (x + y * 3) as u8 * 20, 80, 100, 64])
    }))
    .write_to(&mut bytes, ImageFormat::Png)
    .unwrap();
    bytes.into_inner()
}

pub fn edited(edits: ImageEdits) -> RgbaImage {
    image::load_from_memory(&export_bytes(&source(), &edits, ExportFormat::Png).unwrap())
        .unwrap()
        .to_rgba8()
}
