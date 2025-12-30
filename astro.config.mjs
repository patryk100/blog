import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';
import mermaid from 'astro-mermaid';

export default defineConfig({
  site: 'https://your-domain.com',
  integrations: [
    mdx(), 
    sitemap(), 
    tailwind(),
    mermaid() 
  ],
  markdown: {
    shikiConfig: {
      theme: 'dracula', // Or 'github-dark', 'material-theme', etc.
      wrap: true,       // Prevents horizontal scroll on mobile
    },
  },
});
