export default onRenderHtml

import { escapeInject } from 'vike/server'
import type { PageContextServer } from 'vike/types'

type AbortRedirect = {
  _abortCaller?: 'throw redirect()'
  _urlRedirect?: { url: string; statusCode: number }
}

function onRenderHtml(pageContext: PageContextServer) {
  const abort = pageContext.dangerouslyUseInternals as unknown as AbortRedirect
  if (
    pageContext.request?.headers.get('accept') !== 'application/x-vike-test' ||
    abort._abortCaller !== 'throw redirect()'
  ) {
    return escapeInject`<!doctype html><p>HTML fallback</p>`
  }
  pageContext.headersResponse.set('Content-Type', 'application/x-vike-test')
  pageContext.content = JSON.stringify({ redirect: abort._urlRedirect!.url })
}
