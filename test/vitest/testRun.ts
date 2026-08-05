export { testRun }
export { viteConfig }

import { expect, describe, it } from 'vitest'
import type { InlineConfig } from 'vite'

const viteConfig = {
  logLevel: 'warn' as const,
  root: __dirname,
  configFile: __dirname + '/vite.config.js',
  server: { strictPort: true },
  preview: { strictPort: true },
} satisfies InlineConfig
const urlBase = 'http://localhost:3000'

function testRun({ isPreview = false }: { isPreview?: boolean } = {}) {
  describe('Vitest', () => {
    it('run Vitest with Vike', { timeout: 40 * 1000 }, async () => {
      {
        const html = await fetchHtml('/')
        expect(html).toContain('<h1>Welcome</h1>')
        expect(html).toContain('<li>Rendered to HTML.</li>')
      }
      {
        const html = await fetchHtml('/about')
        expect(html).toContain('<h1>About</h1>')
        expect(html).toContain('<p>Example of using Vike.</p>')
      }
      {
        const response = await fetch(urlBase + '/about/index.pageContext.json')
        expect(response.status).toBe(200)
        expect(response.headers.get('content-type')).toBe('application/json')
        expect(await response.json()).toMatchObject({ pageId: '/pages/about' })
      }
      {
        const response = await fetch(urlBase + '/feed.atom')
        expect(response.status).toBe(200)
        expect(response.headers.get('content-type')).toBe(
          isPreview ? 'application/atom+xml' : 'application/atom+xml;charset=utf-8',
        )
        if (!isPreview) {
          expect(response.headers.get('x-atom-outcome')).toBe('rendered')
          expect(response.headers.get('x-core-header')).toBe('from-vike')
          const getSetCookie = (response.headers as Headers & { getSetCookie(): string[] }).getSetCookie
          expect(getSetCookie.call(response.headers)).toEqual([
            'target-cookie-a=1; Path=/',
            'target-cookie-b=2; Path=/',
            'core-cookie-a=1; Path=/',
            'core-cookie-b=2; Path=/',
          ])
        }
        expect(await response.text()).toBe(
          '<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"><id>/pages/feed.atom</id><entry><title>A general Vike feed</title></entry></feed>',
        )
      }
      {
        const response = await fetch(urlBase + '/feed-redirect.atom', { redirect: 'manual' })
        expect(response.status).toBe(409)
        expect(response.headers.get('location')).toBe(null)
        expect(response.headers.get('x-atom-outcome')).toBe('redirect')
        expect(await response.text()).toBe('<redirect href="/about" />')
      }
      {
        const response = await fetch(urlBase + '/feed-fallback.atom')
        expect(response.status).toBe(500)
        expect(response.headers.get('x-atom-outcome')).toBe('fallback')
        expect(await response.text()).toBe('<error reason="error" />')
      }
      {
        const response = await fetch(urlBase + '/feed-bytes.atom')
        expect(new Uint8Array(await response.arrayBuffer())).toEqual(
          new TextEncoder().encode('atom-bytes:\u0000\u0001'),
        )
      }
      expect(await (await fetch(urlBase + '/feed-stream.atom')).text()).toBe('atom-web-stream')
      expect(await (await fetch(urlBase + '/feed-node-stream.atom')).text()).toBe('atom-node-stream')
      {
        const response = await fetch(urlBase + '/feed-action.atom', { method: 'POST', body: 'request-payload' })
        expect(response.status).toBe(200)
        expect(await response.text()).toBe('<action>request-payload</action>')
      }
    })
  })
}

async function fetchHtml(urlPathname: string) {
  const ret = await fetch(urlBase + urlPathname)
  const html = await ret.text()
  return html
}
