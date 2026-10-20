import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

// 项目入口：根路径访问落地页《万物有回声 ECHOES OF EARTH》，
// 点击"开始探索"后进入 index.html 游戏页
export default defineConfig({
  build: {
    rollupOptions: {
      input: Object.fromEntries(['index.html', 'ecology.html', '万物有回声ECHOES OF EARTH.html'].map(file => [file, fileURLToPath(new URL(file, import.meta.url))]))
    }
  },
  plugins: [
    {
      name: 'landing-page-at-root',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const path = req.url.split('?')[0]
          if (path === '/') {
            req.url = '/' + encodeURI('万物有回声ECHOES OF EARTH.html')
          }
          next()
        })
      }
    }
  ]
})
