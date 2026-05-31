use wasm_bindgen::prelude::*;

pub mod processors;


#[wasm_bindgen]
pub fn process_gain(
    input: &[f32],
    output: &mut [f32],
    gain: f32
) {
    // In a real SIMD implementation we would use core::arch::wasm32::*
    // but for the foundation we implement the standard iterator map
    for i in 0..input.len() {
        output[i] = input[i] * gain;
    }
}

#[wasm_bindgen]
pub fn process_mix(
    input_a: &[f32],
    input_b: &[f32],
    output: &mut [f32]
) {
    for i in 0..output.len() {
        output[i] = input_a[i] + input_b[i];
    }
}
