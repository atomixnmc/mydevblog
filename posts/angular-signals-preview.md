# Angular Signals Preview

Angular 16 introduced developer preview of signals—a new reactive primitive that brings fine-grained reactivity to Angular applications. Signals represent a fundamental shift from Zone.js-based change detection to explicit, granular state tracking. This is the most important architectural change to Angular since Ivy, and it positions the framework for a future without Zone.js entirely.

## What Are Signals?

A signal is a wrapper around a value that notifies consumers when the value changes:

```typescript
const count = signal(0);
count.set(5); // update
const value = count(); // read
```

Unlike a plain variable, a signal tracks who reads it. When you call `count()` inside a reactive context (like a template or a `computed`), the signal registers that context as a dependent. When `count.set(5)` is called, the signal notifies all its dependents that they need to recompute.

The `signal()` function creates a writable signal. The setter (`count.set(5)`) replaces the value. The getter (`count()`) reads the value and registers the calling context as a consumer.

```typescript
// Writable signal with object value
const user = signal({
  name: 'Alice',
  email: 'alice@example.com',
  preferences: { theme: 'dark' }
});

// Replace entire value
user.set({ name: 'Bob', email: 'bob@example.com', preferences: { theme: 'light' } });

// Partial update with update function
user.update(prev => ({ ...prev, name: 'Charlie' }));
```

Signals also support equality checking. If you set a signal to the same value it already has, consumers are NOT notified:

```typescript
const count = signal(0);
count.set(0); // No notification - value hasn't changed
count.set(1); // Notification - value changed
count.set(1); // No notification - value is the same as before
```

This default equality check (using `===`) prevents unnecessary updates when the value hasn't conceptually changed.

## Computed Signals: Derived State

`computed` signals derive values from other signals. They're lazy—they only recompute when read and their dependencies change:

```typescript
const doubled = computed(() => count() * 2);
```

Computed signals are the equivalent of Solid's `createMemo` or React's `useMemo`. They cache their value and only recompute when their dependencies change. But unlike `useMemo`, they don't need a dependency array—dependencies are tracked automatically.

```typescript
const firstName = signal('Alice');
const lastName = signal('Smith');

// Computed signal - auto-tracks firstName and lastName
const fullName = computed(() => `${firstName()} ${lastName()}`);

// fullName() returns 'Alice Smith' without recomputing
console.log(fullName()); // 'Alice Smith'

// Change one dependency
firstName.set('Bob');

// fullName is now dirty but NOT yet recomputed (lazy)
// Only when fullName() is read does it recompute:
console.log(fullName()); // 'Bob Smith' - recomputed on read
```

This lazy evaluation is important for performance. In a component template, a computed signal is only recomputed when the template renders. If the component is off-screen or inside a `@if` block that isn't displayed, the computed doesn't run.

Computed signals can be chained. Each computed caches its value, so intermediate computations don't repeat:

```typescript
const items = signal([...]);
const activeItems = computed(() => items().filter(item => item.active));
const activeCount = computed(() => activeItems().length);

// activeCount depends on activeItems, which depends on items
// items -> activeItems -> activeCount
// If items changes but activeItems doesn't (filter produces same result),
// activeCount doesn't recompute
```

## Effects: Side Effects for Signals

Effects run side effects when signal dependencies change. Unlike computed signals, effects execute immediately and run on every dependency change:

```typescript
effect(() => console.log(`Count: ${count()}`));
```

Effects are the bridge between signals and the outside world. They're used for logging, persisting data to localStorage, synchronizing with external APIs, and (under the hood) updating the DOM.

```typescript
const theme = signal(localStorage.getItem('theme') || 'light');

// Persist theme changes to localStorage
effect(() => {
  localStorage.setItem('theme', theme());
  console.log(`Theme saved: ${theme()}`);
});

// The effect runs once when created (to initialize)
// Then re-runs every time theme() changes
```

Effects have an important lifecycle. They run during Angular's change detection cycle, before the DOM is updated. This ensures that the side effect sees the latest state but can't cause visual inconsistencies.

```typescript
effect(() => {
  const currentCount = count();
  
  // Cleanup function - runs before the effect re-runs or when the
  // owning component is destroyed
  onCleanup(() => {
    console.log('Cleaning up previous effect');
  });
  
  console.log(`Effect running with count: ${currentCount}`);
});
```

The `onCleanup` function inside an effect registers a cleanup callback. This is useful for canceling previous operations before starting new ones:

```typescript
const searchQuery = signal('');

effect(() => {
  const query = searchQuery();
  const abortController = new AbortController();

  // Cancel previous request
  onCleanup(() => abortController.abort());

  fetch(`/api/search?q=${query}`, {
    signal: abortController.signal
  }).then(response => {
    // Handle search results
  }).catch(err => {
    if (err.name !== 'AbortError') {
      console.error('Search failed:', err);
    }
  });
});
```

## Signals vs. Zone.js Change Detection

The impact on change detection is significant. Zone.js monkey-patches browser APIs to detect state changes, then runs change detection on the entire component tree. Signals know exactly which parts of the template depend on which state. When a signal changes, Angular can update only the specific DOM nodes affected.

```typescript
// Zone.js approach: every async operation triggers full tree check
@Component({
  template: `
    <div>
      <p>Count: {{ count }}</p>   <!-- Updated on every async operation -->
      <p>Name: {{ name }}</p>     <!-- Updated on every async operation -->
      <p>Items: {{ items.length }}</p>  <!-- Updated on every async operation -->
    </div>
  `
})
export class MyComponent {
  count = 0;
  name = 'Alice';
  items = [];

  ngOnInit() {
    setInterval(() => {
      this.count++; // Triggers change detection on entire tree
    }, 1000);
  }
}
```

