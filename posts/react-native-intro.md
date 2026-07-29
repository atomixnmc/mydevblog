# React Native: Understanding the Bridge Architecture

React Native promised "learn once, write anywhere" by letting JavaScript drive native UI components. The architecture that makes this work—the **bridge**—is the key to understanding RN's performance characteristics, its limitations with synchronous APIs, and why the new architecture (JSI/Fabric) exists.

The bridge is an asynchronous, serialised, batched communication channel between the JavaScript thread and the native thread. When your JS calls `<View style={{left: 100}} />`, it serialises a JSON-like message: "create view #42, set property 'left' to 100". The native thread deserialises it and updates the actual `UIView` or `android.view.View`. Responses flow back the same way, which is why you can't return a native object from `NativeModules`—everything crosses the bridge as serialised data.

```js
// This JS call crosses the bridge as JSON
NativeModules.MyModule.doSomething("hello", (result) => {
  // Callback also crosses the bridge
  console.log("Native replied:", result);
});
```

The **shadow thread** is the unsung hero. Layout calculations—Yoga flexbox computations—run here, off the JS and UI threads. The shadow tree computes positions, then sends pixel-perfect frame data to the native side in one batched update. This prevents layout thrash and keeps the UI thread focused on rendering.

Problems the bridge creates:
- **Synchronous native access is impossible.** You can't read `UIScreen.mainScreen.scale` and return it instantly. The `NativeModules` API is always async. This makes integrating synchronous native SDKs painful.
- **JSON serialisation overhead.** Every gesture event, every scroll event, every animated frame triggers serialisation. At 60fps scrolling, thousands of messages cross the bridge.
- **Large payloads block the bridge.** If you send a 5MB base64 image across the bridge, the JS and native threads freeze until serialisation completes.

React Native's new architecture (Fabric + JSI) replaces the async bridge with a synchronous, memory-shared C++ layer. JSI (JavaScript Interface) lets native code hold a reference to JS functions and call them synchronously. TurboModules replace `NativeModules` with lazy-loaded, directly-accessible modules. The result: startup faster, gesture responses tighter, and synchronous native APIs possible.

The bridge was a clever hack that shipped React Native. JSI is the production engine.
