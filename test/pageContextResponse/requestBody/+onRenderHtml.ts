export default onRenderHtml

import { escapeInject } from 'vike/server'
import type { PageContextServer } from 'vike/types'

async function onRenderHtml(pageContext: PageContextServer) {
  if (pageContext.request?.method !== 'POST') return escapeInject`<!doctype html><p>HTML fallback</p>`
  pageContext.response = Response.json({ body: await pageContext.request.text() })
}
