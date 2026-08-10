export { getHttpResponseBody }
export { getHttpResponseBodyStreamHandlers }
export type { HttpResponseBody }

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
import pc from '@brillout/picocolors'
import '../../assertEnvServer.js'

const streamDocs = 'See https://vike.dev/streaming for more information.'

type HttpResponseBody = {
  body: string
  pipe: (writable: StreamWritableWeb | StreamWritableNode) => void
  getReadableWebStream: () => StreamReadableWeb
  getReadableNodeStream: () => Promise<StreamReadableNode>
  getBody: () => Promise<string>
  /** @deprecated */
  getNodeStream: () => Promise<StreamReadableNode>
  /** @deprecated */
  getWebStream: () => StreamReadableWeb
  /** @deprecated */
  pipeToNodeWritable: StreamPipeNode
  /** @deprecated */
  pipeToWebWritable: StreamPipeWeb
}

type BodyHook = { hookFilePath: string; hookName: string }

function getHttpResponseBody(responseBody: HtmlRender, renderHook: null | BodyHook) {
  if (typeof responseBody !== 'string') {
    assertUsage(
      false,
      getErrMsg(responseBody, renderHook, 'body', `Use ${pc.cyan('pageContext.httpResponse.pipe()')} instead`),
    )
  }
  return responseBody
}

function getHttpResponseBodyStreamHandlers(responseBody: HtmlRender, renderHook: null | BodyHook) {
  return {
    pipe(writable: StreamWritableNode | StreamWritableWeb) {
      const getErrMsgMixingStreamTypes = (writableType: 'Web Writable' | 'Node.js Writable') =>
        `The ${getErrMsgBody(responseBody, renderHook)} while a ${
          writableType as string
        } was passed to pageContext.httpResponse.pipe() which is contradictory. You cannot mix a Web Stream with a Node.js Stream.` as const
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
      assertUsage(
        false,
        `The argument ${pc.cyan('writable')} passed to ${pc.cyan(
          'pageContext.httpResponse.pipe(writable)',
        )} doesn't seem to be ${getStreamName('writable', 'web')} nor ${getStreamName('writable', 'node')}.`,
      )
    },
    getReadableWebStream() {
      const webStream = getStreamReadableWeb(responseBody)
      if (webStream === null) {
        assertUsage(false, getErrMsg(responseBody, renderHook, 'getReadableWebStream()', getFixMsg('readable', 'web')))
      }
      return webStream
    },
    async getReadableNodeStream() {
      const nodeStream = await getStreamReadableNode(responseBody)
      if (nodeStream === null) {
        assertUsage(
          false,
          getErrMsg(responseBody, renderHook, 'getReadableNodeStream()', getFixMsg('readable', 'node')),
        )
      }
      return nodeStream
    },
    async getBody(): Promise<string> {
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

function getErrMsg(responseBody: HtmlRender, renderHook: null | BodyHook, method: string, msgAddendum?: string) {
  assert(!msgAddendum || !msgAddendum.endsWith('.'))
  const errMsgBody = getErrMsgBody(responseBody, renderHook)
  return [`pageContext.httpResponse.${method} can't be used because the ${errMsgBody}`, msgAddendum, streamDocs]
    .filter(Boolean)
    .join('. ')
}
function getErrMsgBody(responseBody: HtmlRender, renderHook: null | BodyHook) {
  if (!renderHook) return `response body is ${getHookReturnType(responseBody)}`
  const { hookFilePath, hookName } = renderHook
  const hookReturnType = getHookReturnType(responseBody)
  assert(['a ', 'an ', 'the '].some((s) => hookReturnType.startsWith(s)))
  const errMsgBody = `${hookName as string}()\ hook defined by ${hookFilePath} provides ${
    hookReturnType as string
  }` as const
  assert(!errMsgBody.endsWith(' '))
  return errMsgBody
}
function getHookReturnType(responseBody: HtmlRender) {
  if (typeof responseBody === 'string') {
    return 'an HTML string'
  } else if (isStream(responseBody)) {
    return inferStreamName(responseBody)
  } else {
    assert(false)
  }
}
