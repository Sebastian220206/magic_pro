// Memory utilities for bridging zero-copy Float32Arrays

pub fn alloc_buffer(size: usize) -> *mut f32 {
    let mut buf = Vec::with_capacity(size);
    let ptr = buf.as_mut_ptr();
    std::mem::forget(buf);
    ptr
}

pub fn free_buffer(ptr: *mut f32, size: usize) {
    unsafe {
        let _buf = Vec::from_raw_parts(ptr, 0, size);
    }
}
