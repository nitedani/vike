export { resolvePageContextResponse }

import { assertUsage } from '../../../utils/assert.js'
import { objectAssign } from '../../../utils/objectAssign.js'
import { createHttpResponseFromUniversalMiddleware, type HttpResponse } from './createHttpResponse.js'
import '../../assertEnvServer.js'

function resolvePageContextResponse<PageContext extends object>(
  pageContext: PageContext,
): (PageContext & { httpResponse: HttpResponse }) | null {
  const { response } = pageContext as { response?: Response }
  if (response === undefined) return null
  assertUsage(response instanceof Response, 'pageContext.response should be a Response')
  const httpResponse = createHttpResponseFromUniversalMiddleware(response)
  objectAssign(pageContext, { httpResponse })
  return pageContext
}
