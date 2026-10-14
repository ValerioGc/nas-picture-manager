use super::flip::flip;
use image::DynamicImage;

pub(super) fn rotate(source: DynamicImage, quarter_turns: u8) -> DynamicImage {
    match quarter_turns {
        1 => source.rotate90(),
        2 => flip(source, true, true),
        3 => source.rotate270(),
        _ => source,
    }
}
