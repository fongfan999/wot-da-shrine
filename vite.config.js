import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { cloudflare } from '@cloudflare/vite-plugin';

/**
 * HTML partials: a line `<include src="src/partials/bar.html">` in index.html is replaced by that
 * file, indented to match. Paths in index.html are from the project root, paths in a partial from
 * that partial, so partials may include partials. Vite reloads the page when any .html file changes.
 */
function partials() {
  const INCLUDE = /^([ \t]*)<include src="([^"]+)">$/gm;
  const expand = (html, dir) => html.replace(INCLUDE, (_, indent, src) => {
    const file = resolve(dir, src);
    return expand(readFileSync(file, 'utf8').trimEnd(), dirname(file)).replace(/^(?=.)/gm, indent);
  });
  let root;
  return {
    name: 'partials',
    configResolved(config) { root = config.root; },
    // From the root, not the page's own path: the Cloudflare plugin hands Vite an absolute path as the URL.
    transformIndexHtml: { order: 'pre', handler: (html) => expand(html, root) },
  };
}

/**
 * Two pages: index.html is the home page (/, maintenance pages, /tv), r/index.html a shared shrine,
 * which the Worker serves for every /r/:room. What they share is built into common chunks.
 */
const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [partials(), cloudflare()],
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 0,
  },
  environments: {
    // the browser's build only: the Worker's has its own entry, worker/index.js
    client: { build: { rollupOptions: { input: { home: resolve(root, 'index.html'), room: resolve(root, 'r/index.html') } } } },
  },
});
