export { resolveRenderTarget }
export { prepareRenderTarget }
export { renderWithRenderTarget }
export { createHttpResponseRenderTarget }
export type { PageContextRenderTarget }

import { assert, assertUsage } from '../../../utils/assert.js'
import { objectAssign } from '../../../utils/objectAssign.js'
import type { PageContextServer } from '../../../types/PageContext.js'
import type {
  RenderOutcome,
  RenderTarget,
  RenderTargetRequestAccess,
  RenderTargetRequestBodyAccess,
  RenderTargetRequestMeta,
  ResponseIntent,
} from '../../../types/RenderTarget.js'
import { getPageContextPublicServer } from './getPageContextPublicServer.js'
import { createHttpResponseArtifact, type HttpResponse } from './createHttpResponse.js'
import { resolveHeadersResponseFinal } from './headersResponse.js'
import '../../assertEnvServer.js'

type PageContextRenderTarget = {
  _renderTarget: RenderTarget | null
  _renderTargetRequestData: unknown
  urlOriginal: string
  headers: Record<string, string> | null
  isClientSideNavigation: boolean
  isPrerendering: boolean
}

async function resolveRenderTarget(
  pageContext: Omit<PageContextRenderTarget, '_renderTarget' | '_renderTargetRequestData'>,
  renderTargetValues: (RenderTarget | RenderTarget[])[] | undefined,
  runtimeEnvironmentNames: string[],
  request: Request | null,
): Promise<PageContextRenderTarget> {
  const renderTargets = (renderTargetValues ?? []).flat()
  assertRenderTargets(renderTargets, runtimeEnvironmentNames)

  // `.pageContext.json` is Vike's built-in client-navigation representation and remains reserved.
  if (pageContext.isClientSideNavigation || renderTargets.length === 0) {
    objectAssign(pageContext, { _renderTarget: null, _renderTargetRequestData: undefined })
    return pageContext
  }

  const requestMeta = getRequestMeta(pageContext, request)
  const matches = await Promise.all(
    renderTargets.map(async (renderTarget) => {
      const matches = await renderTarget.match(requestMeta)
      assertUsage(
        typeof matches === 'boolean',
        `renderTarget ${JSON.stringify(renderTarget.name)} match() should return a boolean`,
      )
      return matches ? renderTarget : null
    }),
  )
  const matched = matches.filter((renderTarget): renderTarget is RenderTarget => renderTarget !== null)
  assertUsage(
    matched.length <= 1,
    `Request ${pageContext.urlOriginal} matches multiple render targets: ${matched
      .map(({ name }) => JSON.stringify(name))
      .join(', ')}`,
  )
  objectAssign(pageContext, {
    _renderTarget: matched[0] ?? null,
    _renderTargetRequestData: undefined,
  })
  return pageContext
}

async function prepareRenderTarget(pageContext: PageContextRenderTarget, request: Request | null): Promise<void> {
  const { _renderTarget: renderTarget } = pageContext
  if (!renderTarget?.prepareRequest) return
  const requestMeta = getRequestMeta(pageContext, request)
  const requestAccess: RenderTargetRequestAccess = {
    ...requestMeta,
    body: request && !pageContext.isPrerendering ? createRequestBodyAccess(request, renderTarget.name) : null,
  }
  pageContext._renderTargetRequestData = await renderTarget.prepareRequest(requestAccess)
}

async function renderWithRenderTarget(
  pageContext: PageContextRenderTarget & { pageId: string },
): Promise<RenderOutcome> {
  const { _renderTarget: renderTarget } = pageContext
  assert(renderTarget)
  const pageConfigRef = {
    pageId: pageContext.pageId,
    renderRuntime: renderTarget.renderRuntime,
  }
  const value = await renderTarget.render(
    getPageContextPublicServer(pageContext as any) as PageContextServer,
    pageConfigRef,
    pageContext._renderTargetRequestData,
  )
  return { type: 'rendered', value }
}

