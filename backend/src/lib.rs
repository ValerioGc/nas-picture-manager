pub mod controllers;
pub mod routes;

pub use routes::{build_router, build_router_with_ui, ApiError, Health};

pub mod images;

#[cfg(test)]
#[path = "../tests/unit/images.rs"]
mod tests;
