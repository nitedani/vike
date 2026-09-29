export default onRenderHtml

import { escapeInject } from 'vike/server'
import type { PageContextServer } from 'vike/types'

function onRenderHtml(pageContext: PageContextServer) {
  if (
    pageContext.request?.headers.get('accept') !== 'application/x-vike-test' ||
    !(pageContext.errorWhileRendering instanceof Error)
  ) {
    return escapeInject`<!doctype html><p>HTML fallback</p>`
  }
  pageContext.response = new Response(JSON.stringify({ error: pageContext.errorWhileRendering.message }), {
    status: 500,
    headers: { 'Content-Type': 'application/x-vike-test' },
  })
}
