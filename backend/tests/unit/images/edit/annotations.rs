use super::fixtures::source;
use crate::images::{CropRectangle, ExportFormat, ImageEdits, ImageError};
use crate::tests::images::support::export_annotated_bytes;
use image::{DynamicImage, ImageFormat, Rgba, RgbaImage};
use std::io::Cursor;

fn overlay(width: u32, height: u32, format: ImageFormat) -> Vec<u8> {
    let mut image = RgbaImage::new(width, height);
    image.put_pixel(1, 1, Rgba([255, 0, 0, 128]));
    let mut bytes = Cursor::new(Vec::new());
    DynamicImage::ImageRgba8(image)
        .write_to(&mut bytes, format)
        .unwrap();
    bytes.into_inner()
}

#[test]
fn composites_annotations_after_adjustments_and_preserves_transparent_pixels() {
    let edits = ImageEdits {
        brightness: 100,
        ..Default::default()
    };
    let png = export_annotated_bytes(
        &source(),
        &edits,
        ExportFormat::Png,
        Some(&overlay(3, 2, ImageFormat::Png)),
    )
    .unwrap();
    let decoded = image::load_from_memory(&png).unwrap().to_rgba8();
    assert_eq!(decoded.get_pixel(0, 0), &Rgba([255, 255, 255, 64]));
    let pixel = decoded.get_pixel(1, 1);
    assert_eq!(pixel[0], 255);
    assert!(pixel[1] < 60);
    assert!(pixel[3] >= 159 && pixel[3] <= 160);
}

#[test]
fn annotations_follow_rotation_flips_and_crop_in_all_output_formats() {
    let edits = ImageEdits {
        rotation: 1,
        flip_horizontal: true,
        crop: Some(CropRectangle {
            x: 1,
            y: 1,
            width: 1,
            height: 1,
        }),
        ..Default::default()
    };
    for format in [
        ExportFormat::Png,
        ExportFormat::Webp,
        ExportFormat::Jpeg,
        ExportFormat::Gif,
        ExportFormat::Bmp,
        ExportFormat::Tiff,
        ExportFormat::Ico,
    ] {
        let bytes = export_annotated_bytes(
            &source(),
            &edits,
            format,
            Some(&overlay(3, 2, ImageFormat::Png)),
        )
        .unwrap();
        let decoded = image::load_from_memory(&bytes).unwrap().to_rgba8();
        assert_eq!(decoded.dimensions(), (1, 1));
        assert!(decoded.get_pixel(0, 0)[0] > decoded.get_pixel(0, 0)[1]);
    }
}

#[test]
fn validates_overlay_dimensions_format_bytes_and_edits() {
    let edits = ImageEdits::default();
    for overlay in [
        overlay(2, 2, ImageFormat::Png),
        overlay(3, 2, ImageFormat::WebP),
    ] {
        assert!(matches!(
            export_annotated_bytes(&source(), &edits, ExportFormat::Png, Some(&overlay)),
            Err(ImageError::InvalidEdits)
        ));
    }
    assert!(matches!(
        export_annotated_bytes(&source(), &edits, ExportFormat::Png, Some(&[])),
        Err(ImageError::InvalidImage)
    ));
    assert!(matches!(
        export_annotated_bytes(
            &source(),
            &edits,
            ExportFormat::Png,
            Some(&vec![0; 30 * 1024 * 1024 + 1])
        ),
        Err(ImageError::FileTooLarge)
    ));
    assert!(matches!(
        export_annotated_bytes(
            &source(),
            &ImageEdits {
                rotation: 4,
                ..Default::default()
            },
            ExportFormat::Png,
            None
        ),
        Err(ImageError::InvalidEdits)
    ));
}

#[test]
fn final_coordinate_overlays_match_original_coordinate_overlays() {
    use crate::tests::images::support::{export_bytes, export_overlay_bytes};
    for rotation in 0..4 {
        for flip_horizontal in [false, true] {
            for flip_vertical in [false, true] {
                let geometry = ImageEdits {
                    rotation,
                    flip_horizontal,
                    flip_vertical,
                    crop: Some(CropRectangle {
                        x: 0,
                        y: 0,
                        width: 2,
                        height: 2,
                    }),
                    ..Default::default()
                };
                let original_overlay = overlay(3, 2, ImageFormat::Png);
                let final_overlay =
                    export_bytes(&original_overlay, &geometry, ExportFormat::Png).unwrap();
                let edits = ImageEdits {
                    brightness: 20,
                    ..geometry
                };
                let expected = export_annotated_bytes(
                    &source(),
                    &edits,
                    ExportFormat::Png,
                    Some(&original_overlay),
                )
                .unwrap();
                let actual = export_overlay_bytes(
                    &source(),
                    &edits,
                    ExportFormat::Png,
                    Some(&final_overlay),
                )
                .unwrap();
                assert_eq!(
                    image::load_from_memory(&actual).unwrap().to_rgba8(),
                    image::load_from_memory(&expected).unwrap().to_rgba8()
                );
            }
        }
    }
}

#[test]
fn opaque_rgb_compositing_matches_rgba_without_an_extra_alpha_buffer() {
    use crate::tests::images::support::export_overlay_bytes;
    let image = image::load_from_memory(&source()).unwrap().to_rgb8();
    let mut rgb = Cursor::new(Vec::new());
    let mut rgba = Cursor::new(Vec::new());
    DynamicImage::ImageRgb8(image.clone())
        .write_to(&mut rgb, ImageFormat::Png)
        .unwrap();
    DynamicImage::ImageRgba8(DynamicImage::ImageRgb8(image).into_rgba8())
        .write_to(&mut rgba, ImageFormat::Png)
        .unwrap();
    let overlay = overlay(3, 2, ImageFormat::Png);
    let rgb = export_overlay_bytes(
        rgb.get_ref(),
        &ImageEdits::default(),
        ExportFormat::Png,
        Some(&overlay),
    )
    .unwrap();
    let rgba = export_overlay_bytes(
        rgba.get_ref(),
        &ImageEdits::default(),
        ExportFormat::Png,
        Some(&overlay),
    )
    .unwrap();
    let rgb = image::load_from_memory(&rgb).unwrap();
    assert!(!rgb.color().has_alpha());
    assert_eq!(
        rgb.to_rgb8(),
        image::load_from_memory(&rgba).unwrap().to_rgb8()
    );
    assert!(rgb.to_rgba8().pixels().all(|pixel| pixel[3] == 255));
}
