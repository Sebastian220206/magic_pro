use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct Saturation {
    drive: f32,
    mix: f32,
    output_gain: f32,
}

#[wasm_bindgen]
impl Saturation {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Saturation {
        Saturation {
            drive: 1.0,
            mix: 1.0,
            output_gain: 1.0,
        }
    }

    pub fn set_drive(&mut self, drive: f32) {
        self.drive = drive.clamp(0.0, 10.0);
    }

    pub fn set_mix(&mut self, mix: f32) {
        self.mix = mix.clamp(0.0, 1.0);
    }

    pub fn set_output_gain(&mut self, gain: f32) {
        self.output_gain = gain.clamp(0.0, 2.0);
    }

    pub fn process_block(&mut self, input: &[f32], output: &mut [f32]) {
        for i in 0..input.len() {
            let x = input[i] * self.drive;

            // Soft clipping (tanh approximation)
            let abs_x = x.abs();
            let saturated = if abs_x < 1.0 {
                x * (2.0 - abs_x)
            } else {
                x / abs_x * 2.0
            };

            output[i] = (input[i] * (1.0 - self.mix) + saturated * self.mix) * self.output_gain;
        }
    }
}
