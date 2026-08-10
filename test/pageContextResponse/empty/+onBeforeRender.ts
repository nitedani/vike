export default onBeforeRender

import type { PageContextServer } from 'vike/types'

function onBeforeRender(pageContext: PageContextServer) {
  const status = pageContext.urlPathname === '/empty' ? 204 : 200
  pageContext.response = new Response(null, { status })
}
