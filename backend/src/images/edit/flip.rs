use image::{imageops, DynamicImage, GenericImage};

pub(super) fn flip(mut source: DynamicImage, horizontal: bool, vertical: bool) -> DynamicImage {
    match &mut source {
        DynamicImage::ImageLuma8(pixels) => flip_pixels(pixels, horizontal, vertical),
        DynamicImage::ImageLumaA8(pixels) => flip_pixels(pixels, horizontal, vertical),
        DynamicImage::ImageRgb8(pixels) => flip_pixels(pixels, horizontal, vertical),
        DynamicImage::ImageRgba8(pixels) => flip_pixels(pixels, horizontal, vertical),
        DynamicImage::ImageLuma16(pixels) => flip_pixels(pixels, horizontal, vertical),
        DynamicImage::ImageLumaA16(pixels) => flip_pixels(pixels, horizontal, vertical),
        DynamicImage::ImageRgb16(pixels) => flip_pixels(pixels, horizontal, vertical),
        DynamicImage::ImageRgba16(pixels) => flip_pixels(pixels, horizontal, vertical),
        DynamicImage::ImageRgb32F(pixels) => flip_pixels(pixels, horizontal, vertical),
        DynamicImage::ImageRgba32F(pixels) => flip_pixels(pixels, horizontal, vertical),
        _ => {
            if horizontal {
                source = source.fliph();
            }
            if vertical {
                source = source.flipv();
            }
        }
    }
    source
}

fn flip_pixels<I: GenericImage>(pixels: &mut I, horizontal: bool, vertical: bool) {
    if horizontal {
        imageops::flip_horizontal_in_place(pixels);
    }
    if vertical {
        imageops::flip_vertical_in_place(pixels);
    }
}
