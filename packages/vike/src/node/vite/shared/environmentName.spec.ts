import { describe, expect, it } from 'vitest'
import { getVikeEnvironmentName, isVikeEnvironmentBuiltIn } from './environmentName.js'

describe('getVikeEnvironmentName()', () => {
  it.each([
    ['ssr', 'server'],
    ['server', 'server'],
    ['client', 'client'],
    ['rsc', 'rsc'],
    ['worker', 'worker'],
  ])('%s => %s', (viteEnvironmentName, environmentName) => {
    expect(getVikeEnvironmentName(viteEnvironmentName)).toBe(environmentName)
  })
})

describe('isVikeEnvironmentBuiltIn()', () => {
  it.each([
    ['server', true],
    ['client', true],
    ['ssr', false],
    ['rsc', false],
  ])('%s => %s', (environmentName, expected) => {
    expect(isVikeEnvironmentBuiltIn(environmentName)).toBe(expected)
  })
})
