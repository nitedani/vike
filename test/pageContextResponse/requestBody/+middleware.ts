import { enhance, MiddlewareOrder, type UniversalMiddleware } from '@universal-middleware/core'

const consumeBody: UniversalMiddleware = async (request) => {
  await request.text()
}

export default enhance(consumeBody, {
  name: 'consumeBody',
  order: MiddlewareOrder.CUSTOM_PRE_PROCESSING,
})
