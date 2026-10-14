use super::ImageError;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};

/// A per-application admission gate. The permit must live inside the blocking job.
#[derive(Clone, Default)]
pub struct ImageWorkGate(Arc<AtomicBool>);

pub struct ImageWorkPermit(Arc<AtomicBool>);

impl ImageWorkGate {
    pub fn try_acquire(&self) -> Result<ImageWorkPermit, ImageError> {
        self.0
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .map_err(|_| ImageError::Busy)?;
        Ok(ImageWorkPermit(self.0.clone()))
    }
}

impl Drop for ImageWorkPermit {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
    }
}
