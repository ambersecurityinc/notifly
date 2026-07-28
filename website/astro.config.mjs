import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

export default defineConfig({
	output: 'static',
	site: 'https://notifly.sh',
	integrations: [sitemap()],
	vite: {
		plugins: [tailwindcss()],
	},
});
