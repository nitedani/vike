import { Readable } from 'node:stream'

const contentType = 'application/atom+xml;charset=utf-8'
const encoder = new TextEncoder()

export const atomRenderTarget = {
  name: 'atom-feed',
  lifecycleRuntime: 'ssr',
  renderRuntime: 'ssr',
  match({ urlOriginal }) {
    return new URL(urlOriginal, 'http://localhost').pathname.endsWith('.atom')
  },
  async prepareRequest({ body }) {
    return body ? await body.text() : null
  },
  render(pageContext, pageConfigRef, requestData) {
    const pathname = new URL(pageContext.urlOriginal, 'http://localhost').pathname
    if (pathname === '/feed-fallback.atom') throw new Error('Atom renderer failed before commit')
    if (pathname === '/feed-bytes.atom') return encoder.encode('atom-bytes:\u0000\u0001')
    if (pathname === '/feed-stream.atom') {
      return new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('atom-web-stream'))
          controller.close()
        },
      })
    }
    if (pathname === '/feed-node-stream.atom') return Readable.from(['atom-node-', 'stream'])
    if (pathname === '/feed-action.atom') return `<action>${escapeXml(requestData ?? '')}</action>`
    const entries = pageContext.data?.entries ?? []
    return `<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"><id>${escapeXml(
      pageConfigRef.pageId,
    )}</id>${entries.map((entry) => `<entry><title>${escapeXml(entry.title)}</title></entry>`).join('')}</feed>`
  },
  encodeOutcome(outcome, responseIntent) {
    if (outcome.type === 'redirect') {
      return {
        statusCode: 409,
        headers: [['X-Atom-Outcome', 'redirect']],
        contentType,
        body: `<redirect href="${escapeXml(outcome.url)}" />`,
      }
    }
    if (outcome.type === 'fallback') {
      return {
        statusCode: responseIntent.statusCode,
        headers: [['X-Atom-Outcome', 'fallback']],
        contentType,
        body: `<error reason="${outcome.reason}" />`,
      }
    }
    return {
      statusCode: responseIntent.statusCode,
      headers: [
        ['Set-Cookie', 'target-cookie-a=1; Path=/'],
        ['Set-Cookie', 'target-cookie-b=2; Path=/'],
        ['X-Atom-Outcome', 'rendered'],
      ],
      contentType,
      body: outcome.value,
    }
  },
  prerender: {
    filePath({ urlOriginal }) {
      return new URL(urlOriginal, 'http://localhost').pathname
    },
  },
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}
