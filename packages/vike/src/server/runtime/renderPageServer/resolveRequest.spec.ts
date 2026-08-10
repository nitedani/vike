import { describe, expect, it } from 'vitest'
import { resolveRequest } from './resolveRequest.js'

describe('resolveRequest()', () => {
  it('does not clone without configured middleware', () => {
    const original = new Request('http://localhost/')
    const { request, requestForMiddleware } = resolveRequest({ urlOriginal: '/', request: original }, false)

    expect(request).toBe(original)
    expect(requestForMiddleware).toBeNull()
  })

  it('does not expose a Request when manual renderPage() callers omit it', () => {
    const { request, requestForMiddleware } = resolveRequest({ urlOriginal: '/manual' }, false)

    expect(request).toBeUndefined()
    expect(requestForMiddleware).toBeNull()
  })

  it('synthesizes a Request only for internal middleware dispatch', () => {
    const { request, requestForMiddleware } = resolveRequest({ urlOriginal: '/manual' }, true)

    expect(request).toBeUndefined()
    expect(requestForMiddleware).toBeInstanceOf(Request)
  })
})