async function createHttpResponseRenderTarget(
  pageContext: PageContextRenderTarget & { headersResponse?: Headers },
  outcome: RenderOutcome,
  statusCode: number,
): Promise<HttpResponse> {
  const { _renderTarget: renderTarget } = pageContext
  assert(renderTarget)
  const responseIntent: ResponseIntent = {
    statusCode,
    headers: resolveHeadersResponseFinal(pageContext, statusCode),
    isPrerendering: pageContext.isPrerendering,
  }
  const artifact = await renderTarget.encodeOutcome(outcome, responseIntent)
  return await createHttpResponseArtifact(artifact, responseIntent)
}

function getRequestMeta(
  pageContext: Pick<PageContextRenderTarget, 'urlOriginal' | 'headers' | 'isPrerendering'>,
  request: Request | null,
): RenderTargetRequestMeta {
  return {
    urlOriginal: pageContext.urlOriginal,
    method: request?.method ?? 'GET',
    headers: new Headers(request?.headers ?? pageContext.headers ?? undefined),
    isPrerendering: pageContext.isPrerendering,
  }
}

function createRequestBodyAccess(request: Request, renderTargetName: string): RenderTargetRequestBodyAccess {
  let claimed = false
  const claim = () => {
    assertUsage(
      !claimed && !request.bodyUsed,
      `Render target ${JSON.stringify(renderTargetName)} attempted to consume the request body more than once`,
    )
    claimed = true
  }
  return {
    arrayBuffer() {
      claim()
      return request.arrayBuffer()
    },
    text() {
      claim()
      return request.text()
    },
    json() {
      claim()
      return request.json()
    },
    formData() {
      claim()
      return request.formData()
    },
    stream() {
      claim()
      return request.body
    },
  }
}

function assertRenderTargets(renderTargets: RenderTarget[], runtimeEnvironmentNames: string[]): void {
  const names = new Set<string>()
  renderTargets.forEach((renderTarget) => {
    assertUsage(renderTarget && typeof renderTarget === 'object', 'renderTargets should contain objects')
    assertUsage(
      typeof renderTarget.name === 'string' && renderTarget.name.length > 0,
      'Each render target should have a non-empty name',
    )
    assertUsage(
      !names.has(renderTarget.name),
      `Render target name ${JSON.stringify(renderTarget.name)} is registered twice`,
    )
    names.add(renderTarget.name)
    assertUsage(
      renderTarget.lifecycleRuntime === 'ssr',
      `Render target ${JSON.stringify(renderTarget.name)} lifecycleRuntime should be "ssr"`,
    )
    assertUsage(
      renderTarget.renderRuntime === 'ssr' || runtimeEnvironmentNames.includes(renderTarget.renderRuntime),
      `Render target ${JSON.stringify(renderTarget.name)} uses undeclared renderRuntime ${JSON.stringify(
        renderTarget.renderRuntime,
      )}`,
    )
    assertUsage(
      typeof renderTarget.match === 'function',
      `Render target ${JSON.stringify(renderTarget.name)} is missing match()`,
    )
    assertUsage(
      renderTarget.prepareRequest === undefined || typeof renderTarget.prepareRequest === 'function',
      `Render target ${JSON.stringify(renderTarget.name)} prepareRequest should be a function`,
    )
    assertUsage(
      typeof renderTarget.render === 'function',
      `Render target ${JSON.stringify(renderTarget.name)} is missing render()`,
    )
    assertUsage(
      typeof renderTarget.encodeOutcome === 'function',
      `Render target ${JSON.stringify(renderTarget.name)} is missing encodeOutcome()`,
    )
    assertUsage(
      renderTarget.prerender === undefined ||
        renderTarget.prerender === false ||
        (typeof renderTarget.prerender === 'object' && typeof renderTarget.prerender.filePath === 'function'),
      `Render target ${JSON.stringify(renderTarget.name)} prerender should be false or { filePath() }`,
    )
  })
}
