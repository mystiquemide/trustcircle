import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return
          }

          if (id.includes('viem')) {
            return 'vendor-viem'
          }

          if (id.includes('@headlessui/react') || id.includes('@heroicons/react')) {
            return 'vendor-ui'
          }

          if (
            id.includes('react-router-dom') ||
            id.includes('react-router') ||
            id.includes('react-dom') ||
            id.includes('react')
          ) {
            return 'vendor-react'
          }
        },
      },
    },
  },
})
