# Building React from Scratch: The v0.3 Component Model

Looking back at React v0.3 from 2013 is like archaeology on a framework that would go on to reshape frontend development. At 1,300 lines of code, the first open-source release was refreshingly small—you could genuinely read the whole thing in an afternoon.

The component model in v0.3 centered around `ReactComponent` and `ReactCompositeComponent`. Components were classes with a `render()` method returning virtual DOM via `React.DOM.*` helpers. The key insight was the **transaction system**: every state change went through a `ReactCompositeComponent.Mixin._performUpdateIfNecessary()` call wrapped in a transaction. This is where React's signature batching behaviour was born—multiple `setState` calls coalesced into a single DOM update.

```js
var MyComponent = React.createClass({
  getInitialState: function() {
    return { clicks: 0 };
  },
  handleClick: function() {
    this.setState({ clicks: this.state.clicks + 1 });
  },
  render: function() {
    return React.DOM.button(
      { onClick: this.handleClick },
      'Clicked ' + this.state.clicks + ' times'
    );
  }
});
```

The `ReactMultiChild` module handled diffing of child arrays. It used a keyed algorithm that's recognisably the ancestor of today's reconciler, but without the fibre architecture—just recursive traversal and document fragment swapping.

What struck me most reading the v0.3 source was how many concepts survived to v18: the `shouldComponentUpdate` hook was already there, `ReactEventEmitter` handled delegation, and the `ReactInstanceHandles` module generated those familiar data-reactid attributes. The DNA was complete, even if the implementation was still finding its legs.
