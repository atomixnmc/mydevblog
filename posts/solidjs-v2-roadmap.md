# SolidJS 2.0 Roadmap: What's Coming

SolidJS 2.0 is in active development, building on the fine-grained reactivity foundation of Solid 1.x while addressing ecosystem maturity, server-side rendering, and developer tooling. The roadmap reveals a framework maturing from innovative upstart to production workhorse.

**Reactivity improvements**: Solid 2.0 will introduce `Signal` and `Effect` as first-class primitives (capitalized), alongside the current lowercase `createSignal` and `createEffect` functions. This provides a more natural API for reactive declarations. The reactive system gains batch tracking improvements, reducing edge cases where tracking could miss changes during synchronous signal updates within effects. The `untrack` function becomes more intuitive with syntax sugar for isolating reactive dependencies.

**SolidStart maturity**: The meta-framework (Solid's equivalent of Next.js) is the primary focus. SolidStart 2.0 promises full support for streaming server-side rendering, where Suspense boundaries stream in as server data resolves. Route definitions become file-based with a refined API matching patterns from Remix and Next.js App Router. Server actions—calling database mutations directly from browser form submissions—are built into the routing layer.

**Performance benchmarks**: Solid 1.x already leads JavaScript frameworks in most benchmarks (js-framework-benchmark). Solid 2.0 targets zero-incremental-bundle-size for server-rendered pages. Since server components compile to HTML streams and never ship their JavaScript unless they contain interactive islands, a marketing page with Solid could ship zero framework JavaScript to the browser.

**DevTools and debugging**: The Solid DevTools browser extension gets deep integration with 2.0's reactive system. Developers will see signal dependency graphs live, track which signals trigger which renders (DOM updates), and inspect the reactive graph's current values. Signal breakpoints pause execution when a signal changes, making reactive debugging as straightforward as imperative debugging.

**Ecosystem standardization**: Solid 2.0 will formalize patterns around resource management (data fetching), transitions, and error boundaries that emerged organically in 1.x. The `@solidjs/router` and `@solidjs/meta` packages will be first-party and shipped alongside the core.

The migration from 1.x will be incremental—the core reactive primitives remain, with additions rather than deprecations. Solid 2.0 is less a rewrite and more a completion of the vision Solid 1.x started.
