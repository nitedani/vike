export { resolveHeadersResponseEarly }
export { resolveHeadersResponseFinal }
export { headersToEntriesPreservingSetCookie }

import { addCspResponseHeader, PageContextCspNonce } from './csp.js'
import { isCallable } from '../../../utils/isCallable.js'
import { cacheControlDisable, getCacheControl } from './getCacheControl.js'
import type { PageContextAfterPageEntryLoaded } from './loadPageConfigsLazyServerSide.js'
import '../../assertEnvServer.js'

function resolveHeadersResponseFinal(
  pageContext: {
    headersResponse?: Headers
  },
  statusCode: number,
) {
  const headersResponse = pageContext.headersResponse || new Headers()

  // 5xx error pages are temporary and shouldn't be cached.
  // This overrides any previously set Cache-Control value.
  if (statusCode >= 500) headersResponse.set('Cache-Control', cacheControlDisable)

  return headersToEntriesPreservingSetCookie(headersResponse)
}

async function resolveHeadersResponseEarly(pageContext: PageContextAfterPageEntryLoaded & PageContextCspNonce) {
  const headersResponse = await resolveHeadersResponseConfig(pageContext)
  if (!headersResponse.get('Cache-Control')) {
    const cacheControl = getCacheControl(pageContext.pageId, pageContext._globalContext._pageConfigs)
    if (cacheControl) headersResponse.set('Cache-Control', cacheControl)
  }
  addCspResponseHeader(pageContext, headersResponse)
  const pageContextAddendum = {
    headersResponse,
  }
  return pageContextAddendum
}

async function resolveHeadersResponseConfig(pageContext: PageContextAfterPageEntryLoaded): Promise<Headers> {
  const headersMerged = new Headers()
  await Promise.all(
    (pageContext.config.headersResponse ?? []).map(
      async (headers: HeadersInit | ((arg0: any) => HeadersInit | PromiseLike<HeadersInit>)) => {
        let headersInit: HeadersInit
        if (isCallable(headers)) {
          headersInit = await headers(pageContext as any)
        } else {
          headersInit = headers
        }
        headersToEntriesPreservingSetCookie(new Headers(headersInit)).forEach(([key, value]) => {
          headersMerged.append(key, value)
        })
      },
    ),
  )
  return headersMerged
}

function headersToEntriesPreservingSetCookie(headers: Headers): [string, string][] {
  const entries: [string, string][] = []
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie
  const setCookies = typeof getSetCookie === 'function' ? getSetCookie.call(headers) : null
  headers.forEach((value, key) => {
    if (setCookies && key.toLowerCase() === 'set-cookie') return
    entries.push([key, value])
  })
  setCookies?.forEach((value) => entries.push(['set-cookie', value]))
  return entries
}
