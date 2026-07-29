# Angular v16 Signals: A New Reactivity Model

Angular 16 introduced signals—a primitive for reactive state management that fundamentally changes how Angular applications handle change detection and data flow. Signals represent the most significant shift in Angular's internals since Ivy.

**What are signals?** A signal is a reactive wrapper around a value: `const count = signal(0)`. Reading the signal returns the current value: `count()`. Updating: `count.set(5)` or `count.update(c => c + 1)`. The critical innovation is automatic dependency tracking: when a signal is read during template rendering, Angular records the dependency. When the signal changes, Angular knows exactly which components and templates depend on it and can update only them.

**Computed signals** derive values from other signals: `const doubled = computed(() => count() * 2)`. Computeds are lazy and memoized—they only recompute when their dependencies change and only when the computed value is read. This eliminates the wasted computation of pipes and memoized selectors that recalculate on every change detection cycle. Computed signals also form a reactive graph that Angular can analyze for efficient updates.

**Effects** execute side effects when signal dependencies change: `effect(() => console.log(count()))`. Unlike computed signals, effects don't return a value—they run arbitrary code. Effects are automatically cleaned up when the component is destroyed. They replace many use cases of `ngOnChanges` and `ngDoCheck`, simplifying lifecycle management.

**Signals vs Zone.js**: Angular's traditional change detection relies on Zone.js patching browser APIs (setTimeout, addEventListener, fetch) to detect when state might have changed, then running change detection on the entire component tree. Signals eliminate this guesswork—Angular knows exactly what changed and which components to check. This enables "zoneless" Angular applications where change detection runs precisely when and where needed.

**Signal-based components**: The `OnPush` change detection strategy becomes the default for signal-based components. Templates in `@Component` decorators can use signals directly. Angular's compiler understands signal reads in templates and generates optimized update code that skips the zone entirely. Inputs can also be signals: `@Input() count: Signal<number>`.

**Migration path**: Signals in v16 are additive and optional. Existing Zone.js-based components continue working. Angular provides `toSignal` (convert Observable to Signal) and `toObservable` (Signal to Observable) bridges. The recommended migration: introduce signals for new features, convert reactive Observable-heavy components incrementally.

Signals don't replace NgRx or other state management—they provide the primitive that external libraries can build on. Angular's reactivity model is evolving from "starve the zone" to "ignore the zone entirely."
