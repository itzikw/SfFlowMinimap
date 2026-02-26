import { defineConfig } from 'vite';
import { resolve } from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Keep output readable; minify only in production via --mode production
    minify: false,
    rollupOptions: {
      input: {
        'content-script': resolve(import.meta.dirname, 'src/content/index.js'),
      },
      output: {
        // Chrome MV3 content scripts must be self-contained IIFEs, not ES modules
        format: 'iife',
        name: 'SfFlowMinimap',
        entryFileNames: '[name].js',
        // Route extracted CSS to the filename the manifest expects
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) return 'minimap-styles.css';
          return assetInfo.name ?? '[name][extname]';
        },
      },
    },
  },
  plugins: [
    viteStaticCopy({
      targets: [
        { src: 'public/manifest.json', dest: '.' },
        { src: 'public/icon16.png', dest: '.' },
        { src: 'public/icon48.png', dest: '.' },
        { src: 'public/icon128.png', dest: '.' },
        // CSS is declared in the manifest and loaded directly by Chrome —
        // copy it as-is rather than letting Vite inline it into the IIFE bundle.
        { src: 'src/styles/minimap.css', dest: '.', rename: 'minimap-styles.css' },
        { src: 'public/options.html', dest: '.' },
      ],
    }),
  ],
});
