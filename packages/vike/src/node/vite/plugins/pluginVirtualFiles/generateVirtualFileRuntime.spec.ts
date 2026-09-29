import { describe, expect, it } from 'vitest'
import { generateVirtualFileRuntimeCode } from './generateVirtualFileRuntime.js'

describe('generateVirtualFileRuntimeCode()', () => {
  it('does not eagerly load the SSR global entry when only environmentName is consumed', () => {
    const code = generateVirtualFileRuntimeCode('ssr', false, '/vike/dist/runtime/createRuntime.js')

    expect(code).toContain('export const environmentName = "ssr";')
    expect(code).not.toContain('import { pageConfigsSerialized')
    expect(code).toContain('loadPageConfigRuntimePromise ??= import("virtual:vike:global-entry:server").then')
  })

  it('loads each named environment global entry only upon loadPageConfig()', () => {
    const code = generateVirtualFileRuntimeCode('worker', true, '/vike/dist/runtime/createRuntime.js')

    expect(code).toContain('export const environmentName = "worker";')
    expect(code).toContain('loadPageConfigRuntimePromise ??= import("virtual:vike:global-entry:worker").then')
    expect(code.indexOf('export async function loadPageConfig')).toBeLessThan(
      code.indexOf('import("virtual:vike:global-entry:worker")'),
    )
  })

  it.each([
    ['ssr', 'virtual:vike:global-entry:server'],
    ['server', 'virtual:vike:global-entry:server'],
    ['client', 'virtual:vike:global-entry:client:client-routing'],
    ['rsc', 'virtual:vike:global-entry:rsc'],
    ['worker', 'virtual:vike:global-entry:worker'],
  ])('maps Vite environment %s to %s', (viteEnvironmentName, globalEntryId) => {
    const code = generateVirtualFileRuntimeCode(viteEnvironmentName, false, '/vike/dist/runtime/createRuntime.js')
    expect(code).toContain(`export const environmentName = ${JSON.stringify(viteEnvironmentName)};`)
    expect(code).toContain(`import(${JSON.stringify(globalEntryId)})`)
  })
})
