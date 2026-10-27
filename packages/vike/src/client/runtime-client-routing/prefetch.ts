export { prefetch }
export { getPageContextPrefetched }
export { initLinkPrefetchHandlers }
export { populatePageContextPrefetchCache }
export { abortPrefetchesOfOtherPages }
export { addLinkPrefetchHandlers }
export { addLinkPrefetchHandlers_watch }
export { addLinkPrefetchHandlers_unwatch }

import { assert, assertUsage, assertWarning } from '../../utils/assert.js'
import { assertClientRouting, checkIfClientRouting } from '../../utils/assertRoutingType.js'
import { getGlobalObject } from '../../utils/getGlobalObject.js'
import { hasProp } from '../../utils/hasProp.js'
import { objectAssign } from '../../utils/objectAssign.js'
import { isErrorFetchingStaticAssets, loadPageConfigsLazyClientSide } from '../shared/loadPageConfigsLazyClientSide.js'
import { isLinkSkipped } from './isLinkSkipped.js'
import { disableClientRouting } from './renderPageClient.js'
import { isClientSideRoutable } from './isClientSideRoutable.js'
import { createPageContextClient, type PageContextCreatedClient } from './createPageContextClient.js'
import { route, type PageContextAfterRoute } from '../../shared-server-client/route/index.js'
import { noRouteMatch } from '../../shared-server-client/route/noRouteMatch.js'
import { type PageContextFromHooksServer, getPageContextFromHooksServer } from './getPageContextFromHooks.js'
import type { PageContextConfig, PageFile } from '../../shared-server-client/getPageFiles.js'
import { getPageContextCurrent } from './getPageContextCurrent.js'
import {
  PAGE_CONTEXT_MAX_AGE_DEFAULT,
  type PrefetchSettingResolved,
  getPrefetchSettings,
} from './prefetch/getPrefetchSettings.js'
import pc from '@brillout/picocolors'
import { normalizeUrlArgument } from './normalizeUrlArgument.js'
import type { GlobalContextClientInternal } from './getGlobalContextClientInternal.js'
import '../assertEnvClient.js'

assertClientRouting()
const globalObject = getGlobalObject('prefetch.ts', {
  linkPrefetchHandlerAdded: new WeakSet<HTMLElement>(),
  addLinkPrefetchHandlers_debounce: null as null | ReturnType<typeof setTimeout>,
  mutationObserver: new MutationObserver(addLinkPrefetchHandlers),
  // `linkTags` [is automatically updated](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCollection#:~:text=An%20HTMLCollection%20in%20the%20HTML%20DOM%20is%20live%3B%20it%20is%20automatically%20updated%20when%20the%20underlying%20document%20is%20changed.)
  linkTags: document.getElementsByTagName('A') as HTMLCollectionOf<HTMLAnchorElement>,
  prefetchedPageContexts: {} as Record<
    string, // URL
    PrefetchedPageContext
  >,
  // The prefetched pageContexts that may still be downloading their streamed values (https://vike.dev/passToClient#streaming)
  prefetchesStreaming: [] as { key: string; abortController: AbortController }[],
})

type ResultPageContextFromServer = Awaited<ReturnType<typeof getPageContextFromHooksServer>>
type PrefetchedPageContext = {
  resultFetchedAt: number
  resultMaxAge: number
  result: ResultPageContextFromServer
}
type PageContextForPrefetch = PageContextCreatedClient & {
  pageId: string
  abortSignal: AbortSignal
}

function getPageContextPrefetched(
  pageContext: {
    urlPathname: string
  } & PageContextConfig,
): null | PageContextFromHooksServer {
  const prefetchSettings = getPrefetchSettings(pageContext, null)
  // TO-DO/pageContext-prefetch: I guess we need linkTag to make this condition work
  if (!prefetchSettings.pageContext) return null
  const key = getCacheKey(pageContext.urlPathname)
  const found = globalObject.prefetchedPageContexts[key]
  if (!found || found.result.is404ServerSideRouted || isExpired(found)) return null
  const pageContextPrefetched = found.result.pageContextFromHooksServer
  /* TO-DO/pageContext-prefetch: make it work for when resultMaxAge is Infinity.
  // We discard the prefetched pageContext whenever we use it, so that the user always sees fresh data upon naivgating.
  delete globalObject.prefetchedPageContexts[key]
  */
  return pageContextPrefetched
}

