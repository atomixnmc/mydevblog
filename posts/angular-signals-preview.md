# Angular Signals Preview

Angular 16 introduced developer preview of signals — a new reactive primitive that brings fine-grained reactivity to Angular applications. Signals represent a fundamental shift from Zone.js-based change detection to explicit, granular state tracking.

A signal is a wrapper around a value that notifies consumers when the value changes:

```typescript
const count = signal(0);
count.set(5); // update
const value = count(); // read
```

Computed signals derive values from other signals. They're lazy — they only recompute when read and their dependencies change:

```typescript
const doubled = computed(() => count() * 2);
```

Effects run side effects when signal dependencies change. Unlike computed signals, effects execute immediately and run on every dependency change:

```typescript
effect(() => console.log(`Count: ${count()}`));
```

The impact on change detection is significant. Zone.js monkey-patches browser APIs to detect state changes, then runs change detection on the entire component tree. Signals know exactly which parts of the template depend on which state. When a signal changes, Angular can update only the specific DOM nodes affected.

Angular's template compiler integrates with signals. In templates, signals are called as functions: `{{ count() }}`. The compiler recognizes signal reads and creates efficient update instructions. This eliminates the need for `ChangeDetectionStrategy.OnPush` — signals naturally provide push-based updates.

Migration from Zone.js reactivity is incremental. Components can mix signals and traditional `@Input`/`@Output` patterns. Libraries like `@angular/rxjs-interop` bridge RxJS Observables and signals with `toSignal()` and `toObservable()`.

Signals also integrate with the new control flow syntax (`@if`, `@for`, `@switch`), which has built-in awareness of signal-based reactivity. This combination positions Angular for better runtime performance, especially in complex, data-heavy applications.
