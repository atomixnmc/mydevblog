# Building This Blog with Shoelace

This blog is built with Shoelace — a library of web components — running on a static site generator. Shoelace provides the UI components (tabs, buttons, drawers, tags) as standard HTML elements, usable without any framework.

## Why Shoelace

Shoelace is framework-agnostic. It uses the Custom Elements v1 spec — every component is a `<sl-*>` tag that works in React, Vue, Svelte, Solid, or vanilla HTML. For a blog that's primarily content, Shoelace gives me polished UI without committing to a frontend framework.

```html
<!-- Shoelace tag display — no JS framework needed -->
<sl-tag variant="success">NestJS</sl-tag>
<sl-tag variant="neutral">React</sl-tag>
<sl-tag variant="warning">Architecture</sl-tag>

<!-- Tab navigation for posts -->
<sl-tab-group>
  <sl-tab slot="nav" panel="latest" active>Latest</sl-tab>
  <sl-tab slot="nav" panel="popular">Popular</sl-tab>

![](2026/mydevblog-relaunch_img-001.png)

  <sl-tab-panel name="latest">
    <post-list category="latest" />
  </sl-tab-panel>
  <sl-tab-panel name="popular">
    <post-list category="popular" />
  </sl-tab-panel>
</sl-tab-group>
```

## Build Process

The blog uses a custom static site generator written in Node.js:

```javascript
// build.mjs
import { readdir, readFile, writeFile } from 'fs/promises';
import { marked } from 'marked';

async function build() {
  const posts = await readdir('posts');
  const htmlPosts = [];

  for (const file of posts) {
    if (!file.endsWith('.md')) continue;

    const md = await readFile(`posts/${file}`, 'utf-8');
    const html = marked(md);
    const slug = file.replace('.md', '');

![](2026/mydevblog-relaunch_img-002.png)

    // Extract title from first heading
    const title = md.match(/^# (.+)$/m)?.[1] ?? slug;

    htmlPosts.push({
      slug,
      title,
      html,
      date: extractDate(md),
      tags: extractTags(md),
    });
  }

  // Sort by date (newest first)
  htmlPosts.sort((a, b) => b.date - a.date);

  // Generate index page
  await renderTemplate('templates/index.html', {
    posts: htmlPosts,
    shoelaceCSS: loadShoelaceCSS(),
  });

  // Generate individual post pages
  for (const post of htmlPosts) {
    await renderTemplate('templates/post.html', post);
  }
}

await build();
```

The build process takes ~2 seconds for 180+ posts. Most of the time is parsing markdown — the template rendering is under 50ms.

![](2026/mydevblog-relaunch_img-003.png)

## Shoelace Components Used

- **`<sl-tag>`**: Category tags on each post card
- **`<sl-tab-group>`**: Organizing posts by category/latest/popular
- **`<sl-drawer>`**: Table of contents drawer on post pages
- **`<sl-button>`**: Social share buttons
- **`<sl-input>`**: Search/filter for posts
- **`<sl-spinner>`**: Loading indicator for lazy-loaded content
- **`<sl-details>`**: Expandable sections in long posts
- **`<sl-copy-button>`**: Copy code snippet button

## Styling

Shoelace components have CSS custom properties for theming:

```css
:root {
  --sl-color-primary-50: #f0f4ff;
  --sl-color-primary-500: #6366f1;
  --sl-color-primary-900: #1e1b4b;
  --sl-font-sans: 'Inter', sans-serif;
  --sl-font-mono: 'JetBrains Mono', monospace;
  --sl-input-border-radius: 8px;
  --sl-panel-border-width: 0;
}

sl-tag {
  --sl-tag-font-size: var(--sl-font-size-x-small);
  --sl-tag-border-radius: var(--sl-border-radius-medium);
}
```

The blog loads Shoelace from a CDN in development and bundles it in the static output for production. The CSS custom properties are the only styling needed — Shoelace components are styled entirely through their design tokens. The total CSS footprint is about 4KB (just token overrides). The Shoelace JS bundle is 85KB gzipped including all components used. For a blog with minimal interactivity, this is more than acceptable — the first meaningful paint is under 1.5 seconds.
