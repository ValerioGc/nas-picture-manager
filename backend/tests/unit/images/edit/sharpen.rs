use super::fixtures::edited;
use crate::images::ImageEdits;

#[test]
fn sharpens_edges_without_changing_alpha_or_dimensions() {
    let original = edited(ImageEdits::default());
    let sharpened = edited(ImageEdits {
        sharpness: 50,
        ..Default::default()
    });
    assert_eq!(sharpened.dimensions(), original.dimensions());
    assert!(sharpened.get_pixel(0, 0)[0] < original.get_pixel(0, 0)[0]);
    assert!(sharpened.get_pixel(2, 1)[0] > original.get_pixel(2, 1)[0]);
    assert!(sharpened.pixels().all(|pixel| pixel[3] == 64));
}

#[test]
fn matches_the_full_gaussian_filter_across_strip_boundaries() {
    use crate::images::{export_bytes, ExportFormat};
    use image::{imageops, DynamicImage, ImageFormat, Rgba, RgbaImage};
    use std::io::Cursor;

    for height in [1, 2, 127, 128, 129, 257] {
        let original = RgbaImage::from_fn(17, height, |x, y| {
            Rgba([
                ((x * 71 + y * 19) % 256) as u8,
                ((x * 17 + y * 83) % 256) as u8,
                ((x * 39 + y * 37) % 256) as u8,
                ((x * 13 + y * 41) % 256) as u8,
            ])
        });
        let mut expected = original.clone();
        let blurred = imageops::blur(&original, 1.0);
        for (pixel, softened) in expected.pixels_mut().zip(blurred.pixels()) {
            for channel in 0..3 {
                pixel[channel] = (f32::from(pixel[channel])
                    + 2.0 * (f32::from(pixel[channel]) - f32::from(softened[channel])))
                .round()
                .clamp(0.0, 255.0) as u8;
            }
        }
        let mut bytes = Cursor::new(Vec::new());
        DynamicImage::ImageRgba8(original)
            .write_to(&mut bytes, ImageFormat::Png)
            .unwrap();
        let result = export_bytes(
            bytes.get_ref(),
            &ImageEdits {
                sharpness: 100,
                ..Default::default()
            },
            ExportFormat::Png,
        )
        .unwrap();
        assert_eq!(
            image::load_from_memory(&result).unwrap().to_rgba8(),
            expected,
            "height {height}"
        );
    }
}
