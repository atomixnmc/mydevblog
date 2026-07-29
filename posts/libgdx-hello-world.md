# libGDX Hello World: Setting Up for Java Game Development

Setting up a libGDX project for the first time feels like unboxing proper game dev tooling. The framework gives you a Java game loop, OpenGL abstractions, and cross-platform deployment without forcing an editor on you. Here's how to get a window on screen with a sprite bouncing around.

Start with the **gdx-setup** app or the Gradle template. The generated project has three core modules: `core` (shared logic), `desktop` (LWJGL launcher), and `android`/`ios`/`html` depending on targets. The `ApplicationListener` interface is your entry point:

```java
public class HelloGame implements ApplicationListener {
    private SpriteBatch batch;
    private Texture texture;
    private float x, y, vx, vy;

    @Override
    public void create() {
        batch = new SpriteBatch();
        texture = new Texture("badlogic.jpg");
        x = 100; y = 100; vx = 200; vy = 150;
    }

    @Override
    public void render() {
        Gdx.gl.glClearColor(0.1f, 0.1f, 0.2f, 1);
        Gdx.gl.glClear(GL20.GL_COLOR_BUFFER_BIT);

        float dt = Gdx.graphics.getDeltaTime();
        x += vx * dt; y += vy * dt;
        if (x < 0 || x > Gdx.graphics.getWidth() - texture.getWidth()) vx = -vx;
        if (y < 0 || y > Gdx.graphics.getHeight() - texture.getHeight()) vy = -vy;

        batch.begin();
        batch.draw(texture, x, y);
        batch.end();
    }
    // resize, pause, resume, dispose stubs omitted
}
```

Key things to know: `SpriteBatch` collects geometry and flushes it in one draw call—never mix `begin`/`end` calls. Textures loaded via `new Texture()` live in GPU memory and must be `dispose()`d. `Gdx` provides static access to graphics, input, audio, and files, so any class in your project can reach them.

Run `DesktopLauncher` and you've got a window with a bouncing logo. From here, the libGDX wiki covers input polling, asset management with `AssetManager`, and viewport scaling. It's a framework where you can stay close to the metal or lean on higher-level tools—your call.
