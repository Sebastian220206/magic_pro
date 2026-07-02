use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct Delay {
    buffer: Vec<f32>,
    write_pos: usize,
    delay_samples: usize,
    feedback: f32,
    mix: f32,
    sample_rate: f32,
}

#[wasm_bindgen]
impl Delay {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Delay {
        Delay {
            buffer: vec![0.0; 44100],
            write_pos: 0,
            delay_samples: 22050,
            feedback: 0.3,
            mix: 0.5,
            sample_rate: 44100.0,
        }
    }

    pub fn set_time_ms(&mut self, ms: f32) {
        self.delay_samples = ((ms / 1000.0) * self.sample_rate) as usize;
        if self.delay_samples < 1 { self.delay_samples = 1; }
        if self.delay_samples > self.buffer.len() {
            self.buffer = vec![0.0; self.delay_samples];
        }
    }

    pub fn set_tempo_sync(&mut self, beats: f32, tempo: f32) {
        let ms = (beats / tempo) * 60.0 * 1000.0;
        self.set_time_ms(ms);
    }

    pub fn set_feedback(&mut self, feedback: f32) {
        self.feedback = feedback.clamp(0.0, 0.99);
    }

    pub fn set_mix(&mut self, mix: f32) {
        self.mix = mix.clamp(0.0, 1.0);
    }

    pub fn process_block(&mut self, input: &[f32], output: &mut [f32]) {
        let buf_len = self.buffer.len();

        for i in 0..input.len() {
            let x = input[i];
            let read_pos = (self.write_pos + buf_len - self.delay_samples) % buf_len;
            let delayed = self.buffer[read_pos];

            self.buffer[self.write_pos] = x + delayed * self.feedback;
            self.write_pos = (self.write_pos + 1) % buf_len;

            output[i] = x * (1.0 - self.mix) + delayed * self.mix;
        }
    }
}
