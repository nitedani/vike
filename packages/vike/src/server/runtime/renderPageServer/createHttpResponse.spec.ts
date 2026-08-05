import { describe, expect, it } from 'vitest'
import { createHttpResponseArtifact } from './createHttpResponse.js'
import type { ResponseArtifact, ResponseIntent } from '../../../types/RenderTarget.js'

const artifact: ResponseArtifact = {
  statusCode: 200,
  headers: [],
  contentType: 'application/atom+xml',
  body: '<feed />',
}
const responseIntent: ResponseIntent = {
  statusCode: 200,
  headers: [],
  isPrerendering: false,
}

describe('createHttpResponseArtifact()', () => {
  it('rejects a core Content-Type conflicting with the target-owned Content-Type', async () => {
    await expect(
      createHttpResponseArtifact(artifact, {
        ...responseIntent,
        headers: [['Content-Type', 'text/html;charset=utf-8']],
      }),
    ).rejects.toThrow('Content-Type is reserved to the render target')
  })

  it('rejects conflicting singleton headers instead of overwriting either value', async () => {
    await expect(
      createHttpResponseArtifact(
        {
          ...artifact,
          headers: [['Content-Length', '8']],
        },
        {
          ...responseIntent,
          headers: [['content-length', '9']],
        },
      ),
    ).rejects.toThrow('Conflicting content-length response headers cannot be merged losslessly')
  })
})
