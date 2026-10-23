import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import {fileURLToPath} from 'node:url';
export default defineConfig({plugins:[react()],resolve:{alias:{'@':fileURLToPath(new URL('.',import.meta.url))}},css:{postcss:{plugins:[tailwindcss()]}},server:{host:'127.0.0.1'},build:{outDir:'dist-static'}});
