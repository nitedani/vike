export { resolveRequest }

import { createRequestAdapter } from '@universal-middleware/node/request'
import type { PageContextInitInternal } from '../../../types/PageContext.js'
import { assertUsage } from '../../../utils/assert.js'
import '../../assertEnvServer.js'

const requestAdapter = createRequestAdapter()

function resolveRequest(pageContextInit: PageContextInitInternal, hasMiddlewares: boolean) {
  const request =
    pageContextInit.request ??
    (pageContextInit._nodeDev ? requestAdapter(pageContextInit._nodeDev.req, pageContextInit._nodeDev.res) : undefined)
  if (request) assertUsage(!request.bodyUsed, 'renderPage() received a Request whose body was already consumed')
  if (!hasMiddlewares) return { request, requestForMiddleware: null }
  if (!request) {
    const requestForMiddleware = new Request(new URL(pageContextInit.urlOriginal, 'http://localhost').toString(), {
      headers: pageContextInit.headersOriginal as HeadersInit | undefined,
    })
    return { request, requestForMiddleware }
  }
  return { request: request.clone(), requestForMiddleware: request }
}
