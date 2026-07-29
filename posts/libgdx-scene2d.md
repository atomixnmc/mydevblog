# Scene2D: UI Toolkit in libGDX

libGDX's Scene2D is one of those frameworks you don't appreciate until you've wrestled with raw OpenGL coordinates for menus. It's a retained-mode UI system built on actors, stages, and input listeners—think Java Swing but for games, with skin-based theming and drawable resources.

A `Stage` holds your UI tree and processes input. You create actors (labels, buttons, text fields, tables), add them to the stage, and call `stage.act(dt)` / `stage.draw()` in your render loop. The `Table` widget is the workhorse—it uses a CSS-like row/column layout system that handles alignment, padding, and cell expansion.

```java
public class MyUI {
    private Stage stage;
    private Skin skin;

    public MyUI() {
        stage = new Stage(new FitViewport(800, 600));
        skin = new Skin(Gdx.files.internal("uiskin.json"));

        Table table = new Table(skin);
        table.setFillParent(true);
        table.add("Player Stats").colspan(2).center();
        table.row();
        table.add("Health:").left();
        table.add("87/100").right();
        table.row().padTop(20);
        table.add(new TextButton("Attack", skin)).colspan(2).center();

        stage.addActor(table);
        Gdx.input.setInputProcessor(stage);
    }

    public void render() {
        stage.act(Gdx.graphics.getDeltaTime());
        stage.draw();
    }
}
```

The `Skin` file maps widget names to drawable resources (nine-patch backgrounds, fonts, colours). You can write skins as JSON referencing texture atlas regions, or generate them programmatically. The **nine-patch** system is crucial—buttons and panels stretch cleanly without distorting borders.

Scene2D supports change listeners (`ClickListener`), actions for animation (fade, move, scale sequences), and a `ScissorStack` for clipping. It's not trying to be a web-in-Game engine—there's no CSS cascade or flexbox—but for in-game menus, HUDs, and tooltips, it's fast and predictable.

One gotcha: Scene2D fonts use `BitmapFont` from the texture atlas, so you need to pre-render glyphs or use the `freetype` extension for runtime font generation.
