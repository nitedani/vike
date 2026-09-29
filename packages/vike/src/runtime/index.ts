export { environmentName, loadPageConfig }
export type { PageConfigPublic }

import { assertUsage } from '../utils/assert.js'
import type { PageConfigPublic } from '../shared-server-client/page-configs/resolveVikeConfigPublic.js'

const environmentName = unavailable<string>()

async function loadPageConfig(_pageId: string): Promise<PageConfigPublic> {
  return unavailable<PageConfigPublic>()
}

function unavailable<T>(): T {
  assertUsage(false, `${JSON.stringify('vike/runtime')} can be imported only in a Vite environment`)
}
