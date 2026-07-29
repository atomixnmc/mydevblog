# React Native: Understanding the Bridge Architecture

React Native promised "learn once, write anywhere" by letting JavaScript drive native UI components. The architecture that makes this work—the **bridge**—is the key to understanding RN's performance characteristics, its limitations with synchronous APIs, and why the new architecture (JSI/Fabric) exists. After building several production React Native apps, I can tell you that understanding the bridge is essential to avoiding the performance pitfalls that catch most developers off guard.

## The Three Threads

React Native runs on three asynchronous threads. Understanding these threads is the foundation for understanding RN performance.

**JavaScript thread.** This runs your React code—components, state management, business logic, and the React reconciler. This is a single thread (JavaScript is single-threaded), so any heavy computation here blocks UI updates.

**Native thread (Main/UI thread).** This runs the actual platform UI (UIView on iOS, android.view on Android). This thread handles touch events, scroll gestures, and rendering. Blocking this thread for even 16ms causes visible frame drops.

**Shadow thread.** This runs Yoga, the flexbox layout engine. Yoga computes the positions and sizes of all elements based on the style tree. The shadow thread sends the computed layout to the native thread, which applies it.

```
Communication flow:

JS Thread                    Shadow Thread              Native/UI Thread
   |                              |                           |
   |-- create view #42, set ----->|                           |
   |   styles: {left: 100}        |-- compute layout ------->|-- update UIView
   |                              |   (Yoga)                 |   frame 42
   |<-- batch complete -----------|                           |
   |                              |                           |
   |-- dispatch touch event ----->|                           |
   |                              |                           |-- receive touch
   |<-- touch result -------------|                           |
```

## The Bridge: Serialized Communication

The bridge is an asynchronous, serialised, batched communication channel between the JavaScript thread and the native thread. When your JS calls `<View style={{left: 100}} />`, it serialises a JSON-like message: "create view #42, set property 'left' to 100". The native thread deserialises it and updates the actual `UIView` or `android.view.View`. Responses flow back the same way, which is why you can't return a native object from `NativeModules`—everything crosses the bridge as serialised data.

```js
// This JS call crosses the bridge as JSON
NativeModules.MyModule.doSomething("hello", (result) => {
  // Callback also crosses the bridge
  console.log("Native replied:", result);
});
```

The serialisation format is a batched message queue. React Native collects all bridge calls during a single JavaScript frame (16ms) and sends them to the native side as one batch:

```json
// What crosses the bridge (simplified)
[
  { "type": 1, "module": "UIManager", "method": "createView", "args": [42, "RCTView", null, {"left": 100}] },
  { "type": 2, "module": "UIManager", "method": "setChildren", "args": [42, [1, 2, 3]] },
  { "type": 3, "module": "NativeModules", "method": "MyModule.doSomething", "args": ["hello", 0] }
]
```

Each message includes a module ID, method ID, and serialised arguments. The native side maps these IDs to actual native module implementations. This indirection allows the bridge to be fully asynchronous—the JS thread doesn't wait for a response, and the native thread processes the queue at its leisure.

The batching is crucial for performance. Without it, every single `setState` call or style change would trigger a separate native UI update. With batching, React Native collects all mutations from a single render cycle and sends them as one batch, reducing the overhead of crossing the bridge.

## The Shadow Thread: Layout Computation

The **shadow thread** is the unsung hero. Layout calculations—Yoga flexbox computations—run here, off the JS and UI threads. The shadow tree computes positions, then sends pixel-perfect frame data to the native side in one batched update. This prevents layout thrash and keeps the UI thread focused on rendering.

```js
// JS creates a tree of styled elements
<View style={{ flex: 1, flexDirection: 'row' }}>
  <View style={{ flex: 1, backgroundColor: 'red' }} />
  <View style={{ flex: 2, backgroundColor: 'blue' }} />
</View>

// Shadow thread receives this as:
// { type: 'RCTView', props: { flex: 1, flexDirection: 'row', children: [
//   { type: 'RCTView', props: { flex: 1, backgroundColor: 'red' } },
//   { type: 'RCTView', props: { flex: 2, backgroundColor: 'blue' } }
// ]}}

// Yoga computes:
// Parent: { left: 0, top: 0, width: 375, height: 800 }
// Child 1: { left: 0, top: 0, width: 125, height: 800 }
// Child 2: { left: 125, top: 0, width: 250, height: 800 }
```

The shadow tree is a virtual representation of the UI tree, just like React's virtual DOM. But instead of being used for diffing, it's used for layout computation. The shadow thread maintains its own tree of "shadow nodes," each representing a native view with its style properties but no actual rendering.

The critical insight: the shadow tree runs Yoga synchronously on its own thread. If layout computation takes 10ms, it blocks the shadow thread but not the JS or UI threads. The UI thread continues rendering at 60fps, and the JS thread continues processing user input. Only when both the render cycle and layout computation complete do the results get sent to the UI thread.

## Problems the Bridge Creates

The bridge architecture has fundamental limitations that drove the development of React Native's new architecture:

**Synchronous native access is impossible.** You can't read `UIScreen.mainScreen.scale` and return it instantly. The `NativeModules` API is always async. This makes integrating synchronous native SDKs painful.

```js
// Can't do this with the bridge:
const scale = NativeModules.DeviceInfo.getScreenScale(); // Returns a promise, not a value

// Must use async:
NativeModules.DeviceInfo.getScreenScale().then((scale) => {
  console.log('Screen scale:', scale);
});
```

