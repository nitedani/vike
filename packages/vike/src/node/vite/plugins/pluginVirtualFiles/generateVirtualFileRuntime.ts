export { generateVirtualFileRuntime }

import { generateVirtualFileId } from '../../../../shared-server-node/virtualFileId.js'
import { requireResolveDistFile } from '../../../../utils/requireResolve.js'
import '../../assertEnvVite.js'

function generateVirtualFileRuntime(environmentName: string, isDev: boolean): string {
  const globalEntryId =
    environmentName === 'client'
      ? generateVirtualFileId({ type: 'global-entry', isForClientSide: true, isClientRouting: true })
      : environmentName === 'ssr' || environmentName === 'server'
        ? generateVirtualFileId({ type: 'global-entry', isForClientSide: false, isClientRouting: false })
        : generateVirtualFileId({ type: 'global-entry', environmentName })
  const createRuntimeFile = requireResolveDistFile('dist/runtime/createRuntime.js')
  return [
    `import { createRuntime } from ${JSON.stringify(createRuntimeFile)};`,
    `import { pageConfigsSerialized, pageConfigGlobalSerialized } from ${JSON.stringify(globalEntryId)};`,
    `export const environmentName = ${JSON.stringify(environmentName)};`,
    `export const loadPageConfig = createRuntime(pageConfigsSerialized, pageConfigGlobalSerialized, ${JSON.stringify(
      isDev,
    )});`,
  ].join('\n')
}
