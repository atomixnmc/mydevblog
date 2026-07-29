# Long Polyglot Frontends

Long's polyglot runtime isn't just for backends — it runs polyglot frontends too. A single page can serve JavaScript, Python, and Rust code that interacts with the DOM and each other in real time.

## Frontend Architecture

Long runs in the browser via WASM. The runtime (Boa JS + CPython subset + Wasmtime) compiles to WebAssembly and runs in a web worker. A thin bridge layer connects the worker to the DOM:

```
┌──────────────────────────┐
│       Browser DOM        │
└──────────┬───────────────┘
           │ events / DOM ops
┌──────────▼───────────────┐
│     Web Worker (Long)     │
│ ┌──────┬──────┬────────┐ │
│ │ JS   │ Py   │ Rust   │ │
│ └──────┴──────┴────────┘ │
└──────────────────────────┘
```

## Cross-Language Frontend Code

A frontend component can mix languages:

```javascript
// Component definition — JavaScript
import { python } from 'long:python';
import { Component, html } from 'long:dom';

// Python handles data processing
const processor = await python.run(`
def process_data(items):
    return [x ** 2 for x in items if x > 0]
`);

// Rust handles heavy computation
const compute = await import('long:rust');
const stats = compute.statistics(dataset);

// Component renders with both
function Dashboard() {
    const data = [1, 2, 3, -1, 4, 5];
    const processed = processor(data);
    return html`
        <div class="dashboard">
            <h1>Dashboard</h1>
            <p>Processed: ${processed.join(', ')}</p>
            <p>Stats: mean=${stats.mean}</p>
        </div>
    `;
}
```

## Python in the Browser

Running Python in the browser via Long is different from Pyodide. Long's CPython subset is compiled to WASM alongside the JS engine, sharing the same WASM linear memory:

```python
# Python — runs in browser via Long
from long.dom import document, window

def handle_click(event):
    element = document.getElementById("result")
    element.textContent = f"Clicked at ({event.clientX}, {event.clientY})"

button = document.getElementById("myButton")
button.addEventListener("click", handle_click)
```

DOM access is proxied through a JavaScript bridge. Python objects that represent DOM elements are JavaScript proxies. The round-trip from Python to DOM through the proxy adds about 1μs per call.

## Rust in the Browser

Rust code compiled to WASM runs through Wasmtime embedded in Long's WASM build:

```rust
#[long::export]
fn fibonacci(n: u32) -> u64 {
    match n {
        0 => 0,
        1 => 1,
        _ => fibonacci(n - 1) + fibonacci(n - 2),
    }
}
```

```javascript
import { rust } from 'long:rust';
console.log(rust.fibonacci(40)); // 102334155 — computed in WASM
```

The Rust-to-JS call overhead through Long is about 100ns. The Python-to-Rust path adds about 500ns due to the Python→JS→Rust indirection.

## Use Cases

**Interactive data visualization**: Python processes and analyzes data (pandas subset), Rust computes layout (force-directed graph), JavaScript renders to Canvas/WebGL. Each language handles what it's best at without serialization.

**AI-assisted UI**: Python runs a small ONNX model for real-time classification (sentiment, intent), Rust processes the model output, JavaScript updates the UI. All in the browser, no server calls.

**Live coding environments**: A note-taking app where users can write Python cells, JavaScript cells, and Rust cells that share variables through Long's shared memory. It's like Observable but with multiple languages in the same notebook.

## Limitations

- WASM builds don't support the full CPython API — the subset covers common operations but excludes most C extension modules
- Rust compilation to WASM requires targeting `wasm32-wasi` and may need code changes for browser-specific APIs
- DOM event handling from Python is functional but not idiomatic — callbacks are proxied through JavaScript, losing Python's context manager patterns

Long polyglot frontends are experimental but functional. For data-heavy applications where Python's analysis libraries and Rust's performance are both valuable, Long eliminates the server round-trip for computation. Instead of sending data to a Python server and waiting for a response, you run Python and Rust in the browser alongside your JavaScript UI code. The WASM binary is large (8MB compressed, 24MB uncompressed), but the zero-copy data sharing between languages makes cross-language integration seamless in ways that separate WASM modules can't match.