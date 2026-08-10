import { expect, fetch, getServerUrl, run, test } from '@brillout/test-e2e'
import { fixtureCommand, fixtureRunOptions, tolerateFixtureWarning } from './.testPageContextResponse'

run(fixtureCommand('stream', 3143), {
  ...fixtureRunOptions(3143),
  tolerateError: ({ logText }) => tolerateFixtureWarning(logText),
})

test('Web ReadableStream response', async () => {
  const response = await fetch(`${getServerUrl()}/stream`, {
    headers: { Accept: 'application/x-vike-test' },
  })

  expect(response.status).toBe(200)
  expect(await response.text()).toBe('first chunk\nsecond chunk')
})
