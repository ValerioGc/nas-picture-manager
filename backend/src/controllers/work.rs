use super::error::ImageApiError;
use crate::images::{decode_bytes, DecodedImage, ImageError, ImageWorkGate, ImageWorkPermit};
use axum::{
    body::{Body, Bytes},
    extract::{FromRequest, Request, State},
    middleware::Next,
    response::Response,
};
use http_body_util::BodyExt;
use std::{
    sync::{Arc, Mutex},
    time::Duration,
};

const MAX_CACHE_BYTES: usize = 256 * 1024 * 1024;

#[derive(Default)]
pub(super) struct ImageWorker {
    gate: ImageWorkGate,
    cache: Mutex<Option<(Bytes, DecodedImage)>>,
}

impl ImageWorker {
    pub fn decode(&self, bytes: Bytes) -> Result<DecodedImage, ImageError> {
        {
            let mut cache = self.cache.lock().map_err(|_| ImageError::Unavailable)?;
            if let Some((_, image)) = cache.as_ref().filter(|(original, _)| *original == bytes) {
                return Ok(image.clone());
            }
            // Evict before decoding another image, avoiding two retained full-size sources.
            *cache = None;
        }
        let decoded = decode_bytes("image", &bytes)?;
        if decoded.memory_bytes() <= MAX_CACHE_BYTES {
            *self.cache.lock().map_err(|_| ImageError::Unavailable)? =
                Some((bytes, decoded.clone()));
        }
        Ok(decoded)
    }

    pub fn take_decoded(&self, bytes: Bytes) -> Result<DecodedImage, ImageError> {
        let cached = self
            .cache
            .lock()
            .map_err(|_| ImageError::Unavailable)?
            .take();
        if let Some((original, image)) = cached {
            if original == bytes {
                return Ok(image);
            }
        }
        decode_bytes("image", &bytes)
    }
}

/// Reject incompatible uploads and excess jobs before buffering their request bodies.
pub(super) async fn admit(
    State(worker): State<Arc<ImageWorker>>,
    mut request: Request,
    next: Next,
) -> Result<Response, ImageApiError> {
    if request
        .headers()
        .get("sec-fetch-site")
        .is_some_and(|value| value == "cross-site")
    {
        return Err(ImageError::InvalidInput.into());
    }
    let content_type = request
        .headers()
        .get("content-type")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split(';').next());
    if content_type.is_none_or(|value| {
        !value
            .trim()
            .eq_ignore_ascii_case("application/octet-stream")
    }) {
        return Err(ImageError::InvalidInput.into());
    }
    let permit = Arc::new(worker.gate.try_acquire()?);
    request.extensions_mut().insert(permit.clone());
    let response = next.run(request).await;
    let (parts, body) = response.into_parts();
    // Keep output buffers within the same admission budget until consumed or dropped.
    let body = body.map_frame(move |frame| {
        let _permit = &permit;
        frame
    });
    Ok(Response::from_parts(parts, Body::new(body)))
}

pub(super) struct ImageBody(pub Bytes);

impl<S: Send + Sync> FromRequest<S> for ImageBody {
    type Rejection = ImageApiError;

    async fn from_request(request: Request<Body>, state: &S) -> Result<Self, Self::Rejection> {
        let bytes =
            tokio::time::timeout(Duration::from_secs(30), Bytes::from_request(request, state))
                .await
                .map_err(|_| ImageError::Unavailable)??;
        Ok(Self(bytes))
    }
}

pub(super) type WorkPermit = Arc<ImageWorkPermit>;
