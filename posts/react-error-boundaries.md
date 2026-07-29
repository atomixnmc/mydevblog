# React Error Boundaries: Graceful Failure

Before React 16, a JavaScript error in a component's render method would unmount the entire React tree—users saw a white screen with a console error developers weren't reading. Error boundaries changed that by letting components catch errors from their children and render fallback UI.

An error boundary is a class component that implements `componentDidCatch` (or the static `getDerivedStateFromError`). React catches errors thrown during render, lifecycle methods, and constructors of the subtree. It does NOT catch errors in event handlers, async code, or server-side rendering—those need try/catch.

```js
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    // Update state so next render shows fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to an external service
    logErrorToService(error, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback">
          <h2>Something went wrong</h2>
          <details>{this.state.error.message}</details>
          <button onClick={() => this.setState({ hasError: false })}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Usage: wrap at granular boundaries
<ErrorBoundary>
  <UserProfile userId={props.id} />
</ErrorBoundary>
```

**Placement strategy**: Don't wrap the entire app in one boundary—a crash in a chat widget shouldn't take down the navigation. Do wrap major sections independently (sidebar, main content, modals). This isolates failures and lets the rest of the app function.

**Recovery patterns**: A common approach is to render a "Retry" button that resets the boundary state. The boundary's children unmount and remount, clearing whatever corrupted state caused the crash:

```js
<ErrorBoundary key={attempt}>
  <CrashableComponent />
</ErrorBoundary>
```

Changing the key forces React to unmount the old subtree and create a new one—effectively a hard reset.

**Before hooks**, error boundaries required class components. Today, there's no hook equivalent for `componentDidCatch`. The `react-error-boundary` library wraps the pattern in a hook-friendly component with auto-retry and error logging baked in.

Not all crashes should show a UI error. For known failure modes (failed image load, missing data), use conditional rendering instead. Reserve error boundaries for unexpected exceptions that you can't predict or handle locally.
