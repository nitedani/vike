import { afterAll, beforeAll, expect, it } from 'vitest'
import { dev } from '../../packages/vike/dist/node/api/index.js'

const urlBase = 'http://localhost:3001'
const viteConfig = {
  logLevel: 'warn' as const,
  root: __dirname,
  configFile: __dirname + '/vite.config.mjs',
  server: { port: 3001, strictPort: true },
}
let viteServer: Awaited<ReturnType<typeof dev>>['viteServer']

beforeAll(async () => {
  const result = await dev({ viteConfig })
  viteServer = result.viteServer
}, 40 * 1000)

afterAll(async () => {
  await viteServer?.close()
})

it('encodes a missing route as the selected representation without an error page', async () => {
  const response = await fetch(urlBase + '/missing.atom')
  expect(response.status).toBe(404)
  expect(response.headers.get('content-type')).toBe('application/problem+json')
  expect(response.headers.get('x-render-outcome')).toBe('fallback')
  expect(response.headers.get('x-fallback-reason')).toBe('not-found')
  expect(response.headers.get('x-response-intent-status')).toBe('404')
  expect(await response.json()).toEqual({ type: 'fallback', reason: 'not-found' })
})