async function prefetchAssets(pageContextLink: {
  pageId: string
  _pageFilesAll: PageFile[]
  _globalContext: GlobalContextClientInternal
}): Promise<void> {
  try {
    await loadPageConfigsLazyClientSide(
      pageContextLink.pageId,
      pageContextLink._pageFilesAll,
      pageContextLink._globalContext._pageConfigs,
      pageContextLink._globalContext._pageConfigGlobal,
    )
  } catch (err) {
    if (isErrorFetchingStaticAssets(err)) {
      disableClientRouting(err, true)
    } else {
      throw err
    }
  }
}

async function prefetchPageContextFromHooksServer(
  pageContextLink: PageContextForPrefetch,
  resultMaxAge: number | null,
): Promise<void> {
  // pageContextLink.abortSignal never aborts: the prefetch gets its own, which abortPrefetchesOfOtherPages() aborts upon a navigation elsewhere, if its pageContext was already received
  const abortController = new AbortController()
  const pageContextPrefetch = { ...pageContextLink, abortSignal: abortController.signal }
  const result = await getPageContextFromHooksServer(pageContextPrefetch, false)
  globalObject.prefetchesStreaming.push({ key: getCacheKey(pageContextLink.urlPathname), abortController })
  setPageContextPrefetchCache(pageContextPrefetch, result, resultMaxAge)
}
// Upon navigation: the pageContexts prefetched for other pages, once received, stop downloading their streamed values
function abortPrefetchesOfOtherPages(urlPathname: string): void {
  const key = getCacheKey(urlPathname)
  globalObject.prefetchesStreaming = globalObject.prefetchesStreaming.filter((prefetch) => {
    // The navigation may use the pageContext prefetched for its own page
    if (prefetch.key === key) return true
    prefetch.abortController.abort()
    return false
  })
}
function populatePageContextPrefetchCache(
  pageContext: PageContextForPrefetch /*& PageContextConfig*/,
  result: ResultPageContextFromServer,
): void {
  // TO-DO/pageContext-prefetch: replace with using pageContext.config.prerender instead. (For being able to do that: eager configs need to be accessible without have to use PageContextConfig as it isn't available here.)
  if (!isBrilloutDocpress()) return
  setPageContextPrefetchCache(pageContext, result, null)
}
function setPageContextPrefetchCache(
  pageContext: PageContextForPrefetch,
  result: ResultPageContextFromServer,
  resultMaxAge: number | null,
) {
  if (resultMaxAge === null) resultMaxAge = getResultMaxAge()
  const key = getCacheKey(pageContext.urlPathname)
  assert(isBrilloutDocpress()) // Ensure this API isn't used by anyone else
  const found: PrefetchedPageContext = {
    resultFetchedAt: Date.now(),
    resultMaxAge,
    result,
  }
  globalObject.prefetchedPageContexts[key] = found
  // Once pageContext.abortSignal aborts, the streamed values still pending never settle => the next navigation to the page fetches its pageContext anew
  // - An entry without pending values stays: @brillout/docpress caches pageContexts forever (`prefetch.pageContext: Infinity`)
  if (result.is404ServerSideRouted) return
  const { _hasPendingStreamedValues } = result.pageContextFromHooksServer
  if (!_hasPendingStreamedValues) return
  pageContext.abortSignal.addEventListener('abort', () => {
    if (globalObject.prefetchedPageContexts[key] === found && _hasPendingStreamedValues()) {
      delete globalObject.prefetchedPageContexts[key]
    }
  })
}
function getResultMaxAge(): number {
  const pageContextCurrent = getPageContextCurrent()
  // TO-DO/pageContext-prefetch: remove this dirty hack used by @brillout/docpress and, instead, use Vike's default if pageContextCurrent isn't defined yet.
  if (!pageContextCurrent) return Infinity
  const prefetchSettings = getPrefetchSettings(pageContextCurrent, null)
  const resultMaxAge =
    typeof prefetchSettings.pageContext === 'number' ? prefetchSettings.pageContext : PAGE_CONTEXT_MAX_AGE_DEFAULT
  return resultMaxAge
}

