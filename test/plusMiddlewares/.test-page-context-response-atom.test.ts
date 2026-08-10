import { expect, fetch, getServerUrl, run, test } from '@brillout/test-e2e'
import { fixtureCommand, fixtureRunOptions, tolerateFixtureWarning } from './.testPageContextResponse'

run(fixtureCommand('atom', 3138), {
  ...fixtureRunOptions(3138),
  tolerateError: ({ logText }) => tolerateFixtureWarning(logText),
})

test('Atom response', async () => {
  const response = await fetch(`${getServerUrl()}/feed.atom`)

  expect(response.status).toBe(200)
  expect(response.headers.get('content-type')).toBe('application/atom+xml;charset=utf-8')
  expect(await response.text()).toContain('<title>Vike Feed</title>')
})
