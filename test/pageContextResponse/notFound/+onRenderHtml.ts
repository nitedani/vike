export default onRenderHtml

import { escapeInject } from 'vike/server'
import type { PageContextServer } from 'vike/types'

function onRenderHtml(pageContext: PageContextServer) {
  if (pageContext.request?.headers.get('accept') !== 'application/x-vike-test' || !pageContext.is404) {
    return escapeInject`<!doctype html><p>HTML fallback</p>`
  }
  pageContext.headersResponse.set('Content-Type', 'application/x-vike-test')
  pageContext.content = JSON.stringify({ type: 'fallback', reason: 'not-found', abortReason: pageContext.abortReason })
}
