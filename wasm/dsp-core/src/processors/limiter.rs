use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct Limiter {
    threshold: f32,
    attack: f32,
    release: f32,
    envelope: f32,
    gain_reduction: f32,
    sample_rate: f32,
}

#[wasm_bindgen]
impl Limiter {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Limiter {
        Limiter {
            threshold: -1.0,
            attack: 0.002,
            release: 0.050,
            envelope: 0.0,
            gain_reduction: 1.0,
            sample_rate: 44100.0,
        }
    }

    pub fn set_threshold(&mut self, db: f32) {
        self.threshold = db.clamp(-30.0, 0.0);
    }

    pub fn set_attack(&mut self, attack: f32) {
        self.attack = attack.clamp(0.0001, 0.1);
    }

    pub fn set_release(&mut self, release: f32) {
        self.release = release.clamp(0.001, 1.0);
    }

    pub fn get_gain_reduction(&self) -> f32 {
        self.gain_reduction
    }

    pub fn process_block(&mut self, input: &[f32], output: &mut [f32]) {
        let threshold_linear = 10.0f32.powf(self.threshold / 20.0);
        let attack_coeff = (-1.0 / (self.attack * self.sample_rate)).exp();
        let release_coeff = (-1.0 / (self.release * self.sample_rate)).exp();

        for i in 0..input.len() {
            let x = input[i];
            let abs_x = x.abs();

            if abs_x > self.envelope {
                self.envelope = attack_coeff * self.envelope + (1.0 - attack_coeff) * abs_x;
            } else {
                self.envelope = release_coeff * self.envelope + (1.0 - release_coeff) * abs_x;
            }

            if self.envelope > threshold_linear {
                self.gain_reduction = threshold_linear / self.envelope;
            } else {
                self.gain_reduction = 1.0;
            }

            output[i] = x * self.gain_reduction;
        }
    }
}
