use super::fixtures::edited;
use crate::images::{CropRectangle, ImageEdits};
use image::DynamicImage;

#[test]
fn applies_rotation_then_flips_then_crop() {
    let output = edited(ImageEdits {
        rotation: 1,
        flip_horizontal: true,
        crop: Some(CropRectangle {
            x: 1,
            y: 0,
            width: 1,
            height: 2,
        }),
        ..Default::default()
    });
    assert_eq!(output.dimensions(), (1, 2));
    assert_eq!(output.get_pixel(0, 0)[0], 100);
    assert_eq!(output.get_pixel(0, 1)[0], 120);
}

#[test]
fn cropping_a_source_view_matches_rotation_and_flips_for_every_geometry() {
    use crate::images::ExportFormat;
    use crate::tests::images::support::{export_bytes, render_bytes};
    use image::{ImageFormat, Rgba, RgbaImage};
    use std::io::Cursor;
    let source = DynamicImage::ImageRgba8(RgbaImage::from_fn(7, 5, |x, y| {
        Rgba([
            x as u8 * 30,
            y as u8 * 40,
            (x + y) as u8 * 20,
            (x * y) as u8 * 8,
        ])
    }));
    let mut bytes = Cursor::new(Vec::new());
    source.write_to(&mut bytes, ImageFormat::Png).unwrap();
    for rotation in 0..4 {
        for flip_horizontal in [false, true] {
            for flip_vertical in [false, true] {
                let expected = cropped_geometry(&source, rotation, flip_horizontal, flip_vertical);
                let edits = ImageEdits {
                    rotation,
                    flip_horizontal,
                    flip_vertical,
                    crop: Some(CropRectangle {
                        x: 1,
                        y: 1,
                        width: 3,
                        height: 2,
                    }),
                    ..Default::default()
                };
                let exported = export_bytes(bytes.get_ref(), &edits, ExportFormat::Png).unwrap();
                let preview = render_bytes("geometry.png", bytes.get_ref(), &edits).unwrap();
                assert_eq!(
                    image::load_from_memory(&exported).unwrap().to_rgba8(),
                    expected.to_rgba8()
                );
                assert_eq!(
                    image::load_from_memory(&preview.preview)
                        .unwrap()
                        .to_rgba8(),
                    expected.to_rgba8()
                );
            }
        }
    }
}

fn cropped_geometry(
    source: &DynamicImage,
    rotation: u8,
    flip_horizontal: bool,
    flip_vertical: bool,
) -> DynamicImage {
    let mut expected = match rotation {
        1 => source.rotate90(),
        2 => source.rotate180(),
        3 => source.rotate270(),
        _ => source.clone(),
    };
    if flip_horizontal {
        expected = expected.fliph();
    }
    if flip_vertical {
        expected = expected.flipv();
    }
    expected.crop_imm(1, 1, 3, 2)
}
