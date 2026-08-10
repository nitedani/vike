import { expect, fetch, getServerUrl, run, test } from '@brillout/test-e2e'
import { fixtureCommand, fixtureRunOptions, tolerateFixtureWarning } from './.testPageContextResponse'

run(fixtureCommand('redirect', 3140), {
  ...fixtureRunOptions(3140),
  tolerateError: ({ logText }) => tolerateFixtureWarning(logText),
})

test('redirect() is encoded by the page render hook', async () => {
  const response = await fetch(`${getServerUrl()}/redirect`, {
    headers: { Accept: 'application/x-vike-test' },
    redirect: 'manual',
  })

  expect(response.status).toBe(200)
  expect(response.headers.get('location')).toBe(null)
  expect(await response.json()).to.deep.equal({ redirect: '/' })
})
