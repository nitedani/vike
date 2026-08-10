export default onRenderHtml

import type { PageContextServer } from 'vike/types'

function onRenderHtml(pageContext: PageContextServer) {
  const mode = pageContext.isPrerendering ? 'prerendered' : 'server-rendered'
  pageContext.headersResponse.set('Content-Type', 'application/atom+xml;charset=utf-8')
  pageContext.content = `<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Vike Feed</title><id>https://example.org/feed.atom</id><category term="${mode}"/></feed>`
}
