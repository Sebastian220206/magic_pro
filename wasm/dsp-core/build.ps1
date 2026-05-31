# Build script for Magic Pro WASM DSP Core
Write-Host "Building WASM DSP Core for Magic Pro..."

# Ensure we are in the correct directory
Set-Location -Path $PSScriptRoot

# Requires wasm-pack to be installed
# cargo install wasm-pack

# Build the release binary targeting web
wasm-pack build --target web --release --out-dir ../../public/wasm/dsp-core

Write-Host "Build complete! WASM binaries deposited in public/wasm/dsp-core/"
