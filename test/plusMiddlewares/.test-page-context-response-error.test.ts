import { expect, fetch, getServerUrl, run, test } from '@brillout/test-e2e'
import { fixtureCommand, fixtureRunOptions, tolerateFixtureWarning } from './.testPageContextResponse'

run(fixtureCommand('renderError', 3141), {
  ...fixtureRunOptions(3141),
  tolerateError({ logText }) {
    return (
      tolerateFixtureWarning(logText) ||
      logText.includes('Data loading failed') ||
      (logText.includes('HTTP response') && logText.includes('500'))
    )
  },
})

test('a render error is encoded as custom content', async () => {
  const response = await fetch(getServerUrl(), { headers: { Accept: 'application/x-vike-test' } })

  expect(response.status).toBe(500)
  const body = (await response.json()) as { error: string }
  expect(body.error).toContain('Data loading failed')
})
