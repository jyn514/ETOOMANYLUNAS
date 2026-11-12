use std::hint::black_box;

#[inline(always)]
fn borrowing_sub(lhs: u64, rhs: u64, borrow: u64) -> (u64, u64) {
    let d = lhs.wrapping_sub(rhs).wrapping_sub(borrow >> 63);
    let b = ((!lhs & rhs) | ((!lhs | rhs) & d)) >> 63;
    (d, black_box(b).wrapping_neg())
}

#[inline(always)]
fn select(a: u64, b: u64, c: u8) -> u64 {
    let m = (black_box(c) as u64).wrapping_neg();
    a ^ (m & (a ^ b))
}

#[inline(never)]
pub fn f(x: [u64; 4], y: [u64; 4], hi: u64, c: u8) -> ([u64; 4], u64) {
    let mut s = [0u64; 4];
    let mut borrow = 0;
    for i in 0..4 {
        (s[i], borrow) = borrowing_sub(x[i], y[i], borrow);
    }
    let mut n = [0u64; 4];
    let mut carry = 1u128;
    for i in 0..4 {
        let t = (!s[i]) as u128 + carry;
        n[i] = t as u64;
        carry = t >> 64;
    }
    let hi_n = (!hi).wrapping_add(carry as u64);
    let mut r = [0u64; 4];
    for i in 0..4 {
        r[i] = select(s[i], n[i], c);
    }
    (r, select(hi, hi_n, c))
}

fn main() {
    let r = f(black_box([1, 2, 3, 4]), black_box([5, 6, 7, 8]), black_box(0), black_box(1));
    println!("{r:?}");
}
