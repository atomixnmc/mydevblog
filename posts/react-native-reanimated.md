# React Native Reanimated: 60fps Animations

React Native animations default to the JS thread, competing with business logic, API responses, and state reconciliation. Reanimated changes the paradigm by running animations on the UI thread, achieving consistent 60fps even under load.

**The worklet concept** is Reanimated's foundation. A worklet is a JavaScript function that runs on the UI thread—not the main React JS thread. The Reanimated Babel plugin extracts these functions, serializes them, and sends them to a separate JavaScript runtime that executes synchronously with the frame compositor. This means animation calculations don't compete with React's rendering cycle.

**Shared values** (`useSharedValue`) replace React state for animation-related data. Unlike regular state, updating a shared value doesn't trigger a React re-render. Instead, it triggers worklet re-execution on the UI thread. `const offset = useSharedValue(0); offset.value = 100;` updates immediately without JS thread involvement. This decouples animation state from component lifecycle.

**Derived values** (`useDerivedValue`) compute from shared values reactively. `const doubled = useDerivedValue(() => offset.value * 2)` recalculates automatically whenever `offset` changes, all on the UI thread. This enables complex multi-value animations without bridge crossings.

**Animations** are declarative. `withSpring`, `withTiming`, `withDecay`, and `withRepeat` configure animation physics (stiffness, damping, mass for springs; duration, easing for timing). Interruption handling is built-in—starting a new animation automatically interpolates from the current position and velocity, producing seamless transitions without cancel/finish logic.

**Layout animations** (`Layout` and `Entering`/`Exiting` animations) animate components entering, exiting, and reordering within lists. The `Animated.Layout` configuration applies to `Animated.View` components, automatically animating position changes without manual calculation.

**Gesture integration** pairs with React Native Gesture Handler. Gesture events (pan, pinch, rotation) update shared values directly from the UI thread. A pan gesture sets `translateX.value = event.translationX` in a gesture handler callback, and the `useAnimatedStyle` worklet reads it, all without crossing the JS bridge.

The result: animations that match native platform performance, with a developer experience that feels like writing regular React code but with awareness of which thread runs which computation.
