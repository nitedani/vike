export default onRenderHtml

import { escapeInject } from 'vike/server'
import type { PageContextServer } from 'vike/types'

function onRenderHtml(pageContext: PageContextServer) {
  if (
    pageContext.request?.headers.get('accept') !== 'application/x-vike-test' ||
    !(pageContext.abortReason instanceof Error)
  ) {
    return escapeInject`<!doctype html><p>HTML fallback</p>`
  }
  pageContext.headersResponse.set('Content-Type', 'application/x-vike-test')
  pageContext.content = JSON.stringify({ error: pageContext.abortReason.message })
}
