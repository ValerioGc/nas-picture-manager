use image::{imageops, RgbaImage};

pub(super) fn sharpen(pixels: &mut RgbaImage, sharpness: u8) {
    if sharpness == 0 {
        return;
    }
    let amount = f32::from(sharpness) / 50.0;
    // image 0.25 uses a five-tap Gaussian kernel for sigma 1. Preserve its two-row halo.
    // Keep original halo rows before editing, rather than cloning the full image.
    const HALO: u32 = 2;
    const STRIP_ROWS: usize = 128;
    let (width, height) = pixels.dimensions();
    let stride = width as usize * 4;
    let mut previous = Vec::new();
    for y in (0..height).step_by(STRIP_ROWS) {
        let start = y.saturating_sub(HALO);
        let bottom = (y + STRIP_ROWS as u32).min(height);
        let end = (bottom + HALO).min(height);
        let mut strip = imageops::crop_imm(pixels, 0, start, width, end - start).to_image();
        if !previous.is_empty() {
            strip.as_mut()[..previous.len()].copy_from_slice(&previous);
        }
        previous.clear();
        if bottom < height {
            previous.extend_from_slice(
                &pixels.as_raw()[(bottom - HALO) as usize * stride..bottom as usize * stride],
            );
        }
        let blurred = imageops::blur(&strip, 1.0);
        let offset = (y - start) as usize * stride;
        let length = (bottom - y) as usize * stride;
        let output = &mut pixels.as_mut()[y as usize * stride..bottom as usize * stride];
        for (pixel, blur) in output.as_chunks_mut::<4>().0.iter_mut().zip(
            blurred.as_raw()[offset..offset + length]
                .as_chunks::<4>()
                .0
                .iter(),
        ) {
            for (channel, softened) in pixel[..3].iter_mut().zip(&blur[..3]) {
                *channel = (f32::from(*channel)
                    + amount * (f32::from(*channel) - f32::from(*softened)))
                .round()
                .clamp(0.0, 255.0) as u8;
            }
        }
    }
}