/**
 * Programmatically prefetch client assets.
 *
 * https://vike.dev/prefetch
 *
 * @param url - The URL of the page you want to prefetch.
 */
async function prefetch(
  url: string,
  /* TO-DO/pageContext-prefetch:
  options?: {
    pageContext?: boolean
    staticAssets?: boolean
  }
  */
  options_?: {
    pageContext?: boolean
  },
): Promise<void> {
  const options = {
    staticAssets: true,
    pageContext: options_?.pageContext ?? false,
  }

  assertUsage(checkIfClientRouting(), 'prefetch() only works with Client Routing, see https://vike.dev/prefetch', {
    showStackTrace: true,
  })
  url = normalizeUrlArgument(url, 'prefetch')

  const pageContextLink = await getPageContextLink(url)
  if (!pageContextLink?.pageId) {
    assertWarning(false, `[prefetch(url)] ${pc.string(url)} ${noRouteMatch}`, {
      showStackTrace: true,
      onlyOnce: false,
    })
    return
  }
  assert(hasProp(pageContextLink, 'pageId', 'string')) // help TypeScript

  await Promise.all([
    (async () => {
      if (options?.staticAssets !== false) {
        await prefetchAssets(pageContextLink)
      }
    })(),
    (async () => {
      if (options?.pageContext !== false) {
        assertUsage(isBrilloutDocpress(), "prefetching pageContext isn't supported yet")
        const resultMaxAge = typeof options?.pageContext === 'number' ? options.pageContext : null
        await prefetchPageContextFromHooksServer(pageContextLink, resultMaxAge)
      }
    })(),
  ])
}

// Lazy execution logic copied from: https://github.com/withastro/astro/blob/2594eb088d53a98181ac820243bcb1a765856ecf/packages/astro/src/runtime/client/dev-toolbar/apps/audit/index.ts#L53-L72
function addLinkPrefetchHandlers() {
  if (globalObject.addLinkPrefetchHandlers_debounce) clearTimeout(globalObject.addLinkPrefetchHandlers_debounce)
  globalObject.addLinkPrefetchHandlers_debounce = setTimeout(() => {
    // Wait for the next idle period, as it is less likely to interfere with any other work the browser is doing post-mutation.
    if ('requestIdleCallback' in window) {
      requestIdleCallback(addLinkPrefetchHandlers_apply, { timeout: 300 })
    } else {
      // Fallback for old versions of Safari, we'll assume that things are less likely to be busy after 150ms.
      setTimeout(addLinkPrefetchHandlers_apply, 150)
    }
  }, 250)
}
function initLinkPrefetchHandlers() {
  addLinkPrefetchHandlers()
}
function addLinkPrefetchHandlers_watch(): void {
  // Notes about performance:
  // - https://stackoverflow.com/questions/31659567/performance-of-mutationobserver-to-detect-nodes-in-entire-dom/39332340#39332340
  // - https://news.ycombinator.com/item?id=15274211
  //   - https://github.com/kubetail-org/sentineljs
  // - https://stackoverflow.com/questions/55046093/listening-for-changes-in-htmlcollection-or-achieving-a-similar-effect
  globalObject.mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
  })
}
function addLinkPrefetchHandlers_unwatch(): void {
  globalObject.mutationObserver.disconnect()
}
function addLinkPrefetchHandlers_apply(): void {
  for (let linkTag of globalObject.linkTags) {
    if (globalObject.linkPrefetchHandlerAdded.has(linkTag)) continue
    globalObject.linkPrefetchHandlerAdded.add(linkTag)

    if (isLinkSkipped(linkTag)) continue

    linkTag.addEventListener(
      'mouseover',
      () => {
        prefetchOnEvent(linkTag, 'hover')
      },
      { passive: true },
    )

    linkTag.addEventListener(
      'touchstart',
      () => {
        prefetchOnEvent(linkTag, 'hover')
      },
      { passive: true },
    )

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          prefetchOnEvent(linkTag, 'viewport')
        }
      })
    })
    observer.observe(linkTag)
  }
}