In the Zone.js approach, `setInterval` causes Angular to run change detection on every component in the tree, checking every binding. The dirty checking is fast (Angular uses `dirty` flags), but it still requires walking the tree.

```typescript
// Signal approach: only affected nodes update
@Component({
  template: `
    <div>
      <p>Count: {{ count() }}</p>   <!-- Only this updates -->
      <p>Name: {{ name() }}</p>     <!-- Not this -->
      <p>Items: {{ items().length }}</p>  <!-- Not this -->
    </div>
  `
})
export class MyComponent {
  count = signal(0);
  name = signal('Alice');
  items = signal([]);

  ngOnInit() {
    setInterval(() => {
      this.count.update(c => c + 1); // Only the count binding updates
    }, 1000);
  }
}
```

With signals, Angular compiles the template to track which DOM nodes depend on which signals. When `count.update(...)` fires, Angular only checks the specific binding `{{ count() }}` and updates its corresponding DOM node. The `name` and `items` bindings are untouched.

This is the future of Angular change detection: from "check everything" to "check only what changed."

## Template Integration

Angular's template compiler integrates with signals. In templates, signals are called as functions: `{{ count() }}`. The compiler recognizes signal reads and creates efficient update instructions:

```html
<h1>{{ title() }}</h1>
<button (click)="increment()">Clicked {{ count() }} times</button>
```

The compiler generates code that subscribes to each signal read in the template. When a signal changes, only the specific DOM nodes for that signal update. This eliminates the need for `ChangeDetectionStrategy.OnPush`—signals naturally provide push-based updates.

With the new control flow syntax, signals integrate even more tightly:

```html
@if (isLoggedIn()) {
  <app-user-profile [user]="user()" />
} @else {
  <app-login-form />
}

@for (item of items(); track item.id) {
  <li>{{ item.name }}</li>
}

@switch (status()) {
  @case ('loading') { <spinner /> }
  @case ('error') { <error-message /> }
  @default { <data-view /> }
}
```

The `@if`, `@for`, and `@switch` blocks are part of Angular's new built-in control flow. They have native awareness of signals—when `isLoggedIn()` changes, the `@if` block renders or removes its content without unnecessary change detection on the non-displayed branch.

## RxJS Interop

The `@angular/rxjs-interop` package provides bridges between signals and RxJS Observables:

```typescript
import { toSignal, toObservable } from '@angular/core/rxjs-interop';

// Observable -> Signal
const mySignal = toSignal(myObservable$, { initialValue: 0 });

// Signal -> Observable
const myObservable$ = toObservable(mySignal);
```

`toSignal` subscribes to an Observable and returns a signal that updates whenever the Observable emits. The Observable is subscribed when the signal is created and unsubscribed when the component is destroyed:

```typescript
@Component({
  template: `{{ count() }}`,
})
export class MyComponent {
  private http = inject(HttpClient);

  // Observable from HTTP request -> Signal
  data = toSignal(this.http.get('/api/data'), { initialValue: null });

  // Timer Observable -> Signal
  tick = toSignal(interval(1000), { initialValue: 0 });
}
```

`toObservable` creates an Observable that emits whenever a signal's value changes. This is useful when integrating signal-based state with RxJS-based libraries:

```typescript
const searchQuery = signal('');
const searchResults = signal([]);

// React to search query changes with debounce
const search$ = toObservable(searchQuery).pipe(
  debounceTime(300),
  distinctUntilChanged(),
  switchMap(query => this.http.get(`/api/search?q=${query}`))
);

// Subscribe and update signal
search$.subscribe(results => searchResults.set(results));
```

## The Migration Path

Migration from Zone.js reactivity is incremental. Components can mix signals and traditional `@Input`/`@Output` patterns:

```typescript
export class HybridComponent {
  // Traditional input
  @Input() userName: string = '';

  // Signal-based state
  private counter = signal(0);
  readonly count = this.counter.asReadonly();

  // Mixed: signal updated from traditional input change
  ngOnChanges(changes: SimpleChanges) {
    if (changes['userName']) {
      this.counter.set(0); // Reset counter when user changes
    }
  }
}
```

A full migration to signals involves:

1. Converting `@Input()` properties to input signals (future Angular version)
2. Replacing component state with `signal()` and `computed()`
3. Replacing `ngOnChanges` with `effect()` where appropriate
4. Optionally disabling Zone.js for the application

The Angular team is working toward a "Zone.js optional" mode where applications that use signals everywhere can disable Zone.js entirely. This would eliminate the overhead of Zone.js's monkey-patching and provide predictable change detection behavior.

## Conclusion

Signals also integrate with the new control flow syntax (`@if`, `@for`, `@switch`), which has built-in awareness of signal-based reactivity. This combination positions Angular for better runtime performance, especially in complex, data-heavy applications. The transition from "check everything" to "check only what changed" mirrors the evolution React made with Fiber and SolidJS made with signals. Angular is late to this party, but the implementation is thoughtful and the migration is pragmatic. For existing Angular applications, the path is incremental: adopt signals piece by piece, see the performance improvements, and eventually consider disabling Zone.js entirely. For new Angular applications, signals should be the default choice for state management from day one.
