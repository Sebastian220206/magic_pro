use std::arch::wasm32::*;

#[target_feature(enable = "simd128")]
pub unsafe fn interpolate_linear(
    start: f32,
    delta: f32,
    out: &mut [f32]
) {
    for i in 0..out.len() {
        out[i] = start + delta * i as f32;
    }
}