async function prefetchOnEvent(linkTag: HTMLAnchorElement, event: 'hover' | 'viewport'): Promise<void> {
  let prefetchSettings: PrefetchSettingResolved
  const pageContextCurrent = getPageContextCurrent()
  if (pageContextCurrent) {
    prefetchSettings = getPrefetchSettings(pageContextCurrent, linkTag)
  } else {
    if (isBrilloutDocpress()) {
      // TO-DO/pageContext-prefetch: remove this dirty hack used by @brillout/docpress and, instead, use Vike's default if pageContextCurrent isn't defined yet.
      prefetchSettings = { staticAssets: 'hover', pageContext: Infinity }
    } else {
      // TO-DO/pageContext-prefetch: consider pageContextLink
      return
    }
  }

  // Check again in case DOM was manipulated since last check
  if (isLinkSkipped(linkTag)) return

  const urlOfLink = linkTag.getAttribute('href')!

  const pageContextLink = await getPageContextLink(urlOfLink)
  if (!pageContextLink?.pageId) return
  assert(hasProp(pageContextLink, 'pageId', 'string')) // help TypeScript
  if (!(await isClientSideRoutable(pageContextLink.pageId, pageContextLink))) return

  await Promise.all([
    (async () => {
      if (prefetchSettings.staticAssets === event) {
        await prefetchAssets(pageContextLink)
      }
    })(),
    (async () => {
      if (event !== 'viewport' && prefetchSettings.pageContext) {
        const key = getCacheKey(urlOfLink)
        const found = globalObject.prefetchedPageContexts[key]
        if (!found || isExpired(found)) {
          // TO-DO/pageContext-prefetch: move this logic in getPrefetchSettings()
          const resultMaxAge = prefetchSettings.pageContext
          await prefetchPageContextFromHooksServer(pageContextLink, resultMaxAge)
        }
      }
    })(),
  ])
}

function isExpired(found: PrefetchedPageContext) {
  return Date.now() - found.resultFetchedAt > found.resultMaxAge
}

// TO-DO/next-major-release: make it sync
async function getPageContextLink(urlOfLink: string) {
  const pageContextLink = await createPageContextClient(urlOfLink)
  // https://vike.dev/pageContext#isPrefetch
  objectAssign(pageContextLink, { isPrefetch: true as const })

  // This `pageContext.abortSignal` is fake: it never aborts
  // - It's a fallback and its only purpose is to make sure pageContext.abortSignal is always defined, so that the user can simply always listen to `pageContext.abortSignal` => significant DX improvement for the user
  //   - So that, for example, toggling +prefetchStaticAssets doesn't break user code
  objectAssign(pageContextLink, { abortSignal: new AbortController().signal })

  let pageContextFromRoute: PageContextAfterRoute
  try {
    pageContextFromRoute = await route(pageContextLink)
  } catch {
    // If a route() hook has a bug or `throw render()` / `throw redirect()`
    return null
  }
  objectAssign(pageContextLink, pageContextFromRoute)

  return pageContextLink
}

function getCacheKey(url: string): string {
  if (url.startsWith('#')) url = '/'
  assert(url.startsWith('/'), { urlPathname: url })
  const key = url.split('#')[0]!
  return key
}

// TO-DO/pageContext-prefetch: remove
function isBrilloutDocpress(): boolean {
  return '_isBrilloutDocpress' in window
}
