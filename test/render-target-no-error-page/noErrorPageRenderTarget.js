export const noErrorPageRenderTarget = {
  name: 'no-error-page-atom',
  lifecycleRuntime: 'ssr',
  renderRuntime: 'ssr',
  match({ urlOriginal }) {
    return new URL(urlOriginal, 'http://localhost').pathname.endsWith('.atom')
  },
  render() {
    throw new Error('render() must not run for a missing route without an error page')
  },
  encodeOutcome(outcome, responseIntent) {
    if (outcome.type !== 'fallback') throw new Error(`Expected fallback outcome, received ${outcome.type}`)
    return {
      statusCode: responseIntent.statusCode,
      headers: [
        ['X-Render-Outcome', outcome.type],
        ['X-Fallback-Reason', outcome.reason],
        ['X-Response-Intent-Status', String(responseIntent.statusCode)],
      ],
      contentType: 'application/problem+json',
      body: JSON.stringify({ type: outcome.type, reason: outcome.reason }),
    }
  },
}
