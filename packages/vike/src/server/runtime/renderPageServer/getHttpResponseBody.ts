export { getHttpResponseBody }
export { getHttpResponseBodyStreamHandlers }
export type { HttpResponseBody }
export type { ResponseBody }

import {
  StreamPipeNode,
  StreamPipeWeb,
  StreamReadableNode,
  StreamReadableWeb,
  StreamWritableNode,
  StreamWritableWeb,
  isStream,
  getStreamName,
  inferStreamName,
  isStreamWritableWeb,
  isStreamWritableNode,
  isStreamReadableWeb,
  isStreamReadableNode,
  isStreamPipeWeb,
  isStreamPipeNode,
  getStreamReadableNode,
  getStreamReadableWeb,
  pipeToStreamWritableWeb,
  pipeToStreamWritableNode,
} from './html/stream.js'
import { assert, assertUsage, assertWarning } from '../../../utils/assert.js'
import { getHtmlString, type HtmlRender } from './html/renderHtml.js'
import type { RenderHook } from './execHookOnRenderHtml.js'
import pc from '@brillout/picocolors'
import { import_ } from '@brillout/import'
import '../../assertEnvServer.js'

const streamDocs = 'See https://vike.dev/streaming for more information.'

type HttpResponseBody = {
  body: string | Uint8Array<ArrayBuffer>
  pipe: (writable: StreamWritableWeb | StreamWritableNode) => void
  getReadableWebStream: () => StreamReadableWeb
  getReadableNodeStream: () => Promise<StreamReadableNode>
  getBody: () => Promise<string | Uint8Array<ArrayBuffer>>
  /** @deprecated */
  getNodeStream: () => Promise<StreamReadableNode>
  /** @deprecated */
  getWebStream: () => StreamReadableWeb
  /** @deprecated */
  pipeToNodeWritable: StreamPipeNode
  /** @deprecated */
  pipeToWebWritable: StreamPipeWeb
}

type ResponseBody = HtmlRender | Uint8Array
type ResponseBodyKind = 'html' | 'artifact'

function getHttpResponseBody(
  responseBody: ResponseBody,
  renderHook: null | RenderHook,
): string | Uint8Array<ArrayBuffer> {
  if (typeof responseBody !== 'string' && !(responseBody instanceof Uint8Array)) {
    assertUsage(
      false,
      getErrMsg(responseBody, renderHook, 'body', `Use ${pc.cyan('pageContext.httpResponse.pipe()')} instead`),
    )
  }
  const body = responseBody
  // BodyInit implementations such as Cloudflare's require an ArrayBuffer-backed view.
  return body instanceof Uint8Array ? new Uint8Array(body) : body
}

