use crate::images::{ImageError, ImageWorkGate};

#[test]
fn clones_share_admission_and_drop_releases_it() {
    let gate = ImageWorkGate::default();
    let clone = gate.clone();
    let permit = gate.try_acquire().unwrap();
    assert!(matches!(clone.try_acquire(), Err(ImageError::Busy)));
    drop(permit);
    assert!(clone.try_acquire().is_ok());
    assert!(gate.try_acquire().is_ok());
}
