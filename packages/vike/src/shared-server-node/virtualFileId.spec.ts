import { describe, expect, it } from 'vitest'
import { generateVirtualFileId, parseVirtualFileId } from './virtualFileId.js'

describe('named virtual file IDs', () => {
  it('keeps legacy page-entry IDs unchanged', () => {
    expect(generateVirtualFileId({ type: 'page-entry', pageId: '/some-page', isForClientSide: true })).toBe(
      'virtual:vike:page-entry:client:/some-page',
    )
    expect(generateVirtualFileId({ type: 'page-entry', pageId: '/some-page', isForClientSide: false })).toBe(
      'virtual:vike:page-entry:server:/some-page',
    )
  })

  it('round-trips an exact named page-entry identity', () => {
    const id = generateVirtualFileId({ type: 'page-entry', environmentName: 'worker', pageId: '/some-page' })
    expect(id).toBe('virtual:vike:page-entry:worker:/some-page')
    expect(parseVirtualFileId(id)).toStrictEqual({
      type: 'page-entry',
      environmentName: 'worker',
      isForClientSide: false,
      pageId: '/some-page',
      isExtractAssets: false,
    })
  })

  it('preserves ROOT serialization for named page entries', () => {
    const id = generateVirtualFileId({ type: 'page-entry', environmentName: 'worker', pageId: '/' })
    expect(id).toBe('virtual:vike:page-entry:worker:ROOT')
    expect(parseVirtualFileId(id)).toMatchObject({ environmentName: 'worker', pageId: '/' })
  })

  it('round-trips named global and runtime IDs', () => {
    const globalId = generateVirtualFileId({ type: 'global-entry', environmentName: 'worker' })
    expect(globalId).toBe('virtual:vike:global-entry:worker')
    expect(parseVirtualFileId(globalId)).toStrictEqual({
      type: 'global-entry',
      environmentName: 'worker',
      isForClientSide: false,
      isClientRouting: false,
    })

    const runtimeId = generateVirtualFileId({ type: 'runtime', environmentName: 'worker' })
    expect(parseVirtualFileId(runtimeId)).toStrictEqual({ type: 'runtime', environmentName: 'worker' })
  })
})