function getHttpResponseBodyStreamHandlers(
  responseBody: ResponseBody,
  renderHook: null | RenderHook,
  bodyKind: ResponseBodyKind = 'html',
) {
  return {
    pipe(writable: StreamWritableNode | StreamWritableWeb) {
      const getErrMsgMixingStreamTypes = (writableType: 'Web Writable' | 'Node.js Writable') =>
        `The ${getErrMsgBody(responseBody, renderHook)} while a ${
          writableType as string
        } was passed to pageContext.httpResponse.pipe() which is contradictory. You cannot mix a Web Stream with a Node.js Stream.` as const
      if (responseBody instanceof Uint8Array) {
        if (isStreamWritableWeb(writable)) {
          const writer = writable.getWriter()
          void writer.write(responseBody).then(() => writer.close())
          return
        }
        if (isStreamWritableNode(writable)) {
          writable.write(responseBody)
          writable.end()
          return
        }
      } else {
        if (isStreamWritableWeb(writable)) {
          const success = pipeToStreamWritableWeb(responseBody, writable)
          if (success) {
            return
          } else {
            assert(isStreamReadableNode(responseBody) || isStreamPipeNode(responseBody))
            assertUsage(false, getErrMsgMixingStreamTypes('Web Writable'))
          }
        }
        if (isStreamWritableNode(writable)) {
          const success = pipeToStreamWritableNode(responseBody, writable)
          if (success) {
            return
          } else {
            assert(isStreamReadableWeb(responseBody) || isStreamPipeWeb(responseBody))
            assertUsage(false, getErrMsgMixingStreamTypes('Node.js Writable'))
          }
        }
      }
      assertUsage(
        false,
        `The argument ${pc.cyan('writable')} passed to ${pc.cyan(
          'pageContext.httpResponse.pipe(writable)',
        )} doesn't seem to be ${getStreamName('writable', 'web')} nor ${getStreamName('writable', 'node')}.`,
      )
    },
    getReadableWebStream() {
      if (responseBody instanceof Uint8Array) return uint8ArrayToReadableWebStream(responseBody)
      const webStream = getStreamReadableWeb(responseBody)
      if (webStream === null) {
        assertUsage(false, getErrMsg(responseBody, renderHook, 'getReadableWebStream()', getFixMsg('readable', 'web')))
      }
      return webStream
    },
    async getReadableNodeStream() {
      if (responseBody instanceof Uint8Array) return await uint8ArrayToReadableNodeStream(responseBody)
      const nodeStream = await getStreamReadableNode(responseBody)
      if (nodeStream === null) {
        assertUsage(
          false,
          getErrMsg(responseBody, renderHook, 'getReadableNodeStream()', getFixMsg('readable', 'node')),
        )
      }
      return nodeStream
    },
    async getBody(): Promise<string | Uint8Array<ArrayBuffer>> {
      if (responseBody instanceof Uint8Array) return new Uint8Array(responseBody)
      if (bodyKind === 'artifact' && typeof responseBody !== 'string') {
        return await streamToUint8Array(responseBody)
      }
      return await getHtmlString(responseBody)
    },
    // TO-DO/next-major-release: remove
    async getNodeStream() {
      assertWarning(
        false,
        '`pageContext.httpResponse.getNodeStream()` is outdated, use `pageContext.httpResponse.getReadableNodeStream()` instead. ' +
          streamDocs,
        { onlyOnce: true, showStackTrace: true },
      )
      if (responseBody instanceof Uint8Array) return await uint8ArrayToReadableNodeStream(responseBody)
      const nodeStream = await getStreamReadableNode(responseBody)
      if (nodeStream === null) {
        assertUsage(false, getErrMsg(responseBody, renderHook, 'getNodeStream()', getFixMsg('readable', 'node')))
      }
      return nodeStream
    },
    // TO-DO/next-major-release: remove
    getWebStream() {
      assertWarning(
        false,
        '`pageContext.httpResponse.getWebStream(res)` is outdated, use `pageContext.httpResponse.getReadableWebStream(res)` instead. ' +
          streamDocs,
        { onlyOnce: true, showStackTrace: true },
      )
      if (responseBody instanceof Uint8Array) return uint8ArrayToReadableWebStream(responseBody)
      const webStream = getStreamReadableWeb(responseBody)
      if (webStream === null) {
        assertUsage(false, getErrMsg(responseBody, renderHook, 'getWebStream()', getFixMsg('readable', 'web')))
      }
      return webStream
    },
    // TO-DO/next-major-release: remove
    pipeToWebWritable(writable: StreamWritableWeb) {
      assertWarning(
        false,
        '`pageContext.httpResponse.pipeToWebWritable(res)` is outdated, use `pageContext.httpResponse.pipe(res)` instead. ' +
          streamDocs,
        { onlyOnce: true, showStackTrace: true },
      )
      if (responseBody instanceof Uint8Array) {
        const writer = writable.getWriter()
        void writer.write(responseBody).then(() => writer.close())
        return
      }
      const success = pipeToStreamWritableWeb(responseBody, writable)
      if (!success) {
        assertUsage(false, getErrMsg(responseBody, renderHook, 'pipeToWebWritable()'))
      }
    },
    // TO-DO/next-major-release: remove
    pipeToNodeWritable(writable: StreamWritableNode) {
      assertWarning(
        false,
        '`pageContext.httpResponse.pipeToNodeWritable(res)` is outdated, use `pageContext.httpResponse.pipe(res)` instead. ' +
          streamDocs,
        { onlyOnce: true, showStackTrace: true },
      )
      if (responseBody instanceof Uint8Array) {
        writable.write(responseBody)
        writable.end()
        return
      }
      const success = pipeToStreamWritableNode(responseBody, writable)
      if (!success) {
        assertUsage(false, getErrMsg(responseBody, renderHook, 'pipeToNodeWritable()'))
      }
    },
  }

  function getFixMsg(kind: 'pipe' | 'readable', type: 'web' | 'node') {
    const streamName = getStreamName(kind, type)
    assert(['a ', 'an ', 'the '].some((s) => streamName.startsWith(s)))
    if (!renderHook) return `Use ${streamName} instead`
    const { hookFilePath, hookName } = renderHook
    return `Make sure the ${hookName}() hook defined by ${hookFilePath} provides ${streamName} instead`
  }
}

