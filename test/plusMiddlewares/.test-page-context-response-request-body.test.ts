import { expect, fetch, getServerUrl, run, test } from '@brillout/test-e2e'
import { fixtureCommand, fixtureRunOptions, tolerateFixtureWarning } from './.testPageContextResponse'

run(fixtureCommand('requestBody', 3142), {
  ...fixtureRunOptions(3142),
  tolerateError: ({ logText }) => tolerateFixtureWarning(logText),
})

test('onRenderHtml reads the Web Request body', async () => {
  const response = await fetch(`${getServerUrl()}/action`, { method: 'POST', body: 'server action payload' })

  expect(response.status).toBe(200)
  expect(await response.json()).to.deep.equal({ body: 'server action payload' })
})
