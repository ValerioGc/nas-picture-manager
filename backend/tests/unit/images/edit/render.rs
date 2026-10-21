use crate::images::{decode_bytes, render_decoded, CropRectangle, ImageEdits};
use crate::tests::images::support::render_bytes;
use image::{DynamicImage, GenericImageView, ImageFormat, Rgba, RgbaImage};
use std::io::Cursor;

fn fixture() -> Vec<u8> {
    let image = DynamicImage::ImageRgba8(RgbaImage::from_fn(3, 2, |x, y| {
        Rgba([(x + y * 3) as u8 * 30, 80, 100, 64])
    }));
    let mut bytes = Cursor::new(Vec::new());
    image.write_to(&mut bytes, ImageFormat::Png).unwrap();
    bytes.into_inner()
}

#[test]
fn applies_geometry_and_adjustments_without_changing_alpha() {
    let source = fixture();
    let document = render_bytes(
        "photo.png",
        &source,
        &ImageEdits {
            rotation: 1,
            crop: Some(CropRectangle {
                x: 0,
                y: 1,
                width: 1,
                height: 2,
            }),
            brightness: 20,
            ..Default::default()
        },
    )
    .unwrap();
    assert_eq!((document.info.width, document.info.height), (1, 2));
    assert!(image::load_from_memory(&document.preview)
        .unwrap()
        .to_rgba8()
        .pixels()
        .all(|pixel| pixel[3] == 64));
}

#[test]
fn reduces_only_the_preview_of_a_large_render() {
    let image = DynamicImage::new_rgba8(2049, 2);
    let mut source = Cursor::new(Vec::new());
    image.write_to(&mut source, ImageFormat::Png).unwrap();
    let document = render_bytes("large.png", source.get_ref(), &ImageEdits::default()).unwrap();
    assert_eq!((document.info.width, document.info.height), (2049, 2));
    assert_eq!(
        image::load_from_memory(&document.preview)
            .unwrap()
            .dimensions(),
        (2048, 2)
    );
}

#[test]
fn renders_a_decoded_source_like_the_original_bytes() {
    let source = fixture();
    let edits = ImageEdits {
        brightness: 20,
        contrast: -10,
        ..Default::default()
    };

    let expected = render_bytes("photo.png", &source, &edits).unwrap();
    let decoded = decode_bytes("photo.png", &source).unwrap();
    let actual = render_decoded(&decoded, &edits).unwrap();

    assert_eq!(actual.info.width, expected.info.width);
    assert_eq!(actual.info.height, expected.info.height);
    assert_eq!(actual.preview, expected.preview);
}
