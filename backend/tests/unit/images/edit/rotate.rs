use super::fixtures::edited;
use crate::images::ImageEdits;

#[test]
fn rotates_clockwise_by_quarter_turns_without_losing_pixels() {
    for (rotation, dimensions, first) in [
        (0, (3, 2), 40),
        (1, (2, 3), 100),
        (2, (3, 2), 140),
        (3, (2, 3), 80),
    ] {
        let output = edited(ImageEdits {
            rotation,
            ..Default::default()
        });
        assert_eq!(output.dimensions(), dimensions);
        assert_eq!(output.get_pixel(0, 0)[0], first);
        assert!(output.pixels().all(|pixel| pixel[3] == 64));
    }
}
