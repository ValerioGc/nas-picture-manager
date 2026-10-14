use crate::images::{
    decode_bytes, document_decoded, export_bytes, export_decoded, ExportFormat, ImageEdits,
};
use image::{DynamicImage, GenericImageView, ImageFormat};
use std::io::Cursor;

#[test]
fn exports_owned_and_shared_cached_snapshots_without_modifying_the_original() {
    let source = png_fixture();
    let edits = ImageEdits {
        rotation: 1,
        brightness: 20,
        ..Default::default()
    };
    for format in [ExportFormat::Png, ExportFormat::Jpeg, ExportFormat::Webp] {
        let expected = export_bytes(&source, &edits, format).unwrap();
        let decoded = decode_bytes("original.png", &source).unwrap();
        let shared = decoded.clone();
        assert_eq!(
            export_decoded(decoded, &edits, format, None, true).unwrap(),
            expected
        );
        let original = document_decoded(&shared).unwrap();
        assert_eq!((original.info.width, original.info.height), (3, 2));
        assert_eq!(
            export_decoded(
                decode_bytes("original.png", &source).unwrap(),
                &edits,
                format,
                None,
                true
            )
            .unwrap(),
            expected
        );
    }
}

fn png_fixture() -> Vec<u8> {
    let mut bytes = Cursor::new(Vec::new());
    DynamicImage::new_rgba8(3, 2)
        .write_to(&mut bytes, ImageFormat::Png)
        .unwrap();
    bytes.into_inner()
}

#[test]
fn exports_supported_formats_and_composites_jpeg_alpha_onto_white() {
    let source = png_fixture();
    for (format, detected) in [
        (ExportFormat::Png, ImageFormat::Png),
        (ExportFormat::Jpeg, ImageFormat::Jpeg),
        (ExportFormat::Webp, ImageFormat::WebP),
        (ExportFormat::Gif, ImageFormat::Gif),
        (ExportFormat::Bmp, ImageFormat::Bmp),
        (ExportFormat::Tiff, ImageFormat::Tiff),
        (ExportFormat::Ico, ImageFormat::Ico),
    ] {
        let bytes = export_bytes(&source, &ImageEdits::default(), format).unwrap();
        assert_eq!(image::guess_format(&bytes).unwrap(), detected);
        let decoded = image::load_from_memory(&bytes).unwrap();
        assert_eq!(decoded.dimensions(), (3, 2));
    }
    let jpeg = export_bytes(&source, &ImageEdits::default(), ExportFormat::Jpeg).unwrap();
    assert!(image::load_from_memory(&jpeg)
        .unwrap()
        .to_rgb8()
        .pixels()
        .all(|pixel| pixel[0] >= 254 && pixel[1] >= 254 && pixel[2] >= 254));
}

#[test]
fn export_formats_have_stable_extensions_and_mime_types() {
    for (format, extension, mime) in [
        (ExportFormat::Png, "png", "image/png"),
        (ExportFormat::Jpeg, "jpg", "image/jpeg"),
        (ExportFormat::Webp, "webp", "image/webp"),
        (ExportFormat::Gif, "gif", "image/gif"),
        (ExportFormat::Bmp, "bmp", "image/bmp"),
        (ExportFormat::Tiff, "tiff", "image/tiff"),
        (ExportFormat::Ico, "ico", "image/x-icon"),
    ] {
        assert_eq!(format.extension(), extension);
        assert_eq!(format.mime_type(), mime);
    }
}

#[test]
fn preserves_source_format_after_rotation_for_every_supported_original() {
    for (format, detected) in [
        (ExportFormat::Png, ImageFormat::Png),
        (ExportFormat::Jpeg, ImageFormat::Jpeg),
        (ExportFormat::Webp, ImageFormat::WebP),
        (ExportFormat::Gif, ImageFormat::Gif),
        (ExportFormat::Bmp, ImageFormat::Bmp),
        (ExportFormat::Tiff, ImageFormat::Tiff),
        (ExportFormat::Ico, ImageFormat::Ico),
    ] {
        let image = coloured_image_fixture();
        let mut source = Cursor::new(Vec::new());
        image.write_to(&mut source, detected).unwrap();
        let edits = ImageEdits {
            rotation: 1,
            ..Default::default()
        };
        let exported = export_bytes(source.get_ref(), &edits, format).unwrap();
        assert_eq!(image::guess_format(&exported).unwrap(), detected);
        let reopened = image::load_from_memory(&exported).unwrap();
        assert_eq!(reopened.dimensions(), (2, 3));
        let expected = image::load_from_memory(source.get_ref())
            .unwrap()
            .rotate90()
            .to_rgba8();
        let actual = reopened.to_rgba8();
        for (actual, expected) in actual.pixels().zip(expected.pixels()) {
            for channel in 0..3 {
                let tolerance = if format == ExportFormat::Jpeg { 40 } else { 0 };
                assert!(actual[channel].abs_diff(expected[channel]) <= tolerance);
            }
        }
    }
}

fn coloured_image_fixture() -> DynamicImage {
    DynamicImage::ImageRgba8(image::RgbaImage::from_fn(3, 2, |x, y| {
        image::Rgba([
            if x == 0 { 255 } else { 0 },
            if y == 0 { 255 } else { 0 },
            0,
            255,
        ])
    }))
}
