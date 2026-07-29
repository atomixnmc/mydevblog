# Inside tonegodgui: Building a UI Framework for JMonkeyEngine

Every game engine eventually needs a UI framework. The question is whether you build one or let the UI framework build you.

When we started building SGMedia's internal tools on JMonkeyEngine 3, the UI story was bleak. Nifty-GUI existed but was designed for menu screens, not editor interfaces. You couldn't build a dockable panel system with Nifty. You couldn't skin a button at runtime. You couldn't event-bind without XML gymnastics.

So we wrote tonegodgui. It started as 2,000 lines of experimental UI code and grew into a 40,000-line framework that powered every internal tool at SGMedia for years.

**Layout Engine**

The layout system used a constraint-based model inspired by Java's GridBagLayout but simplified for game development. Every element had anchor points (Top, Bottom, Left, Right, Center) and padding/margin properties. Children flowed relative to parents, not absolute screen coordinates.

```java
// Layout definition for a control panel
ControlPanel panel = new ControlPanel(screen, "inventory_panel");
panel.setLayout(new BorderLayout());
panel.setDimensions(300, 400);

// Add child with layout constraints
Button equipButton = new Button(screen, "equip_btn") {{
  setText("Equip");
  setLayoutHint(BorderLayout.SOUTH);
}};
panel.addChild(equipButton);
```

**Skinning System**

We separated visual style from logic using a skin definition system. Skins were JSON files that defined colors, gradients, border widths, and font references. A single skin change could re-theme an entire toolset. This was revolutionary for our artists, who could now tweak UI appearance without touching Java code.

```json
{
  "skin": "dark_theme",
  "defaults": {
    "color": "#CCCCCC",
    "background": "#2D2D2D",
    "border": "#3D3D3D",
    "borderWidth": 1
  },
  "Button": {
    "normal": { "background": "#3D3D3D", "textColor": "#FFFFFF" },
    "hover":  { "background": "#4D4D4D", "textColor": "#FFFFFF" },
    "pressed":{ "background": "#2D2D2D", "textColor": "#AAAAAA" }
  }
}
```

**Event System**

The event bus was inspired by C# delegates. Controls could subscribe to typed events with lambdas, and the framework handled propagation, bubbling, and cancellation. No anonymous listener interfaces, no boilerplate.

```java
button.onMouseClick(event -> {
  if (event.getButton() == MouseInput.BUTTON_LEFT) {
    player.inventory.equipItem(selectedItem);
    updateInventoryDisplay();
  }
});
```

tonegodgui shipped on Maven Central, got picked up by the JME3 community, and is still used in active projects today. It taught me that a good framework is one that gets out of your way—you shouldn't fight your UI library, and neither should your users.
