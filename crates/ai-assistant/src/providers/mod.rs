//! AI Provider implementations
//!
//! This module contains the trait definition and implementations for various AI providers.

pub mod anthropic;
mod traits;

pub use traits::{AIProvider, AIRequest, AIResponse};

