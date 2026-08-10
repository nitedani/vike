import { describe, expect, it } from 'vitest'
import { getPageId } from './handleAssetsManifest.js'

describe('asset manifest page entries', () => {
  it('accepts a direct Vike page entry', () => {
    expect(getPageId('virtual:vike:page-entry:client:/pages/index')).toBe('/pages/index')
  })

  it('accepts Vite relative-path prefixes', () => {
    expect(getPageId('../../virtual:vike:page-entry:worker:/pages/index')).toBe('/pages/index')
  })

  it('rejects a third-party virtual ID that wraps a Vike page entry', () => {
    expect(getPageId('virtual:other-plugin:facade:virtual:vike:page-entry:server:/pages/index')).toBeNull()
  })
})
