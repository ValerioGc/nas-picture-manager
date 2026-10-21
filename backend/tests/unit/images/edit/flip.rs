use super::fixtures::edited;
use crate::images::ImageEdits;

#[test]
fn flips_each_axis_and_their_combination() {
    for (flip_horizontal, flip_vertical, first) in
        [(true, false, 80), (false, true, 100), (true, true, 140)]
    {
        let output = edited(ImageEdits {
            flip_horizontal,
            flip_vertical,
            ..Default::default()
        });
        assert_eq!(output.dimensions(), (3, 2));
        assert_eq!(output.get_pixel(0, 0)[0], first);
    }
}
