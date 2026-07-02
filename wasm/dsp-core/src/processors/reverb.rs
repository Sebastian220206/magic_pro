use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct Reverb {
    delay_line: Vec<f32>,
    write_pos: usize,
    decay: f32,
    sample_rate: f32,
    damping: f32,
    damp_factor: f32,
}

#[wasm_bindgen]
impl Reverb {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Reverb {
        Reverb {
            delay_line: vec![0.0; 48000],
            write_pos: 0,
            decay: 0.5,
            sample_rate: 44100.0,
            damping: 0.5,
            damp_factor: 0.0,
        }
    }

    pub fn set_decay(&mut self, decay: f32) {
        self.decay = decay.clamp(0.0, 0.99);
    }

    pub fn set_damping(&mut self, damping: f32) {
        self.damping = damping.clamp(0.0, 1.0);
    }

    pub fn set_room_size(&mut self, size: f32) {
        let delay_samples = (size.clamp(0.0, 1.0) * 0.1 * self.sample_rate) as usize;
        self.delay_line = vec![0.0; delay_samples.max(256)];
        self.write_pos = 0;
    }

    pub fn process_block(&mut self, input: &[f32], output: &mut [f32]) {
        for i in 0..input.len() {
            let x = input[i];
            let delay_len = self.delay_line.len();
            if delay_len == 0 { output[i] = x; continue; }

            let read_pos = (self.write_pos + 1) % delay_len;
            let wet = self.delay_line[read_pos];

            self.damp_factor = self.damping * self.damp_factor + (1.0 - self.damping) * wet;

            self.delay_line[self.write_pos] = x + self.damp_factor * self.decay;
            self.write_pos = (self.write_pos + 1) % delay_len;

            output[i] = x + wet * 0.3;
        }
    }
}
