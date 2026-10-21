use crate::images::{ImageError, MAX_FILE_BYTES};
use crate::tests::images::support::read_bytes;
use image::{DynamicImage, ImageFormat};
use std::io::Cursor;

#[test]
fn reads_high_resolution_images_with_bounded_previews() {
    for format in [ImageFormat::Jpeg, ImageFormat::Png] {
        let picture = if format == ImageFormat::Png {
            DynamicImage::new_rgba8(6016, 6016)
        } else {
            DynamicImage::new_rgb8(6016, 6016)
        };
        let mut buffer = Cursor::new(Vec::new());
        picture.write_to(&mut buffer, format).unwrap();
        drop(picture);
        assert!(buffer.get_ref().len() < MAX_FILE_BYTES);

        let document = read_bytes("wallpaper.image", buffer.get_ref()).unwrap();
        assert_eq!((document.info.width, document.info.height), (6016, 6016));
        assert_eq!(document.info.has_alpha, format == ImageFormat::Png);
        let preview = image::load_from_memory(&document.preview).unwrap();
        assert_eq!((preview.width(), preview.height()), (2048, 2048));
    }
}

#[test]
fn accepts_images_at_the_pixel_limit() {
    let picture = DynamicImage::new_luma8(10_000, 10_000);
    let mut buffer = Cursor::new(Vec::new());
    picture.write_to(&mut buffer, ImageFormat::Png).unwrap();
    drop(picture);
    let document = read_bytes("100mp.png", buffer.get_ref()).unwrap();
    assert_eq!(
        (document.info.width, document.info.height),
        (10_000, 10_000)
    );
}

#[test]
fn rejects_excessive_pixel_counts_and_edges_before_decoding() {
    let mut buffer = Cursor::new(Vec::new());
    DynamicImage::new_rgb8(1, 1)
        .write_to(&mut buffer, ImageFormat::Bmp)
        .unwrap();
    let mut bytes = buffer.into_inner();
    for (width, height, expected) in [
        (10_001_i32, 10_000_i32, ImageError::PixelLimitExceeded),
        (16_385, 1, ImageError::DimensionLimitExceeded),
        (1, 16_385, ImageError::DimensionLimitExceeded),
    ] {
        bytes[18..22].copy_from_slice(&width.to_le_bytes());
        bytes[22..26].copy_from_slice(&height.to_le_bytes());
        assert_eq!(read_bytes("too_large.bmp", &bytes).unwrap_err(), expected);
    }
}

#[test]
fn reports_memory_limit_for_high_bit_depth_images() {
    let mut buffer = Cursor::new(Vec::new());
    DynamicImage::new_rgba16(1, 1)
        .write_to(&mut buffer, ImageFormat::Tiff)
        .unwrap();
    let mut bytes = buffer.into_inner();
    assert_eq!(&bytes[..2], b"II");
    let directory = u32::from_le_bytes(bytes[4..8].try_into().unwrap()) as usize;
    let entries = u16::from_le_bytes(bytes[directory..directory + 2].try_into().unwrap());
    for index in 0..usize::from(entries) {
        let offset = directory + 2 + index * 12;
        let tag = u16::from_le_bytes(bytes[offset..offset + 2].try_into().unwrap());
        let dimension: u32 = match tag {
            256 => 8193,
            257 => 8192,
            _ => continue,
        };
        bytes[offset + 8..offset + 12].copy_from_slice(&dimension.to_le_bytes());
    }
    assert_eq!(
        read_bytes("high_bit_depth.tiff", &bytes).unwrap_err(),
        ImageError::DecodeMemoryLimitExceeded
    );
}

#[test]
fn rejects_unsafe_names_invalid_content_and_oversized_uploads() {
    assert_eq!(MAX_FILE_BYTES, 30 * 1024 * 1024);
    for name in ["../secret.png", "C:\\secret.png"] {
        assert!(matches!(
            read_bytes(name, b"bad"),
            Err(ImageError::InvalidInput)
        ));
    }
    assert!(matches!(
        read_bytes("photo.png", b"not an image"),
        Err(ImageError::UnsupportedFormat)
    ));
    assert!(matches!(
        read_bytes("photo.png", &vec![0; MAX_FILE_BYTES + 1]),
        Err(ImageError::FileTooLarge)
    ));
    assert!(matches!(
        read_bytes("photo.png", b"\x89PNG\r\n\x1a\n"),
        Err(ImageError::InvalidImage)
    ));
}

fn extended_webp(metadata: &[u8]) -> Vec<u8> {
    let mut encoded = Cursor::new(Vec::new());
    DynamicImage::new_rgba8(4, 2)
        .write_to(&mut encoded, ImageFormat::WebP)
        .unwrap();
    let mut bytes = b"RIFF\0\0\0\0WEBPVP8X".to_vec();
    bytes.extend_from_slice(&10_u32.to_le_bytes());
    bytes.extend_from_slice(&[8, 0, 0, 0, 3, 0, 0, 1, 0, 0]);
    bytes.extend_from_slice(&encoded.get_ref()[12..]);
    bytes.extend_from_slice(b"EXIF");
    bytes.extend_from_slice(&(metadata.len() as u32).to_le_bytes());
    bytes.extend_from_slice(metadata);
    if metadata.len() % 2 == 1 {
        bytes.push(0);
    }
    let length = (bytes.len() - 8) as u32;
    bytes[4..8].copy_from_slice(&length.to_le_bytes());
    bytes
}

#[test]
fn validates_webp_chunk_lengths_before_reading_metadata() {
    let mut bytes = extended_webp(&[]);
    let offset = bytes.len() - 4;
    for length in [8 * 1024 * 1024, u32::MAX] {
        bytes[offset..].copy_from_slice(&length.to_le_bytes());
        assert_eq!(
            read_bytes("truncated.webp", &bytes).unwrap_err(),
            ImageError::InvalidImage
        );
    }
    let mut bytes = extended_webp(&[0]);
    bytes.pop();
    let length = (bytes.len() - 8) as u32;
    bytes[4..8].copy_from_slice(&length.to_le_bytes());
    assert_eq!(
        read_bytes("padding.webp", &bytes).unwrap_err(),
        ImageError::InvalidImage
    );
}

#[test]
fn keeps_valid_webp_exif_orientation_and_caps_actual_metadata() {
    let exif = b"II\x2a\0\x08\0\0\0\x01\0\x12\x01\x03\0\x01\0\0\0\x06\0\0\0\0\0\0\0";
    let document = read_bytes("oriented.webp", &extended_webp(exif)).unwrap();
    assert_eq!((document.info.width, document.info.height), (2, 4));
    assert_eq!(
        read_bytes(
            "metadata.webp",
            &extended_webp(&vec![0; 4 * 1024 * 1024 + 1])
        )
        .unwrap_err(),
        ImageError::DecodeMemoryLimitExceeded
    );
}
