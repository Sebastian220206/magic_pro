use wasm_bindgen::prelude::*;
use std::f32::consts::PI;

#[wasm_bindgen]
pub struct Chorus {
    delay_line: Vec<f32>,
    write_pos: usize,
    depth: f32,
    rate: f32,
    mix: f32,
    phase: f32,
    sample_rate: f32,
}

#[wasm_bindgen]
impl Chorus {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Chorus {
        Chorus {
            delay_line: vec![0.0; 44100],
            write_pos: 0,
            depth: 0.003,
            rate: 0.5,
            mix: 0.5,
            phase: 0.0,
            sample_rate: 44100.0,
        }
    }

    pub fn set_depth(&mut self, depth: f32) {
        self.depth = depth.clamp(0.0, 0.01);
    }

    pub fn set_rate(&mut self, rate: f32) {
        self.rate = rate.clamp(0.1, 10.0);
    }

    pub fn set_mix(&mut self, mix: f32) {
        self.mix = mix.clamp(0.0, 1.0);
    }

    pub fn process_block(&mut self, input: &[f32], output: &mut [f32]) {
        let buf_len = self.delay_line.len();

        for i in 0..input.len() {
            let x = input[i];

            // Modulated delay with LFO
            self.phase += 2.0 * PI * self.rate / self.sample_rate;
            if self.phase > 2.0 * PI { self.phase -= 2.0 * PI; }

            let modulation = (self.phase.sin() * self.depth * self.sample_rate) as i32;
            let delay_samples = (self.depth * self.sample_rate) as i32 + modulation;
            let read_pos = (self.write_pos as i32 - delay_samples).rem_euclid(buf_len as i32) as usize;

            let delayed = self.delay_line[read_pos];

            self.delay_line[self.write_pos] = x;
            self.write_pos = (self.write_pos + 1) % buf_len;

            output[i] = x * (1.0 - self.mix) + delayed * self.mix;
        }
    }
}
