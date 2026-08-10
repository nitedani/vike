import { fileURLToPath } from 'node:url'
import vike from '../../packages/vike/plugin.js'

export default {
  plugins: [vike()],
  resolve: {
    alias: {
      'vike/abort': fileURLToPath(new URL('../../packages/vike/dist/shared-server-client/abort.js', import.meta.url)),
      'vike/server': fileURLToPath(new URL('../../packages/vike/dist/server/runtime/index.js', import.meta.url)),
      '@universal-middleware/core': fileURLToPath(
        new URL('../../packages/vike/node_modules/@universal-middleware/core/dist/index.js', import.meta.url),
      ),
    },
  },
}
