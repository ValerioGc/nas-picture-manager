use super::fixtures::edited;
use crate::images::ImageEdits;

#[test]
fn opaque_rgb_adjustments_match_rgba_for_the_entire_channel_range() {
    use crate::images::ExportFormat;
    use crate::tests::images::support::export_bytes;
    use image::{DynamicImage, ImageFormat, Rgb, RgbImage};
    use std::io::Cursor;
    let source = DynamicImage::ImageRgb8(RgbImage::from_fn(256, 1, |x, _| {
        Rgb([x as u8, (255 - x) as u8, ((x * 31) % 256) as u8])
    }));
    let mut rgb = Cursor::new(Vec::new());
    let mut rgba = Cursor::new(Vec::new());
    source.write_to(&mut rgb, ImageFormat::Png).unwrap();
    DynamicImage::ImageRgba8(source.to_rgba8())
        .write_to(&mut rgba, ImageFormat::Png)
        .unwrap();
    for brightness in [-100, -20, 0, 20, 100] {
        for contrast in [-100, -10, 0, 10, 100] {
            let edits = ImageEdits {
                brightness,
                contrast,
                ..Default::default()
            };
            let rgb = image::load_from_memory(
                &export_bytes(rgb.get_ref(), &edits, ExportFormat::Png).unwrap(),
            )
            .unwrap();
            let rgba = image::load_from_memory(
                &export_bytes(rgba.get_ref(), &edits, ExportFormat::Png).unwrap(),
            )
            .unwrap();
            assert_eq!(rgb.to_rgba8(), rgba.to_rgba8());
            assert!(!rgb.color().has_alpha());
        }
    }
}

#[test]
fn adjusts_rgb_and_preserves_alpha_even_at_extremes() {
    let bright = edited(ImageEdits {
        brightness: 20,
        ..Default::default()
    });
    assert_eq!(bright.get_pixel(0, 0).0, [91, 131, 151, 64]);
    let contrast = edited(ImageEdits {
        contrast: -100,
        ..Default::default()
    });
    assert!(contrast
        .pixels()
        .all(|pixel| pixel.0 == [128, 128, 128, 64]));
    let white = edited(ImageEdits {
        brightness: 100,
        ..Default::default()
    });
    assert!(white.pixels().all(|pixel| pixel.0 == [255, 255, 255, 64]));
}
