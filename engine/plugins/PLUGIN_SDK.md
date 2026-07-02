# Magic Pro Plugin SDK

## Overview

Magic Pro supports third-party audio plugins via a **manifest-driven sandbox** system. Plugins can be:

- **Native WASM DSP** — compiled Rust/C WASM modules that process audio in real time
- **React UI Components** — registered in the `UIRegistry` for built-in/custom UIs
- **IFrame-hosted UIs** — fully isolated third-party plugin UIs rendered in sandboxed iframes

---

## Plugin Manifest

Every plugin has a JSON manifest that describes its identity, parameters, audio I/O, and UI:

```json
{
  "manifestVersion": 1,
  "id": "com.example.myplugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "author": "Your Name",
  "description": "A warm analog-style saturator",
  "type": "effect",
  "category": "distortion",
  "parameters": [
    {
      "id": "drive",
      "name": "Drive",
      "type": "float",
      "defaultValue": 0.5,
      "minValue": 0,
      "maxValue": 1,
      "step": 0.05,
      "unit": "",
      "automatable": true
    },
    {
      "id": "mix",
      "name": "Mix",
      "type": "float",
      "defaultValue": 1,
      "minValue": 0,
      "maxValue": 1,
      "step": 0.05,
      "automatable": true
    }
  ],
  "audioIO": {
    "numInputs": 2,
    "numOutputs": 2,
    "supportsMidi": false
  },
  "wasmUrl": "/plugins/myplugin.wasm",
  "ui": {
    "url": "/plugins/myplugin-ui/index.html",
    "width": 400,
    "height": 300
  }
}
```

### Manifest Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `manifestVersion` | number | yes | Current version: `1` |
| `id` | string | yes | Unique plugin ID (reverse domain recommended) |
| `name` | string | yes | Human-readable name |
| `version` | string | yes | Semver version string |
| `author` | string | no | Creator name |
| `description` | string | no | Short description |
| `type` | "effect" \| "instrument" | yes | Plugin type |
| `category` | string | yes | e.g. "eq", "dynamics", "reverb", "distortion", "modulation", "filter" |
| `parameters` | array | yes | See Parameter Definition below |
| `audioIO` | object | yes | See Audio IO below |
| `wasmUrl` | string | no | URL to compiled WASM binary |
| `ui` | object | no | UI configuration (see UI Section below) |

### Parameter Definition

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | Parameter identifier (used in param changes) |
| `name` | string | yes | Display name |
| `type` | "float" \| "int" \| "boolean" \| "enum" | yes | Value type |
| `defaultValue` | number | yes | Default/initial value |
| `minValue` | number | no | Minimum value (for float/int) |
| `maxValue` | number | no | Maximum value (for float/int) |
| `step` | number | no | Step increment (for float/int sliders) |
| `unit` | string | no | Display unit (e.g. "dB", "Hz", "ms") |
| `automatable` | boolean | yes | Whether this param can be automated |
| `enumValues` | string[] | no | Labels for enum type (indexed by value) |

### Audio IO

```json
{
  "numInputs": 2,
  "numOutputs": 2,
  "supportsMidi": false
}
```

---

## Loading a Plugin

Register a plugin from a manifest URL:

```typescript
import { PluginRegistry } from '@/engine/plugins/PluginRegistry';

const def = await PluginRegistry.loadFromManifest('/plugins/myplugin/manifest.json');
// Plugin is now registered and available in the UI
```

For built-in plugins, use `registerBuiltinPlugins()` which initializes the registry with all first-party plugins:

```typescript
import { registerBuiltinPlugins } from '@/engine/plugins/registerBuiltins';
registerBuiltinPlugins();
```

---

## WASM Plugin API

WASM plugins must export the following functions (via `wasm-bindgen` or manual exports):

```rust
#[wasm_bindgen]
pub fn initialize(sample_rate: f32);

#[wasm_bindgen]
pub fn process_block();

#[wasm_bindgen]
pub fn dispose();
```

The process function operates on global state set via JS before calling `process_block`. For full control, implement the `PluginAPI` TypeScript interface:

```typescript
interface PluginAPI {
  initialize(sampleRate: number): void;
  process(input: Float32Array[], output: Float32Array[], params: Record<string, number>): void;
  dispose(): void;
}
```

---

## UI Integration

### Option 1: React Component (Built-in Only)

Register a React component for your plugin's UI:

```typescript
import { registerPluginUI } from '@/engine/plugins/UIRegistry';

registerPluginUI('com.example.myplugin', MyPluginComponent, {
  width: 400,
  height: 300,
});
```

The component receives the `PluginUIContract` interface:

```typescript
interface PluginUIContract {
  trackId: string;
  pluginId: string;
  manifest: PluginManifest;
  params: Record<string, number>;
  onParamChange: (paramId: string, value: number) => void;
  onPresetLoad?: (presetId: string) => void;
}
```

### Option 2: IFrame UI (Third-Party)

Set `ui.url` in the manifest to point to an HTML page hosted on any origin. The iframe receives messages via `postMessage`:

**Init message:**
```json
{
  "type": "init",
  "contract": { "trackId": "...", "pluginId": "...", "manifest": {...}, "params": {...} }
}
```

**Param update message:**
```json
{
  "type": "params_update",
  "params": { "drive": 0.7, "mix": 0.5 }
}
```

