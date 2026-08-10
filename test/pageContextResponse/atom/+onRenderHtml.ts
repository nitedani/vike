export default onRenderHtml

import type { PageContextServer } from 'vike/types'

function onRenderHtml(pageContext: PageContextServer) {
  pageContext.response = new Response(
    '<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Vike Feed</title><id>https://example.org/feed.atom</id><category term="server-rendered"/></feed>',
    { headers: { 'Content-Type': 'application/atom+xml;charset=utf-8' } },
  )
}
