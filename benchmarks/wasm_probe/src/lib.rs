use std::alloc::{alloc, dealloc, Layout};
use std::slice;

#[unsafe(no_mangle)]
pub extern "C" fn wasm_alloc(size: usize) -> *mut u8 {
    let layout = Layout::from_size_align(size, 8).unwrap();
    unsafe { alloc(layout) }
}

#[unsafe(no_mangle)]
pub extern "C" fn wasm_dealloc(ptr: *mut u8, size: usize) {
    let layout = Layout::from_size_align(size, 8).unwrap();
    unsafe { dealloc(ptr, layout) }
}

/// Measures purely memory transfer & UTF-8 validation across FFI boundary
#[unsafe(no_mangle)]
pub extern "C" fn boundary_memory_ping_pong(
    ptr_a: *const u8,
    len_a: usize,
    ptr_b: *const u8,
    len_b: usize,
) -> usize {
    let slice_a = unsafe { slice::from_raw_parts(ptr_a, len_a) };
    let slice_b = unsafe { slice::from_raw_parts(ptr_b, len_b) };
    slice_a.len() + slice_b.len()
}

/// Simple Myers diff on byte slices in Rust
#[unsafe(no_mangle)]
pub extern "C" fn rust_diff_bytes(
    ptr_a: *const u8,
    len_a: usize,
    ptr_b: *const u8,
    len_b: usize,
) -> usize {
    let a = unsafe { slice::from_raw_parts(ptr_a, len_a) };
    let b = unsafe { slice::from_raw_parts(ptr_b, len_b) };

    // Strip common prefix & suffix
    let mut prefix = 0;
    while prefix < a.len() && prefix < b.len() && a[prefix] == b[prefix] {
        prefix += 1;
    }

    let mut suffix = 0;
    while suffix < (a.len() - prefix) && suffix < (b.len() - prefix) && a[a.len() - 1 - suffix] == b[b.len() - 1 - suffix] {
        suffix += 1;
    }

    let sub_a = &a[prefix..a.len() - suffix];
    let sub_b = &b[prefix..b.len() - suffix];

    let n = sub_a.len();
    let m = sub_b.len();
    if n == 0 {
        return m;
    }
    if m == 0 {
        return n;
    }

    let max = n + m;
    let offset = max;
    let mut v = vec![0usize; 2 * max + 1];

    for d in 0..=max {
        for k in (-(d as isize)..=(d as isize)).step_by(2) {
            let k_idx = (k + offset as isize) as usize;
            let mut x = if k == -(d as isize) || (k != d as isize && v[k_idx - 1] < v[k_idx + 1]) {
                v[k_idx + 1]
            } else {
                v[k_idx - 1] + 1
            };
            let mut y = (x as isize - k) as usize;
            while x < n && y < m && sub_a[x] == sub_b[y] {
                x += 1;
                y += 1;
            }
            v[k_idx] = x;
            if x >= n && y >= m {
                return d;
            }
        }
    }

    max
}