**Send param changes back to host:**
```json
{
  "type": "param_change",
  "paramId": "drive",
  "value": 0.7
}
```

The iframe must use `window.parent.postMessage()` to communicate changes.

### Option 3: Auto-generated UI

If no UI is registered, the system generates a default parameter UI from the manifest with sliders, checkboxes, and dropdowns matching each parameter's type.

---

## Plugin Sandbox

WASM plugins run inside a `PluginSandbox` that manages the WASM module lifecycle:

```typescript
import { PluginSandbox } from '@/engine/plugins/sandbox';

const sandbox = new PluginSandbox({
  manifest: myManifest,
  wasmUrl: '/plugins/myplugin.wasm',
  sampleRate: 48000,
});

await sandbox.load();
sandbox.connectWorklet(audioContext);
sandbox.processBlock(inputs, outputs, params);
sandbox.dispose();
```

Third-party iframe UIs run in sandboxed iframes with `sandbox="allow-scripts allow-same-origin"` for isolation.

---

## Example: Building a Simple Gain Plugin

### 1. WASM (Rust)

```rust
use wasm_bindgen::prelude::*;

static mut GAIN: f32 = 1.0;
static mut INPUT_PTR: *mut f32 = std::ptr::null_mut();
static mut OUTPUT_PTR: *mut f32 = std::ptr::null_mut();
static mut BLOCK_SIZE: usize = 0;

#[wasm_bindgen]
pub fn initialize(sample_rate: f32) {}

#[wasm_bindgen]
pub fn set_gain(gain: f32) {
    unsafe { GAIN = gain; }
}

#[wasm_bindgen]
pub fn set_buffers(input: *mut f32, output: *mut f32, len: usize) {
    unsafe {
        INPUT_PTR = input;
        OUTPUT_PTR = output;
        BLOCK_SIZE = len;
    }
}

#[wasm_bindgen]
pub fn process_block() {
    unsafe {
        for i in 0..BLOCK_SIZE {
            *OUTPUT_PTR.add(i) = *INPUT_PTR.add(i) * GAIN;
        }
    }
}

#[wasm_bindgen]
pub fn dispose() {}
```

### 2. Manifest

```json
{
  "manifestVersion": 1,
  "id": "com.example.simple-gain",
  "name": "Simple Gain",
  "version": "1.0.0",
  "type": "effect",
  "category": "utility",
  "parameters": [
    {
      "id": "gain",
      "name": "Gain",
      "type": "float",
      "defaultValue": 1.0,
      "minValue": 0.0,
      "maxValue": 2.0,
      "step": 0.05,
      "automatable": true
    }
  ],
  "audioIO": { "numInputs": 2, "numOutputs": 2, "supportsMidi": false },
  "wasmUrl": "/plugins/simple-gain.wasm"
}
```

### 3. Load & Register

```typescript
await PluginRegistry.loadFromManifest('/plugins/simple-gain/manifest.json');
```

---

## Plugin Categories

Categories are freeform strings. Recommended values:

| Category | Description |
|---|---|
| `eq` | Equalizers (parametric, graphic, shelving) |
| `dynamics` | Compressors, limiters, gates, expanders |
| `reverb` | Algorithmic and convolution reverb |
| `delay` | Delay, echo, ping-pong |
| `distortion` | Saturation, overdrive, fuzz, amp sims |
| `modulation` | Chorus, flanger, phaser, tremolo, vibrato |
| `filter` | Filters (not EQ): resonant, formant, comb |
| `utility` | Gain, utility, metering, routing |
| `synth` | Synthesizers (instrument type) |
| `sampler` | Samplers (instrument type) |
| `drum` | Drum machines (instrument type) |
| `midi` | MIDI effects (arpeggiator, chord trigger) |

---

## API Reference

### `engine/plugins/manifest.ts`

| Export | Type/Function | Description |
|---|---|---|
| `PluginParameter` | interface | Parameter definition |
| `PluginManifest` | interface | Full plugin manifest |
| `PluginUIContract` | interface | UI component props contract |
| `validateManifest()` | function | Validates a raw manifest object |
| `generateDefaultParams()` | function | Creates initial param values from manifest |

### `engine/plugins/PluginRegistry.ts`

| Method | Description |
|---|---|
| `initialize()` | Register built-in plugins (EQ, Compressor) |
| `register(def)` | Register a plugin definition |
| `get(id)` | Get a plugin definition by ID |
| `getAll()` | Get all registered plugins |
| `loadFromManifest(url)` | Load and register a plugin from a JSON manifest URL |
| `registerDescriptor(id, desc)` | Register a full plugin descriptor with manifest |

### `engine/plugins/UIRegistry.ts`

| Method | Description |
|---|---|
| `registerPluginUI(id, component)` | Register a React component for a plugin UI |
| `registerPluginIframeUI(id, url)` | Register an iframe URL for a plugin UI |
| `getPluginUI(id)` | Get UI registration for a plugin |
| `unregisterPluginUI(id)` | Remove a UI registration |

### `engine/plugins/sandbox.ts`

| Class | Description |
|---|---|
| `PluginSandbox` | WASM plugin lifecycle manager (load, worklet, process, dispose) |
| `IFramePluginSandbox` | IFrame plugin host (mount, message, unmount) |

---

## Version History

- **1.0.0** — Initial SDK release. Manifest v1, WASM + IFrame + React UI support.
