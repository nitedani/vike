import { describe, expect, it } from 'vitest'
import { createHttpResponseFromUniversalMiddleware } from './createHttpResponse.js'

describe('createHttpResponseFromUniversalMiddleware()', () => {
  it('preserves an intentionally empty response body', () => {
    const httpResponse = createHttpResponseFromUniversalMiddleware(new Response(null, { status: 204 }))

    expect(httpResponse.statusCode).toBe(204)
    expect(httpResponse.body).toBe('')
  })

  it('preserves repeated Set-Cookie headers', () => {
    const headers = new Headers()
    headers.append('Set-Cookie', 'session=one')
    headers.append('Set-Cookie', 'preference=two')
    const httpResponse = createHttpResponseFromUniversalMiddleware(new Response('ok', { headers }))

    expect(httpResponse.headers.filter(([name]) => name.toLowerCase() === 'set-cookie')).toEqual([
      ['set-cookie', 'session=one'],
      ['set-cookie', 'preference=two'],
    ])
  })
})
