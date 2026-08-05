import vike from '../../packages/vike/dist/node/vite/index.js'

export default {
  plugins: [vike()],
  optimizeDeps: { noDiscovery: true },
  ssr: { optimizeDeps: { noDiscovery: true } },
}
