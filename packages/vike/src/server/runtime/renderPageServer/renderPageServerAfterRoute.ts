export { renderPageServerAfterRoute }
export { renderPageServerResponse }
export { prerenderPage }
export { prerenderPageEntry }
export type { PageContextAfterRender }

import { getErrorPageId } from '../../../shared-server-client/error-page.js'
import { getHtmlString } from './html/renderHtml.js'
import { assert, assertUsage } from '../../../utils/assert.js'
import { hasProp } from '../../../utils/hasProp.js'
import { isSameErrorMessage } from '../../../utils/isSameErrorMessage.js'
import { objectAssign } from '../../../utils/objectAssign.js'
import { updateType } from '../../../utils/updateType.js'
import { getPageContextClientSerialized } from './html/serializeContext.js'
import { type PageContextUrlInternal } from '../../../shared-server-client/getPageContextUrlComputed.js'
import {
  createHttpResponsePage,
  createHttpResponsePageContent,
  createHttpResponsePageJson,
  HttpResponse,
} from './createHttpResponse.js'
import {
  loadPageConfigsLazyServerSide,
  type PageContext_loadPageConfigsLazyServerSide,
  type PageConfigsLazy,
} from './loadPageConfigsLazyServerSide.js'
import { execHookOnRenderHtml } from './execHookOnRenderHtml.js'
import { execHookDataAndOnBeforeRender } from './execHookDataAndOnBeforeRender.js'
import { logRuntimeError } from '../loggerRuntime.js'
import { getPageContextPublicServer } from './getPageContextPublicServer.js'
import { execHookGuard } from '../../../shared-server-client/route/execHookGuard.js'
import pc from '@brillout/picocolors'
import { isServerSideError } from '../../../shared-server-client/misc/isServerSideError.js'
import type { PageContextCreatedServer } from './createPageContextServer.js'
import type { PageContextBegin } from '../renderPageServer.js'
import { getAsyncLocalStorage, type AsyncStore } from '../asyncHook.js'
import { resolvePageContextResponse } from './resolvePageContextResponse.js'
import '../../assertEnvServer.js'

type PageContextAfterRender = { httpResponse: HttpResponse; errorWhileRendering: null | Error }
type PageContextRender = {
  pageId: string
  _pageContextAlreadyProvidedByOnPrerenderHook?: true
  is404: null | boolean
  routeParams: Record<string, string>
  errorWhileRendering: null | Error
  _requestId: number
  response?: Response
  content?: string | ReadableStream<Uint8Array>
} & PageContextCreatedServer &
  PageContextBegin &
  PageContextUrlInternal &
  PageContext_loadPageConfigsLazyServerSide

async function renderPageServerAfterRoute<PageContext extends PageContextRender>(
  pageContext: PageContext,
): Promise<PageContext & PageContextAfterRender> {
  // pageContext.pageId can either be the:
  //  - ID of the page matching the routing, or the
  //  - ID of the error page `_error.page.js`.
  assert(hasProp(pageContext, 'pageId', 'string'))

  const isError: boolean = pageContext.is404 || !!pageContext.errorWhileRendering
  assert(
    isError ===
      (pageContext.pageId ===
        getErrorPageId(pageContext._globalContext._pageFilesAll, pageContext._globalContext._pageConfigs)),
  )

  updateType(pageContext, await loadPageConfigsLazyServerSide(pageContext))
  assertContentUnset(pageContext)
  {
    const pageContextWithResponse = resolvePageContextResponse(pageContext)
    if (pageContextWithResponse) return pageContextWithResponse
  }

  if (!isError) {
    await execHookGuard(pageContext, (pageContext) => getPageContextPublicServer(pageContext))
    assertContentUnset(pageContext)
    const pageContextWithResponse = resolvePageContextResponse(pageContext)
    if (pageContextWithResponse) return pageContextWithResponse
  }

  if (!isError) {
    await execHookDataAndOnBeforeRender(pageContext)
  } else {
    try {
      await execHookDataAndOnBeforeRender(pageContext)
    } catch (err) {
      if (!isSameErrorMessage(err, pageContext.errorWhileRendering)) {
        logRuntimeError(err, pageContext)
      }
    }
  }

  assertContentUnset(pageContext)
  {
    const pageContextWithResponse = resolvePageContextResponse(pageContext)
    if (pageContextWithResponse) return pageContextWithResponse
  }

  if (pageContext.isClientSideNavigation) {
    if (isError) {
      objectAssign(pageContext, { [isServerSideError]: true })
    }
    const pageContextSerialized: string = getPageContextClientSerialized(pageContext, false)
    const httpResponse = await createHttpResponsePageJson(pageContextSerialized)
    objectAssign(pageContext, { httpResponse })
    return pageContext
  }

  const pageContextWithResponse = await renderPageServerResponse(pageContext)
  assert(pageContextWithResponse)
  return pageContextWithResponse
}

