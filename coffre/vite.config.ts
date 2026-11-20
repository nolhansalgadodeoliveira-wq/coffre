import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  // Chemins relatifs : l'app fonctionne quel que soit le dossier d'hébergement.
  base: './',
  // Tout le code est mis dans le seul fichier index.html : il s'ouvre en double-clic,
  // sans serveur (les navigateurs bloquent les scripts séparés sur un fichier local).
  plugins: [react(), tailwindcss(), viteSingleFile()],
  test: {
    environment: 'node',
  },
})
