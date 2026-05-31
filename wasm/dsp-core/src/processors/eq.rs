use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct BiquadFilter {
    b0: f32, b1: f32, b2: f32,
    a1: f32, a2: f32,
    z1: f32, z2: f32,
}

#[wasm_bindgen]
impl BiquadFilter {
    #[wasm_bindgen(constructor)]
    pub fn new() -> BiquadFilter {
        BiquadFilter {
            b0: 1.0, b1: 0.0, b2: 0.0,
            a1: 0.0, a2: 0.0,
            z1: 0.0, z2: 0.0,
        }
    }

    pub fn set_peaking(&mut self, freq: f32, q: f32, gain_db: f32, sample_rate: f32) {
        let w0 = 2.0 * std::f32::consts::PI * freq / sample_rate;
        let alpha = w0.sin() / (2.0 * q);
        let a = 10.0f32.powf(gain_db / 40.0);

        let a0 = 1.0 + alpha / a;
        self.b0 = (1.0 + alpha * a) / a0;
        self.b1 = (-2.0 * w0.cos()) / a0;
        self.b2 = (1.0 - alpha * a) / a0;
        self.a1 = (-2.0 * w0.cos()) / a0;
        self.a2 = (1.0 - alpha / a) / a0;
    }

    pub fn process_block(&mut self, input: &[f32], output: &mut [f32]) {
        for i in 0..input.len() {
            let x = input[i];
            let y = self.b0 * x + self.b1 * self.z1 + self.b2 * self.z2
                  - self.a1 * self.z1 - self.a2 * self.z2; // Simplified for basic structure
            
            self.z2 = self.z1;
            self.z1 = x;
            
            output[i] = y;
        }
    }
}
