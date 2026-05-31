pub struct Compressor {
    threshold: f32,
    ratio: f32,
    attack: f32,
    release: f32,
    envelope: f32,
}

impl Compressor {
    pub fn new() -> Self {
        Compressor {
            threshold: -20.0,
            ratio: 4.0,
            attack: 0.005,
            release: 0.100,
            envelope: 0.0,
        }
    }

    pub fn process(&mut self, input: f32, sample_rate: f32) -> f32 {
        let attack_coeff = (-1.0 / (self.attack * sample_rate)).exp();
        let release_coeff = (-1.0 / (self.release * sample_rate)).exp();

        let level = input.abs();
        
        let coeff = if level > self.envelope { attack_coeff } else { release_coeff };
        self.envelope = coeff * self.envelope + (1.0 - coeff) * level;

        let env_db = 20.0 * self.envelope.log10().max(-100.0);
        
        let gain_db = if env_db > self.threshold {
            (self.threshold - env_db) * (1.0 - 1.0 / self.ratio)
        } else {
            0.0
        };

        let gain = 10.0f32.powf(gain_db / 20.0);
        input * gain
    }
}
