import { expect, fetch, getServerUrl, run, test } from '@brillout/test-e2e'
import { fixtureCommand, fixtureRunOptions, tolerateFixtureWarning } from './.testPageContextResponse'

run(fixtureCommand('empty', 3137), {
  ...fixtureRunOptions(3137),
  tolerateError: ({ logText }) => tolerateFixtureWarning(logText),
})

test('empty response', async () => {
  const response = await fetch(`${getServerUrl()}/empty`)

  expect(response.status).toBe(204)
  expect(await response.text()).toBe('')
})

test('empty response with a status that permits a body', async () => {
  const response = await fetch(`${getServerUrl()}/empty-200`)

  expect(response.status).toBe(200)
  expect(await response.text()).toBe('')
})
