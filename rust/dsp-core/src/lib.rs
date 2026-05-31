use wasm_bindgen::prelude::*;

pub mod simd;
pub mod memory;
pub mod parameters;
pub mod oversampling;
pub mod fft;

#[wasm_bindgen]
pub struct DSPKernel {
    sample_rate: f32,
}

#[wasm_bindgen]
impl DSPKernel {

    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: f32) -> DSPKernel {
        DSPKernel {
            sample_rate
        }
    }

    #[wasm_bindgen]
    pub fn process(
        &mut self,
        input_ptr: *const f32,
        output_ptr: *mut f32,
        frames: usize
    ) {
        unsafe {
            let input = std::slice::from_raw_parts(input_ptr, frames);
            let output = std::slice::from_raw_parts_mut(output_ptr, frames);

            // Passthrough for base kernel
            for i in 0..frames {
                output[i] = input[i];
            }
        }
    }
}
