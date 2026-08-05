import type { Config, RenderTarget } from 'vike/types'

type RequestData = { method: string }

const typedTarget: RenderTarget<RequestData, Uint8Array> = {
  name: 'typed-target',
  lifecycleRuntime: 'ssr',
  renderRuntime: 'ssr',
  match() {
    return true
  },
  prepareRequest(requestAccess) {
    return { method: requestAccess.method }
  },
  render(_pageContext, _pageConfigRef, requestData) {
    const requestDataTyped: RequestData = requestData
    return new TextEncoder().encode(requestDataTyped.method)
  },
  encodeOutcome(outcome) {
    if (outcome.type === 'rendered') {
      const bodyTyped: Uint8Array = outcome.value
      return { statusCode: 200, headers: [], body: bodyTyped }
    }
    return { statusCode: outcome.type === 'redirect' ? outcome.statusCode : 500, headers: [], body: '' }
  },
}

const config: Config = { renderTargets: typedTarget }

void config
