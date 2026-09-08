# UniFFI uses JNA reflection to map these names/fields to the Rust shared library.
-keep class uniffi.loro_core.** { *; }
-keep class com.sun.jna.** { *; }
-dontwarn java.awt.**
