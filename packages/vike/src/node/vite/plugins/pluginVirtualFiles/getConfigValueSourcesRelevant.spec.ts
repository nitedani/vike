import { describe, expect, it } from 'vitest'
import { isRuntimeEnvMatch } from './getConfigValueSourcesRelevant.js'

describe('isRuntimeEnvMatch()', () => {
  it('matches named runtimes exactly', () => {
    const configEnv = { server: true, client: true, runtimes: ['worker', 'edge'] }
    expect(isRuntimeEnvMatch(configEnv, { environmentName: 'worker' })).toBe(true)
    expect(isRuntimeEnvMatch(configEnv, { environmentName: 'edge' })).toBe(true)
    expect(isRuntimeEnvMatch(configEnv, { environmentName: 'other' })).toBe(false)
  })

  it('preserves legacy boolean matching', () => {
    expect(isRuntimeEnvMatch({ server: true }, { isForClientSide: false, isClientRouting: false })).toBe(true)
    expect(isRuntimeEnvMatch({ server: true }, { isForClientSide: true, isClientRouting: true })).toBe(false)
    expect(isRuntimeEnvMatch({ client: true }, { isForClientSide: true, isClientRouting: false })).toBe(true)
    expect(isRuntimeEnvMatch({ client: 'if-client-routing' }, { isForClientSide: true, isClientRouting: false })).toBe(
      false,
    )
  })

  it('does not collapse a named-only config into the server branch', () => {
    const configEnv = { server: false, client: false, runtimes: ['worker'] }
    expect(isRuntimeEnvMatch(configEnv, { environmentName: 'worker' })).toBe(true)
    expect(isRuntimeEnvMatch(configEnv, { isForClientSide: false, isClientRouting: false })).toBe(false)
    expect(isRuntimeEnvMatch(configEnv, { isForClientSide: true, isClientRouting: true })).toBe(false)
  })
})
