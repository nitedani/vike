import { describe, expect, it } from 'vitest'
import type { ViteManifest } from '../../../../types/ViteManifest.js'
import type { RuntimeEnvironmentDeclaration } from '../../../../types/Config.js'
import { addServerAssets, getPageEntry, resolveAssetParticipants } from './handleAssetsManifest.js'

describe('asset manifest participants', () => {
  it('keeps the legacy path when no roles are declared', () => {
    expect(resolveAssetParticipants(undefined)).toBeNull()
    expect(resolveAssetParticipants([])).toBeNull()
  })

  it('only parses Vike-owned manifest keys', () => {
    expect(getPageEntry('virtual:vike:page-entry:client:/pages/index')).toEqual({
      environmentName: 'client',
      pageId: '/pages/index',
    })
    expect(getPageEntry('../../virtual:vike:page-entry:worker:/pages/index')).toEqual({
      environmentName: 'worker',
      pageId: '/pages/index',
    })
    expect(getPageEntry('virtual:other-plugin:facade:virtual:vike:page-entry:server:/pages/index')).toBeNull()
  })

  it('correlates pages by environment and page ID', () => {
    const producerManifest: ViteManifest = {
      'virtual:vike:page-entry:browser:/pages/index': {
        file: 'assets/browser.aaa.js',
        css: ['assets/browser.aaa.css'],
      },
      'virtual:other-plugin:facade:virtual:vike:page-entry:worker:/pages/index': {
        file: 'assets/facade.bbb.js',
        css: ['assets/facade.bbb.css'],
      },
    }
    const finalizerManifest: ViteManifest = {
      'virtual:vike:page-entry:worker:/pages/index': {
        file: 'assets/worker.ccc.js',
        css: ['assets/worker.ccc.css'],
      },
    }

    const result = addServerAssets(producerManifest, finalizerManifest, {
      producer: 'browser',
      finalizer: 'worker',
    })

    expect(result.filesToMove).toEqual(['assets/worker.ccc.css'])
    expect(producerManifest['virtual:vike:page-entry:browser:/pages/index']!.css).toEqual([
      'assets/browser.aaa.css',
      'assets/worker.ccc.css',
    ])
  })

  it('still rejects a true duplicate of the same environment/page pair', () => {
    const producerManifest: ViteManifest = {
      'virtual:vike:page-entry:browser:/pages/index': { file: 'assets/one.aaa.js' },
      '../../virtual:vike:page-entry:browser:/pages/index': { file: 'assets/two.bbb.js' },
    }

    expect(() => addServerAssets(producerManifest, {}, { producer: 'browser', finalizer: 'worker' })).toThrow()
  })

  it('uses explicit producer/finalizer edges and leaves private renderers out', () => {
    const declarations: RuntimeEnvironmentDeclaration[] = [
      { name: 'rsc', assets: { role: 'renderer-private' } },
      { name: 'browser-worker', assets: { role: 'browser-producer' } },
      { name: 'worker', assets: { role: 'consumer-finalizer', target: 'browser-worker' } },
    ]
    const participants = resolveAssetParticipants(declarations)!

    expect(participants.get('rsc')!.assets.role).toBe('renderer-private')
    expect(participants.get('ssr')!.assets).toEqual({ role: 'consumer-finalizer', target: 'client' })
    expect(participants.get('worker')!.assets).toEqual({
      role: 'consumer-finalizer',
      target: 'browser-worker',
    })
  })
})