async function renderPageServerResponse<PageContext extends PageContextRender & PageConfigsLazy>(
  pageContext: PageContext,
  allowHtmlResponse = true,
): Promise<(PageContext & PageContextAfterRender) | null> {
  assertContentUnset(pageContext)
  {
    const pageContextWithResponse = resolvePageContextResponse(pageContext)
    if (pageContextWithResponse) return pageContextWithResponse
  }

  const { htmlRender, renderHook } = await execHookOnRenderHtml(pageContext)
  {
    const pageContextWithResponse = resolvePageContextResponse(pageContext)
    if (pageContextWithResponse) return pageContextWithResponse
  }
  if (pageContext.content !== undefined) {
    assert(htmlRender === null)
    const httpResponse = await createHttpResponsePageContent(pageContext.content, pageContext)
    objectAssign(pageContext, { httpResponse })
    return pageContext
  }
  assert(htmlRender !== null)
  if (!allowHtmlResponse) return null
  const httpResponse = await createHttpResponsePage(htmlRender, renderHook, pageContext)
  objectAssign(pageContext, { httpResponse })
  return pageContext
}

function assertContentUnset(pageContext: { content?: unknown }) {
  assertUsage(pageContext.content === undefined, 'pageContext.content can only be set by onRenderHtml()')
}

async function prerenderPage(pageContext: Parameters<typeof prerenderPageEntry>[0]) {
  const asyncLocalStorage = await getAsyncLocalStorage()
  const requestId = pageContext._requestId
  assert(requestId)
  const asyncStore: AsyncStore = !asyncLocalStorage ? null : { requestId, pageContext }
  objectAssign(pageContext, { _asyncStore: asyncStore, _requestId: requestId })
  const render = async () => await prerenderPageEntry(pageContext)
  if (asyncLocalStorage) {
    return await asyncLocalStorage.run(asyncStore, render)
  } else {
    return await render()
  }
}

async function prerenderPageEntry(
  pageContext: PageContextCreatedServer &
    PageConfigsLazy & {
      routeParams: Record<string, string>
      pageId: string
      _requestId: number
      _usesClientRouter: boolean
      _pageContextAlreadyProvidedByOnPrerenderHook?: true
      is404: boolean
      response?: Response
      content?: string | ReadableStream<Uint8Array>
    },
) {
  objectAssign(pageContext, {
    _isPageContextJsonRequest: null,
    pageContextsAborted: [],
  })

  /* Should we execute the guard() hook upon pre-rendering? Is there a use case for this?
   *  - It isn't trivial to implement, as it requires to duplicate / factor out the isAbortError() handling
  await execHookGuard(pageContext, (pageContext) => getPageContextPublicServer(pageContext))
  */

  await execHookDataAndOnBeforeRender(pageContext)
  assertUsage(
    pageContext.response === undefined,
    'Cannot pre-render a page whose hook sets pageContext.response: set pageContext.content instead',
  )
  assertContentUnset(pageContext)

  const { htmlRender, renderHook } = await execHookOnRenderHtml(pageContext)
  assertUsage(
    pageContext.response === undefined,
    'Cannot pre-render a page whose onRenderHtml() hook sets pageContext.response: set pageContext.content instead',
  )
  const renderedContent = pageContext.content ?? htmlRender
  assertUsage(
    renderedContent !== null,
    `Cannot pre-render ${pc.cyan(pageContext.urlOriginal)} because the ${renderHook.hookName}() hook defined by ${
      renderHook.hookFilePath
    } didn't return content.`,
  )
  const documentHtml = await getHtmlString(renderedContent)
  assert(typeof documentHtml === 'string')
  if (!pageContext._usesClientRouter) {
    return { documentHtml, pageContextSerialized: null, pageContext }
  } else {
    const pageContextSerialized = getPageContextClientSerialized(pageContext, false)
    return { documentHtml, pageContextSerialized, pageContext }
  }
}
