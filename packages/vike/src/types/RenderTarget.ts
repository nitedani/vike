export type { RenderTarget }
export type { RenderTargetPageConfigRef }
export type { RenderTargetRequestMeta }
export type { RenderTargetRequestAccess }
export type { RenderTargetRequestBodyAccess }
export type { RenderOutcome }
export type { ResponseIntent }
export type { ResponseArtifact }
export type { ResponseArtifactBody }

import type { Readable } from 'node:stream'
import type { PageContextServer } from './PageContext.js'

type MaybePromise<T> = T | Promise<T>

/** Request information that cannot consume the request body. */
type RenderTargetRequestMeta = {
  urlOriginal: string
  method: string
  headers: Headers
  isPrerendering: boolean
}

/** One-shot access to the request body. Calling one method makes every other method unavailable. */
type RenderTargetRequestBodyAccess = {
  arrayBuffer(): Promise<ArrayBuffer>
  text(): Promise<string>
  json(): Promise<unknown>
  formData(): Promise<FormData>
  stream(): ReadableStream<Uint8Array> | null
}

type RenderTargetRequestAccess = RenderTargetRequestMeta & {
  /** `null` when no Fetch `Request` is available or when pre-rendering. */
  body: RenderTargetRequestBodyAccess | null
}

/**
 * An environment-local page-config reference. It intentionally doesn't contain SSR-evaluated config values:
 * renderers load the reference in their own `renderRuntime`.
 */
type RenderTargetPageConfigRef = {
  pageId: string
  renderRuntime: string
}

type RenderOutcome<TRenderResult = unknown> =
  | {
      type: 'rendered'
      value: TRenderResult
    }
  | {
      type: 'redirect'
      url: string
      statusCode: number
    }
  | {
      type: 'fallback'
      reason: 'not-found' | 'error' | 'base-missing'
      error: unknown | null
    }

/** Vike's response intent. Core-owned headers are merged after `encodeOutcome()` returns. */
type ResponseIntent = {
  statusCode: number
  /**
   * Repeated entries are preserved. Extracting repeated `Set-Cookie` values from Vike's core `Headers` assumes
   * that the server runtime implements `Headers.getSetCookie()`, as supported Vike server runtimes do.
   */
  headers: readonly (readonly [string, string])[]
  isPrerendering: boolean
}

type ResponseArtifactBody = string | Uint8Array | ReadableStream<Uint8Array> | Readable

/**
 * A representation-specific, HTTP-construction-neutral response.
 *
 * Vike owns control until this artifact is returned. Once its stream is committed, redirects and errors are
 * representation-owned; Vike cannot replace already-emitted bytes.
 */
type ResponseArtifact = {
  statusCode: number
  headers: readonly (readonly [string, string])[]
  /** Reserved to the render target. Don't put `Content-Type` in `headers`. */
  contentType?: string
  body: ResponseArtifactBody
  onErrorWhileStreaming?: (error: unknown) => void
}

/** A representation adapter registered with `renderTargets`. */
type RenderTarget<TRequestData = unknown, TRenderResult = unknown> = {
  name: string
  /** Lifecycle hooks currently always execute in Vike's SSR runtime. */
  lifecycleRuntime: 'ssr'
  /** Runtime in which the target resolves its environment-local page-config reference. */
  renderRuntime: 'ssr' | (string & {})
  /** Body access is deliberately absent: matching must not consume the request body. */
  match(requestMeta: RenderTargetRequestMeta): MaybePromise<boolean>
  /** Called once, after this target is selected. When omitted, `requestData` is `undefined`. */
  prepareRequest?(requestAccess: RenderTargetRequestAccess): MaybePromise<TRequestData>
  render(
    pageContext: PageContextServer,
    pageConfigRef: RenderTargetPageConfigRef,
    requestData: TRequestData,
  ): MaybePromise<TRenderResult>
  /** Called for every terminal pre-commit outcome, including redirects and fallbacks. */
  encodeOutcome(outcome: RenderOutcome<TRenderResult>, responseIntent: ResponseIntent): MaybePromise<ResponseArtifact>
  prerender?:
    | false
    | {
        /** Exact output URL. It must be an absolute, normalized POSIX path without traversal. */
        filePath(input: { urlOriginal: string; contentType?: string }): string
      }
}
