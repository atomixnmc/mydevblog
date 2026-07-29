# Long Native Capability

Long's native module system lets you write Rust code that's callable from JavaScript and Python without wrapping FFI. The `#[long::export]` attribute exposes Rust functions to the polyglot runtime with automatic type marshaling.

## The Macro

```rust
use long::prelude::*;

#[long::export]
fn fibonacci(n: u64) -> u64 {
    match n {
        0 => 0,
        1 => 1,
        _ => fibonacci(n - 1) + fibonacci(n - 2),
    }
}

#[long::export]
fn analyze_text(text: &str, options: TextOptions) -> Analysis {
    let word_count = text.split_whitespace().count();
    let char_count = text.chars().count();
    let avg_word_len = if word_count > 0 {
        char_count as f64 / word_count as f64
    } else {
        0.0
    };
    Analysis {
        word_count,
        char_count,
        avg_word_len,
        sentiment: estimate_sentiment(text),
    }
}

#[derive(LongExport)]
struct TextOptions {
    case_sensitive: bool,
    max_length: Option<usize>,
}

#[derive(LongExport)]
struct Analysis {
    word_count: usize,
    char_count: usize,
    avg_word_len: f64,
    sentiment: f64,
}
```

## Calling from JavaScript

```javascript
import { fibonacci, analyzeText } from 'long:native';
// or from a compiled .long file

console.log(fibonacci(40)); // 102334155

const analysis = analyzeText("Hello world!", {
    case_sensitive: true,
});
console.log(analysis.word_count); // 2
```

The `#[long::export]` macro generates bindings for both languages. For JavaScript, it creates a typed wrapper (the function signature is reflected). For Python, it creates a Python-callable function with keyword argument support.

## Async Support

```rust
#[long::export]
async fn fetch_data(url: String) -> Result<Response, FetchError> {
    let client = reqwest::Client::new();
    let resp = client.get(&url).send().await.map_err(|e| {
        FetchError { message: e.to_string() }
    })?;
    Ok(Response {
        status: resp.status().as_u16(),
        body: resp.bytes().await.unwrap().to_vec(),
    })
}
```

```javascript
const data = await fetchData("https://api.example.com/data");
```

Long's event loop integrates with tokio. Async Rust functions are scheduled on the tokio runtime and return promises to JavaScript (or awaitables to Python). The async boundary is zero-cost — no additional threads or synchronization needed because Long and tokio share the same thread pool.

## Memory Ownership

Rust functions receive owned values, not references. The `#[long::export]` macro handles type conversion at the boundary:

```rust
#[long::export]
fn process_buffer(data: Vec<u8>) -> Vec<u8> {
    // data is an owned Vec — no lifetime issues
    data.iter().map(|b| b ^ 0xFF).collect()
}
```

JavaScript passes an `ArrayBuffer` or `Uint8Array` → Rust receives `Vec<u8>`. The data is copied across the boundary. For zero-copy, use `#[long::export(zero_copy)]` which passes a `&[u8]` slice — but the caller must hold the buffer alive until the function returns:

```rust
#[long::export(zero_copy)]
fn compute_checksum(data: &[u8]) -> u32 {
    data.iter().fold(0u32, |acc, b| acc.wrapping_add(*b as u32))
}
```

Zero-copy is faster for large buffers (saves the allocation + copy) but requires the caller to keep the buffer alive. We use zero-copy for image processing pipelines where 4K frames (8MB each) are processed at 60 FPS — saving the copy saves ~500MB/s of memory bandwidth.

## Compilation

Native modules are compiled with `long build`:

```bash
long build --source rust_ops.rs --output rust_ops.long
```

The output is a `.long` file containing the compiled WASM module (for browser targets) or native shared library (for desktop targets). The `.long` file is imported like any other module:

```javascript
import { fibonacci } from './rust_ops.long';
```

The build process compiles Rust to WASM (for WASM targets) or to a cdylib (for native targets). Long selects the appropriate binary at runtime. For development, native compilation is faster (debug builds in <1s). For deployment, WASM provides sandboxing and cross-platform compatibility. The trade-off: WASM adds ~20% overhead for numeric code and disables SIMD on some platforms.