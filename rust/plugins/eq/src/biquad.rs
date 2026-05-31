pub struct Biquad {
    z1: f32,
    z2: f32,

    b0: f32,
    b1: f32,
    b2: f32,

    a1: f32,
    a2: f32,
}

impl Biquad {
    pub fn new() -> Self {
        Biquad {
            z1: 0.0, z2: 0.0,
            b0: 1.0, b1: 0.0, b2: 0.0,
            a1: 0.0, a2: 0.0,
        }
    }

    pub fn process(&mut self, input: f32) -> f32 {
        let out = input * self.b0 + self.z1;

        self.z1 = input * self.b1 + self.z2 - self.a1 * out;
        self.z2 = input * self.b2 - self.a2 * out;

        out
    }
}
