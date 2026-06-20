import { defineConfig } from 'vite';

/* GitHub Pages가 https://doldimseom.github.io/doldimseom-gridmaker/ 서브경로로 서빙하므로,
   index.html의 /legacy/* 절대경로 참조가 깨지지 않도록 base를 레포명에 맞춘다. */
export default defineConfig({
  base: '/doldimseom-gridmaker/',
});
