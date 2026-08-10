import { expect, fetch, getServerUrl, run, test } from '@brillout/test-e2e'
import { fixtureCommand, fixtureRunOptions, tolerateFixtureWarning } from './.testPageContextResponse'

run(fixtureCommand('notFound', 3139), {
  ...fixtureRunOptions(3139),
  tolerateError({ logText }) {
    return tolerateFixtureWarning(logText) || logText.includes('No error page found')
  },
})

test('an error page encodes a missing route as custom content', async () => {
  const response = await fetch(`${getServerUrl()}/missing`, {
    headers: { Accept: 'application/x-vike-test' },
  })

  expect(response.status).toBe(404)
  expect(response.headers.get('content-type')).toBe('application/x-vike-test')
  expect(await response.json()).to.deep.equal({
    type: 'fallback',
    reason: 'not-found',
  })
})
