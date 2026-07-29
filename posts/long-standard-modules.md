# Long Standard Modules

Long ships a standard library of modules available from all supported languages. These modules implement common functionality — HTTP, JSON, crypto, filesystem — with a unified API that looks natural in each language.

## Module System

Standard modules are written in Rust and exposed through FFI to JavaScript and Python:

```rust
// Implementation in Rust
#[long::module]
mod http {
    pub async fn fetch(url: &str, options: RequestOptions) -> Response {
        let client = reqwest::Client::new();
        let resp = client.get(url).send().await.unwrap();
        Response {
            status: resp.status().as_u16(),
            body: resp.bytes().await.unwrap().to_vec(),
        }
    }
}
```

This module is callable from JavaScript:

```javascript
import { http } from 'long:std';

const resp = await http.fetch('https://api.example.com/data');
console.log(resp.status, resp.body);
```

And from Python:

```python
from long.std import http

resp = await http.fetch('https://api.example.com/data')
print(resp.status)
```

The same Rust implementation serves both languages. The module API layer handles the type conversion — JavaScript `number` ↔ Rust `u16`, Python `bytes` ↔ Rust `Vec<u8>`, and async unwrapping on both sides.

## Module Catalog

| Module | API | Backend |
|---|---|---|
| `http` | fetch, Request, Response | reqwest |
| `json` | parse, stringify, StreamingParser | simd-json |
| `crypto` | hash, sign, verify, encrypt, decrypt | ring |
| `fs` | read, write, readDir, watch, access | tokio::fs |
| `path` | join, resolve, dirname, basename | std::path |
| `time` | now, sleep, Instant, Duration | chrono + tokio |
| `compress` | gzip, deflate, zstd | zstd + flate2 |
| `uuid` | v4, v7, parse, format | uuid |
| `log` | info, warn, error, StructuredLogger | tracing |
| `sql` | query, execute, Transaction | sqlx (Postgres/MySQL/SQLite) |

The `sql` module is notable — it exposes SQL query execution with result streaming. The return type is an async iterable. In JavaScript, you iterate with `for await`. In Python, `async for`. In Rust, `.await.map()`. The same query runs across all three languages:

```javascript
// JavaScript
for await (const row of sql.query("SELECT * FROM users WHERE age > $1", [25])) {
    console.log(row.name);
}
```

## Module Resolution

Modules are resolved by name. Names starting with `long:` are standard modules. Names starting with `./` or `../` are file-relative. Names without a prefix are npm packages (JS) or PyPI packages (Python).

```
long:std/http       → Standard library module
./utils.js          → Local file (JS)
./analysis.py       → Local file (Python)
lodash              → npm package (resolved by Long's npm resolver)
numpy               → PyPI package (Long's subset — only pure Python packages)
```

Long's npm resolver works like Node.js — reads `package.json`, follows `node_modules` resolution. The PyPI resolver only supports pure Python packages (no C extensions) because of the CPython subset constraints. We maintain a compatibility list: pandas, numpy, scipy, and scikit-learn are not supported in the WASM build (C extensions). NetworkX, httpx, and pydantic are supported.

## Async Integration

Async functions in any language integrate with Long's tokio event loop:

```javascript
import { http, time } from 'long:std';

async function demo() {
    const start = time.now();
    const resp = await http.fetch('https://api.example.com/users');
    const users = await json.parse(resp.body);
    const elapsed = start.elapsed();
    console.log(`Fetched ${users.length} users in ${elapsed}ms`);
}
```

The `time.now()` returns an `Instant` (monotonic clock), not a wall clock. `start.elapsed()` returns a `Duration`. The API is identical in all three languages because it maps to the same Rust types. The only difference is syntax — `.elapsed()` in JS and Rust, `.elapsed` (property) in Python.

Standard modules are the primary way Long applications interact with the outside world. The module system ensures that polyglot applications don't need polyglot dependencies — one HTTP client (reqwest), one JSON parser (simd-json), one crypto library (ring), shared by all languages.