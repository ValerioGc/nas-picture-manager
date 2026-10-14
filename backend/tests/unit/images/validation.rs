use crate::images::{validate_edits, validate_name, ImageEdits, ImageError};

#[test]
fn validates_names_and_edit_ranges() {
    for name in ["", ".", "..", "path/image.png", "path\\image.png"] {
        assert_eq!(validate_name(name), Err(ImageError::InvalidInput));
    }

    assert!(validate_name("photo.png").is_ok());
    for edits in [
        ImageEdits {
            rotation: 4,
            ..Default::default()
        },
        ImageEdits {
            brightness: 101,
            ..Default::default()
        },
        ImageEdits {
            contrast: -101,
            ..Default::default()
        },
        ImageEdits {
            sharpness: 101,
            ..Default::default()
        },
    ] {
        assert_eq!(validate_edits(&edits), Err(ImageError::InvalidEdits));
    }
}
