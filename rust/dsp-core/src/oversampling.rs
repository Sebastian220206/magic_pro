// Scaffold for oversampling engine (polyphase FIR filters, etc)
pub struct Oversampler {
    factor: usize,
}

impl Oversampler {
    pub fn new(factor: usize) -> Self {
        Oversampler { factor }
    }
}
