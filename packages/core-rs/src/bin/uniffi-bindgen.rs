//! Binding generator.
//!
//! UniFFI's proc-macro mode needs a small binary to drive generation. `build.sh`
//! invokes it to emit the Swift and Kotlin bindings that the app and the widget
//! targets consume.
//!
//! Output lands in `bindings/`, which is COMMITTED and drift-checked in CI —
//! the native targets build without the JS toolchain. See ADR-0014.

fn main() {
    uniffi::uniffi_bindgen_main();
}
