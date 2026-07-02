use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct DeEsser {
    threshold: f32,
    ratio: f32,
    sidechain_hpf: f32,
    sample_rate: f32,
    envelope: f32,
    prev_x: f32,
    prev_hpf: f32,
}

#[wasm_bindgen]
impl DeEsser {
    #[wasm_bindgen(constructor)]
    pub fn new() -> DeEsser {
        DeEsser {
            threshold: -20.0,
            ratio: 4.0,
            sidechain_hpf: 4000.0,
            sample_rate: 44100.0,
            envelope: 0.0,
            prev_x: 0.0,
            prev_hpf: 0.0,
        }
    }

    pub fn set_threshold(&mut self, db: f32) {
        self.threshold = db.clamp(-40.0, 0.0);
    }

    pub fn set_ratio(&mut self, ratio: f32) {
        self.ratio = ratio.clamp(1.0, 20.0);
    }

    pub fn set_frequency(&mut self, freq: f32) {
        self.sidechain_hpf = freq.clamp(2000.0, 8000.0);
    }

    pub fn process_block(&mut self, input: &[f32], output: &mut [f32]) {
        let attack_coeff = (-1.0 / (0.001 * self.sample_rate)).exp();
        let release_coeff = (-1.0 / (0.050 * self.sample_rate)).exp();

        let rc = 1.0 / (2.0 * std::f32::consts::PI * self.sidechain_hpf);
        let dt = 1.0 / self.sample_rate;
        let alpha = dt / (rc + dt);

        for i in 0..input.len() {
            let x = input[i];

            let hpf_out = alpha * (self.prev_hpf + x - self.prev_x);
            self.prev_x = x;
            self.prev_hpf = hpf_out;

            let sibilant_level = hpf_out.abs();
            let coeff = if sibilant_level > self.envelope { attack_coeff } else { release_coeff };
            self.envelope = coeff * self.envelope + (1.0 - coeff) * sibilant_level;

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
