export { testHydrationNotAborted }

import { autoRetry, expect, getServerUrl, page, test } from '@brillout/test-e2e'
import { ensureWasClientSideRouted, expectUrl, testCounter } from '../../../utils'

function testHydrationNotAborted() {
  test('hydrationCanBeAborted: false — link clicked during +onHydrationEnd', async () => {
    await page.goto(getServerUrl() + '/hydration-not-aborted')
    await testCounter()
    await page.click('a[href="/markdown"]')
    await autoRetry(async () => {
      expect(await page.textContent('h1')).toBe('Side export .md file')
    })
    await expectUrl('/markdown')
    await ensureWasClientSideRouted('/pages/hydration-not-aborted/index')
  })
  test('hydrationCanBeAborted: false — +guard.client.ts redirect on first load', async () => {
    await page.goto(getServerUrl() + '/hydration-not-aborted/guard-redirect')
    await expectUrl('/markdown')
    await ensureWasClientSideRouted('/pages/hydration-not-aborted/guard-redirect')
  })
}
