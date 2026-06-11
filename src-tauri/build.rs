fn main() {
    // tauri-build embeds the Windows app icon but does NOT track the icon file,
    // so icon-only edits were silently ignored (stale .res reused on relink).
    // Track it explicitly so the resource is re-embedded when the icon changes.
    println!("cargo:rerun-if-changed=icons/icon.ico");
    tauri_build::build()
}
