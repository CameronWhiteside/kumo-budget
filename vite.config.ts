import { reactRouter } from '@react-router/dev/vite';
import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tailwindcss(),
    reactRouter(),
    tsconfigPaths(),
  ],
  ssr: {
    // Bundle these packages for SSR instead of externalizing
    noExternal: ['@cloudflare/kumo', '@base-ui/react', '@phosphor-icons/react'],
    // Resolve conditions for SSR - prefer browser builds that work in both environments
    resolve: {
      conditions: ['browser', 'module', 'import', 'default'],
    },
  },
  optimizeDeps: {
    include: ['@cloudflare/kumo', '@base-ui/react'],
  },
  resolve: {
    // Ensure consistent module resolution
    dedupe: ['react', 'react-dom', '@cloudflare/kumo'],
  },
});
