use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct DynamicsCompressor {
    threshold: f32,
    ratio: f32,
    attack: f32,
    release: f32,
    envelope: f32,
}

#[wasm_bindgen]
impl DynamicsCompressor {
    #[wasm_bindgen(constructor)]
    pub fn new() -> DynamicsCompressor {
        DynamicsCompressor {
            threshold: -24.0,
            ratio: 4.0,
            attack: 0.003,
            release: 0.250,
            envelope: 0.0,
        }
    }

    pub fn set_params(&mut self, threshold: f32, ratio: f32, attack: f32, release: f32) {
        self.threshold = threshold;
        self.ratio = ratio;
        self.attack = attack;
        self.release = release;
    }

    pub fn process_block(&mut self, input: &[f32], output: &mut [f32], sample_rate: f32) {
        let attack_coeff = (-1.0 / (self.attack * sample_rate)).exp();
        let release_coeff = (-1.0 / (self.release * sample_rate)).exp();

        for i in 0..input.len() {
            let x = input[i];
            let level = x.abs();
            
            let coeff = if level > self.envelope { attack_coeff } else { release_coeff };
            self.envelope = coeff * self.envelope + (1.0 - coeff) * level;

            let env_db = 20.0 * self.envelope.log10().max(-100.0);
            
            let gain_db = if env_db > self.threshold {
                (self.threshold - env_db) * (1.0 - 1.0 / self.ratio)
            } else {
                0.0
            };

            let gain = 10.0f32.powf(gain_db / 20.0);
            output[i] = x * gain;
        }
    }
}