This limitation affects common patterns like reading keyboard height, getting the safe area insets, checking Face ID availability, and reading file sizes. Every call requires a roundtrip across the bridge, adding at least one frame (16ms) of latency.

**JSON serialisation overhead.** Every gesture event, every scroll event, every animated frame triggers serialisation. At 60fps scrolling, thousands of messages cross the bridge.

A scroll event generates:
- `onScroll` event with scroll position, content size, and velocity
- Potentially `onMomentumScrollBegin`/`End`
- Potentially `onScrollBeginDrag`/`EndDrag`

Each event is serialised to JSON, sent across the bridge, deserialised, and processed. On low-end Android devices, this serialisation overhead alone can consume 5-10ms per frame, leaving little time for actual rendering.

**Large payloads block the bridge.** If you send a 5MB base64 image across the bridge, the JS and native threads freeze until serialisation completes.

```js
// BAD: This blocks the bridge for ~100ms
const imageData = await ImagePicker.launchCamera({ quality: 0.8 });
// imageData.uri might contain a base64 string

// BETTER: Pass the file URI instead
const imageData = await ImagePicker.launchCamera({ quality: 0.8, includeBase64: false });
// imageData.uri is a file path - no bridge overhead
```

I encountered this in a production app where we were displaying user profile photos. The initial implementation loaded base64-encoded images, causing 200ms frame drops on every photo load. Switching to URI-based loading eliminated the bridge bottleneck entirely.

**The bridge is a single queue.** All module calls, UI updates, and event responses flow through the same serialised channel. A slow native module (like an image processor) can block the entire bridge, preventing UI updates from reaching the native side. This creates the "UIImplementation" bottleneck where one slow module degrades the entire app's performance.

## The New Architecture: Fabric + JSI

React Native's new architecture (Fabric + JSI) replaces the async bridge with a synchronous, memory-shared C++ layer. JSI (JavaScript Interface) lets native code hold a reference to JS functions and call them synchronously. TurboModules replace `NativeModules` with lazy-loaded, directly-accessible modules.

```js
// New architecture: synchronous native access
const scale = DeviceInfo.getScreenScale(); // Returns value directly, no promise
console.log('Screen scale:', scale);
```

**JSI** (JavaScript Interface) is a C++ API that allows the JavaScript engine (Hermes or JSC) to expose its internal capabilities. Native modules get direct references to JavaScript objects and functions, bypassing the serialisation step:

```cpp
// JSI allows C++ to hold a reference to a JS function
// and call it synchronously
void MyNativeModule::install(jsi::Runtime& runtime) {
  auto jsFunction = runtime.global().getProperty(runtime, "myJSFunction");
  // Call the JS function synchronously from C++
  jsi::Value result = jsFunction.asObject(runtime).asFunction(runtime).call(runtime, {
    jsi::Value(42),
    jsi::Value("hello")
  });
}
```

**Fabric** is the new UI rendering layer. Instead of sending serialised JSON across a bridge, Fabric uses JSI to communicate directly with native views. The shared C++ layer means:

- Synchronous calls between JS and native
- No serialisation overhead
- TypeScript/JSI types instead of JSON strings
- Shared memory for large data (images, buffers)

**TurboModules** replace `NativeModules`. They're lazy-loaded (loaded only when first used, speeding up app startup) and directly accessible through JSI:

```typescript
// New architecture: TurboModules in TypeScript
// Auto-generated from a spec file
export interface MyDeviceInfoSpec extends TurboModule {
  readonly getConstants: () => { readonly screenScale: number };
  getScreenScale(): number; // Synchronous return!
}
```

The performance improvements are significant: app startup is 2-3x faster (lazy module loading), gesture response is tighter (no bridge roundtrip for touch events), and synchronous native APIs eliminate the async pattern that required complex state management.

## Migration to the New Architecture

The new architecture is opt-in in React Native 0.73+ and will become the default in a future version. Migration involves:

1. **Enable Hermes** (the JavaScript engine that supports JSI well)
2. **Enable Fabric** via `react-native.config.js`
3. **Migrate NativeModules** to TurboModules using the codegen
4. **Test thoroughly**—the new architecture changes timing and threading behavior

```js
// react-native.config.js
module.exports = {
  project: {
    ios: {},
    android: {},
  },
  // Enable Fabric renderer
  fabricEnabled: true,
  // Enable TurboModules
  turboModules: true,
};
```

The migration is not painless. Some third-party libraries haven't updated to support Fabric. The threading model change (synchronous vs. asynchronous) can expose race conditions that the bridge's async nature accidentally hid. But the performance gains are worth the migration effort for apps that need 60fps scrolling, instant gesture responses, and efficient native integration.

## Conclusion

The bridge was a clever hack that shipped React Native. It solved the fundamental problem of running JavaScript in a native context, and it enabled a generation of cross-platform apps. But its limitations—async-only native access, JSON serialisation overhead, single-queue bottlenecks, no shared memory—created performance ceilings that the new architecture tears down.

JSI is the production engine. It replaces the serialised, asynchronous bridge with a shared-memory, synchronous C++ layer. Fabric replaces the serialised UI updates with direct native view manipulation. TurboModules replace the monolithic, eagerly-loaded module system with lazy, type-safe native modules.

For new React Native projects, enabling the new architecture from day one is the right choice. The migration was painful for existing apps, but the new architecture's performance characteristics—synchronous native access, no serialisation overhead, shared memory—fix the fundamental limitations that defined React Native's reputation as "fast enough, but not native-fast."
