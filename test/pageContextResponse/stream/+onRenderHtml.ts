export default onRenderHtml

import { escapeInject } from 'vike/server'
import type { PageContextServer } from 'vike/types'

function onRenderHtml(pageContext: PageContextServer) {
  if (pageContext.request?.headers.get('accept') !== 'application/x-vike-test') {
    return escapeInject`<!doctype html><p>HTML fallback</p>`
  }
  const encoder = new TextEncoder()
  pageContext.headersResponse.set('Content-Type', 'application/x-vike-test')
  pageContext.content = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('first chunk\n'))
      controller.enqueue(encoder.encode('second chunk'))
      controller.close()
    },
  })
}
