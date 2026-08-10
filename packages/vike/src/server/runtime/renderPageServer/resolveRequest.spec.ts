import { describe, expect, it } from 'vitest'
import { resolveRequest } from './resolveRequest.js'

describe('resolveRequest()', () => {
  it('keeps the hook request readable when middleware consumes the original', async () => {
    const original = new Request('http://localhost/action', { method: 'POST', body: 'payload' })
    const { request, requestForMiddleware } = resolveRequest({ urlOriginal: '/action', request: original }, true)

    expect(await requestForMiddleware!.text()).toBe('payload')
    expect(await request!.text()).toBe('payload')
  })

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
