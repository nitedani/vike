import { describe, expect, it } from 'vitest'
import { getConfigEnvValue, resolveRuntimeEnvironmentNamesFromSources } from './resolveVikeConfigInternal.js'
import type { ConfigValueSources } from '../../../types/PageConfig.js'
import { shouldInjectVikeBuildInputs } from '../plugins/build/pluginBuildConfig.js'

const errMsgIntro = 'Config meta defined at test sets meta.Page.env to' as const

describe('config environment names', () => {
  it('accepts an open environment map', () => {
    const env = { server: false, client: false, rsc: true, config: false, production: true }
    expect(getConfigEnvValue(env, errMsgIntro)).toEqual(env)
  })

  it.each(['ssr', 'shared', 'clear', 'default', 'eager', 'runtimes'])('rejects reserved name %s', (name) => {
    expect(() => getConfigEnvValue({ [name]: true }, errMsgIntro)).toThrow('is reserved by Vike')
  })

  it('includes an environment introduced only by meta.effect()', () => {
    const sources = {
      target: [{ configEnv: { server: false, client: false, rsc: true } }],
    } as unknown as ConfigValueSources
    const environmentNames = resolveRuntimeEnvironmentNamesFromSources(['server', 'client'], sources)
    expect(environmentNames).toEqual(['server', 'client', 'rsc'])
    expect(shouldInjectVikeBuildInputs('rsc', environmentNames)).toBe(false)
    expect(shouldInjectVikeBuildInputs('server', environmentNames)).toBe(true)
    expect(shouldInjectVikeBuildInputs('client', environmentNames)).toBe(true)
  })
})
