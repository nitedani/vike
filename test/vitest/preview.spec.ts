import { afterAll, beforeAll, expect, it } from 'vitest'
import { testRun, viteConfig } from './testRun'
import { build, preview } from '../../packages/vike/dist/node/api/index.js'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'

let viteServer: Awaited<ReturnType<typeof preview>>['viteServer']

beforeAll(async () => {
  await build({ viteConfig })
  const ret = await preview({ viteConfig })
  viteServer = ret.viteServer
  viteServer!.printUrls()
}, 40 * 1000)

afterAll(async () => {
  try {
    await viteServer?.close()
  } catch (e) {
    console.error('Error closing Vite server:', e)
  }
})

testRun({ isPreview: true })

it('writes the target artifact to its exact non-HTML prerender path', async () => {
  const filePath = path.join(__dirname, 'dist/client/feed.atom')
  expect(await readFile(filePath, 'utf8')).toBe(
    '<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"><id>/pages/feed.atom</id><entry><title>A general Vike feed</title></entry></feed>',
  )
  await expect(access(filePath + '.html')).rejects.toThrow()
})
