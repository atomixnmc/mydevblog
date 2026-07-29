# Migrating from React v0.14 to v15: What Changed

React v15 "React 15" was one of those releases that felt incremental on the surface but shipped significant internal changes. If you were maintaining a project across this boundary, three things demanded attention: the `React.createClass` deprecation warning, the `document.createElement` verification in server rendering, and the removal of `React.addons`.

The headline change was that `React.createClass` started printing deprecation warnings in favour of ES6 classes. This wasn't enforced until v16, but v15 was the warning window. Upgrading meant rewriting mixin-based components:

```js
// Before (v0.14)
var Button = React.createClass({
  mixins: [PureRenderMixin],
  propTypes: { label: React.PropTypes.string },
  render: function() {
    return React.DOM.button(null, this.props.label);
  }
});

// After (v15 + ES6 classes)
class Button extends React.Component {
  static propTypes = { label: PropTypes.string };
  shouldComponentUpdate(nextProps) {
    return this.props.label !== nextProps.label;
  }
  render() {
    return <button>{this.props.label}</button>;
  }
}
```

`React.addons` was deprecated—`PureRenderMixin` became `React.PureComponent`, and `CSSTransitionGroup` moved to `react-addons-css-transition-group` (later `react-transition-group`). Server rendering got faster: `ReactDOMServer.renderToString` no longer used `data-reactid` attribute verification, shaving off DOM-validation overhead.

The v15 release also introduced **document-level event delegation**—React stopped attaching handlers to the root DOM node and started listening on `document`. This fixed issues with portal content and nested React trees. If you had code reading `event.currentTarget` expecting the root, you needed to switch to `event.nativeEvent`.

Upgrading was straightforward if you had test coverage. The real pain came for projects heavily reliant on mixins—those required architectural refactoring before the v16 hard cutoff.
