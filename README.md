# mydevblog

My personal development blog — a static site built with **Shoelace WebComponents**, **marked.js**, and vanilla JS. No Jekyll, no build step — just HTML + Markdown + JavaScript.

## Tech Stack

- **[Shoelace](https://shoelace.style/)** — WebComponent UI library for the modern design system
- **[marked](https://marked.js.org/)** — Markdown parser for client-side rendering
- **Vanilla JS** — No framework, no build step, pure ESM
- **GitHub Pages** — Automatic deployment via GitHub Actions

## Structure

```
├── index.html           # Main SPA entry point
├── .nojekyll            # Disable Jekyll (we render .md via JS)
├── css/
│   └── blog.css         # Custom styles
├── js/
│   ├── posts-index.js   # Master catalog of all ~188 posts
│   └── md-blog.js       # Blog engine (WebComponents, search, routing)
├── posts/               # Markdown blog posts (rendered client-side)
└── .github/workflows/
    └── gh-pages.yml     # GitHub Actions deploy workflow
```

## Development

```bash
npx serve .
```

## License

MIT
