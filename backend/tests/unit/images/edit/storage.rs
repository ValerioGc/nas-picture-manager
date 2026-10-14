use crate::images::{save_copy, ImageError};
use std::fs;

#[test]
fn saves_a_copy_preserves_the_original_and_removes_failed_temporary_files() {
    let directory =
        std::env::temp_dir().join(format!("picture-manager-storage-{}", std::process::id()));
    fs::create_dir_all(&directory).unwrap();
    let original = directory.join("original.png");
    let output = directory.join("output.png");
    fs::write(&original, b"original").unwrap();

    assert_eq!(
        save_copy(&original, b"changed", Some(&original)),
        Err(ImageError::OverwriteOriginal)
    );
    save_copy(&output, b"edited", Some(&original)).unwrap();
    assert_eq!(fs::read(&original).unwrap(), b"original");
    assert_eq!(fs::read(&output).unwrap(), b"edited");
    assert!(save_copy(&directory, b"bad", Some(&original)).is_err());
    assert!(!fs::read_dir(&directory).unwrap().any(|entry| entry
        .unwrap()
        .file_name()
        .to_string_lossy()
        .ends_with(".tmp")));
    fs::remove_dir_all(directory).unwrap();
}
