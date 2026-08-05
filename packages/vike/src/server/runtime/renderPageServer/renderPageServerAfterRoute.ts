export { renderPageServerAfterRoute }
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
  createHttpResponsePageJson,
  getStatusCodePage,
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
import { createHttpResponseRenderTarget, renderWithRenderTarget, type PageContextRenderTarget } from './renderTarget.js'
import '../../assertEnvServer.js'

type PageContextAfterRender = { httpResponse: HttpResponse; errorWhileRendering: null | Error }

async function renderPageServerAfterRoute<
  PageContext extends {
    pageId: string
    _pageContextAlreadyProvidedByOnPrerenderHook?: true
    is404: null | boolean
    routeParams: Record<string, string>
    errorWhileRendering: null | Error
    _requestId: number
  } & PageContextCreatedServer &
    PageContextBegin &
    PageContextUrlInternal &
    PageContext_loadPageConfigsLazyServerSide,
>(pageContext: PageContext): Promise<PageContext & PageContextAfterRender> {
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

  if (!isError) {
    await execHookGuard(pageContext, (pageContext) => getPageContextPublicServer(pageContext))
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

  if (pageContext.isClientSideNavigation) {
    if (isError) {
      objectAssign(pageContext, { [isServerSideError]: true })
    }
    const pageContextSerialized: string = getPageContextClientSerialized(pageContext, false)
    const httpResponse = await createHttpResponsePageJson(pageContextSerialized)
    objectAssign(pageContext, { httpResponse })
    return pageContext
  }

  if ((pageContext as typeof pageContext & PageContextRenderTarget)._renderTarget) {
    const pageContextRenderTarget = pageContext as typeof pageContext & PageContextRenderTarget
    const statusCode = getStatusCodePage(pageContext)
    const httpResponse = await renderTargetToHttpResponse(pageContextRenderTarget, statusCode)
    objectAssign(pageContext, { httpResponse })
    return pageContext
  }

  const renderHookResult = await execHookOnRenderHtml(pageContext)

  const { htmlRender, renderHook } = renderHookResult
  const httpResponse = await createHttpResponsePage(htmlRender, renderHook, pageContext)
  objectAssign(pageContext, { httpResponse })
  return pageContext
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

  const pageContextRenderTarget = pageContext as typeof pageContext & PageContextRenderTarget
  if (pageContextRenderTarget._renderTarget) {
    const { _renderTarget: renderTarget } = pageContextRenderTarget
    assertUsage(
      typeof renderTarget.prerender === 'object',
      `Cannot pre-render ${pc.cyan(pageContext.urlOriginal)} because render target ${pc.cyan(
        renderTarget.name,
      )} doesn't define prerender.filePath()`,
    )
    const httpResponse = await renderTargetToHttpResponse(pageContextRenderTarget, pageContext.is404 ? 404 : 200)
    const documentHtml = await httpResponse.getBody()
    return {
      documentHtml,
      pageContextSerialized: null,
      pageContext,
      renderTarget,
      contentType: httpResponse.headers.find(([name]) => name.toLowerCase() === 'content-type')?.[1],
    }
  }

  const { htmlRender, renderHook } = await execHookOnRenderHtml(pageContext)
  assertUsage(
    htmlRender !== null,
    `Cannot pre-render ${pc.cyan(pageContext.urlOriginal)} because the ${renderHook.hookName}() hook defined by ${
      renderHook.hookFilePath
    } didn't return an HTML string.`,
  )
  const documentHtml = await getHtmlString(htmlRender)
  assert(typeof documentHtml === 'string')
  if (!pageContext._usesClientRouter) {
    return { documentHtml, pageContextSerialized: null, pageContext, renderTarget: null, contentType: contentTypeHtml }
  }
  const pageContextSerialized = getPageContextClientSerialized(pageContext, false)
  return { documentHtml, pageContextSerialized, pageContext, renderTarget: null, contentType: contentTypeHtml }
}

async function renderTargetToHttpResponse(
  pageContext: PageContextRenderTarget & { pageId: string; headersResponse?: Headers },
  statusCode: number,
): Promise<HttpResponse> {
  const outcome = await renderWithRenderTarget(pageContext)
  return await createHttpResponseRenderTarget(pageContext, outcome, statusCode)
}

const contentTypeHtml = 'text/html;charset=utf-8'
