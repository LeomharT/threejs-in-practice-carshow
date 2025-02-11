import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [react({ include: /\.(jsx|js|mdx|md|tsx|ts)$/ })],
	server: { hmr: false },
	base: './',
});
