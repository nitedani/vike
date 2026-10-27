export { promise }

import { markers } from '../../../shared-server-client/streamedValues.js'
import { getLineError } from './lines.js'
import type { StreamedValueType } from './registry.js'
import { genPromise } from '../../../utils/genPromise.js'
import '../../assertEnvClient.js'

// Settled by its `v` or `error` line
const promise: StreamedValueType = {
  marker: markers.promise,
  revive(parseValue) {
    const { promise: value, resolve, reject } = genPromise<unknown>({ timeout: null })
    // Avoid an unhandled rejection if the user doesn't use the promise
    value.catch(() => {})
    let isPending = true
    return {
      value,
      push(line) {
        isPending = false
        if ('v' in line) resolve(parseValue(line.v))
        else reject(getLineError())
      },
      fail(err) {
        isPending = false
        reject(err)
      },
      isPending: () => isPending,
    }
  },
}
