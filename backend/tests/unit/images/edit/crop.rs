use super::fixtures::{edited, source};
use crate::images::{export_bytes, CropRectangle, ExportFormat, ImageEdits, ImageError};

#[test]
fn crops_selected_pixels_and_rejects_out_of_bounds_or_overflow() {
    let crop = CropRectangle {
        x: 1,
        y: 1,
        width: 2,
        height: 1,
    };
    let output = edited(ImageEdits {
        crop: Some(crop),
        ..Default::default()
    });
    assert_eq!(output.dimensions(), (2, 1));
    assert_eq!(output.get_pixel(0, 0)[0], 120);
    for invalid in [
        CropRectangle { width: 3, ..crop },
        CropRectangle {
            x: u32::MAX,
            ..crop
        },
        CropRectangle { width: 0, ..crop },
    ] {
        assert_eq!(
            export_bytes(
                &source(),
                &ImageEdits {
                    crop: Some(invalid),
                    ..Default::default()
                },
                ExportFormat::Png
            ),
            Err(ImageError::InvalidEdits)
        );
    }
}
