use std::arch::wasm32::*;

#[target_feature(enable = "simd128")]
pub unsafe fn multiply_buffers(
    a: &[f32],
    b: &[f32],
    out: &mut [f32]
) {
    let mut i = 0;

    // Process 4 floats at a time (128-bit SIMD)
    while i + 4 <= a.len() {

        let va = v128_load(a.as_ptr().add(i) as *const v128);
        let vb = v128_load(b.as_ptr().add(i) as *const v128);

        let result = f32x4_mul(va, vb);

        v128_store(out.as_mut_ptr().add(i) as *mut v128, result);

        i += 4;
    }

    // Handle tail
    while i < a.len() {
        out[i] = a[i] * b[i];
        i += 1;
    }
}