function getErrMsg(responseBody: ResponseBody, renderHook: null | RenderHook, method: string, msgAddendum?: string) {
  assert(!msgAddendum || !msgAddendum.endsWith('.'))
  const errMsgBody = getErrMsgBody(responseBody, renderHook)
  return [`pageContext.httpResponse.${method} can't be used because the ${errMsgBody}`, msgAddendum, streamDocs]
    .filter(Boolean)
    .join('. ')
}
function getErrMsgBody(responseBody: ResponseBody, renderHook: null | RenderHook) {
  if (!renderHook) {
    const bodyType = getHookReturnType(responseBody)
    return `render target response body is ${bodyType}`
  }
  const { hookFilePath, hookName } = renderHook
  const hookReturnType = getHookReturnType(responseBody)
  assert(['a ', 'an ', 'the '].some((s) => hookReturnType.startsWith(s)))
  const errMsgBody = `${hookName as string}()\ hook defined by ${hookFilePath} provides ${
    hookReturnType as string
  }` as const
  assert(!errMsgBody.endsWith(' '))
  return errMsgBody
}
function getHookReturnType(responseBody: ResponseBody) {
  if (typeof responseBody === 'string') {
    return 'an HTML string'
  } else if (responseBody instanceof Uint8Array) {
    return 'a Uint8Array'
  } else if (isStream(responseBody)) {
    return inferStreamName(responseBody)
  } else {
    assert(false)
  }
}

function uint8ArrayToReadableWebStream(body: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(body)
      controller.close()
    },
  })
}

async function uint8ArrayToReadableNodeStream(body: Uint8Array): Promise<StreamReadableNode> {
  const { Readable } = (await import_('node:stream')) as typeof import('node:stream')
  return Readable.from([body])
}

async function streamToUint8Array(
  stream: Exclude<ResponseBody, string | Uint8Array>,
): Promise<Uint8Array<ArrayBuffer>> {
  const chunks: Uint8Array[] = []
  if (isStreamReadableWeb(stream)) {
    const reader = stream.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(toUint8Array(value))
    }
  } else if (isStreamReadableNode(stream)) {
    for await (const chunk of stream as AsyncIterable<unknown>) chunks.push(toUint8Array(chunk))
  } else {
    assert(false)
  }
  const byteLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
  const body = new Uint8Array(byteLength)
  let offset = 0
  chunks.forEach((chunk) => {
    body.set(chunk, offset)
    offset += chunk.byteLength
  })
  return body
}

function toUint8Array(chunk: unknown): Uint8Array {
  if (chunk instanceof Uint8Array) return chunk
  if (typeof chunk === 'string') return new TextEncoder().encode(chunk)
  if (chunk instanceof ArrayBuffer) return new Uint8Array(chunk)
  assert(false, { chunk })
}
