use crate::images::{read_file, ImageError};
use image::ImageFormat;
use std::{fs, io::Cursor};

#[test]
fn reads_all_supported_formats_from_content() {
    for format in [
        ImageFormat::Png,
        ImageFormat::Jpeg,
        ImageFormat::WebP,
        ImageFormat::Gif,
        ImageFormat::Bmp,
        ImageFormat::Tiff,
        ImageFormat::Ico,
    ] {
        let picture = if format == ImageFormat::Ico {
            image::DynamicImage::new_rgba8(3, 2)
        } else {
            image::DynamicImage::new_rgb8(3, 2)
        };
        let mut buffer = Cursor::new(Vec::new());
        picture
            .write_to(&mut buffer, format)
            .expect("fixture encoding");
        let result = crate::images::read_bytes("foto.image", buffer.get_ref())
            .unwrap_or_else(|error| panic!("{format:?}: {error:?}"));
        assert_eq!((result.info.width, result.info.height), (3, 2));
        assert_eq!(result.info.size, buffer.get_ref().len());
        assert!(result.preview.starts_with(b"\x89PNG"));
    }
}

#[test]
fn reads_real_file_metadata_and_alpha() {
    let directory =
        std::env::temp_dir().join(format!("picture-manager-reader-{}", std::process::id()));
    fs::create_dir_all(&directory).unwrap();
    let path = directory.join("image.png");
    image::DynamicImage::new_rgba8(3, 2).save(&path).unwrap();
    let document = read_file(&path).expect("project fixture");
    assert!(document.info.width > 0);
    assert!(document.info.modified.is_some());
    assert_eq!(
        document.info.folder.as_deref(),
        directory.file_name().and_then(|name| name.to_str())
    );
    assert!(matches!(
        read_file(&directory.join("missing.png")),
        Err(ImageError::Unavailable)
    ));
    fs::remove_dir_all(directory).unwrap();
}
