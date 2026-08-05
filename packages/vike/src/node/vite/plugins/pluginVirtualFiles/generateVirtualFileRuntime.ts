export { generateVirtualFileRuntime }
export { generateVirtualFileRuntimeCode }

import { generateVirtualFileId } from '../../../../shared-server-node/virtualFileId.js'
import { requireResolveDistFile } from '../../../../utils/requireResolve.js'
import '../../assertEnvVite.js'

function generateVirtualFileRuntime(environmentName: string, isDev: boolean): string {
  return generateVirtualFileRuntimeCode(
    environmentName,
    isDev,
    requireResolveDistFile('dist/runtime/createRuntime.js'),
  )
}

function generateVirtualFileRuntimeCode(environmentName: string, isDev: boolean, createRuntimeFile: string): string {
  const globalEntryId =
    environmentName === 'client'
      ? generateVirtualFileId({ type: 'global-entry', isForClientSide: true, isClientRouting: true })
      : environmentName === 'ssr' || environmentName === 'server'
        ? generateVirtualFileId({ type: 'global-entry', isForClientSide: false, isClientRouting: false })
        : generateVirtualFileId({ type: 'global-entry', environmentName })
  return [
    `import { createRuntime } from ${JSON.stringify(createRuntimeFile)};`,
    `export const environmentName = ${JSON.stringify(environmentName)};`,
    `let loadPageConfigRuntimePromise;`,
    `export async function loadPageConfig(pageId) {`,
    `  loadPageConfigRuntimePromise ??= import(${JSON.stringify(
      globalEntryId,
    )}).then(({ pageConfigsSerialized, pageConfigGlobalSerialized }) =>`,
    `    createRuntime(pageConfigsSerialized, pageConfigGlobalSerialized, ${JSON.stringify(isDev)}),`,
    `  );`,
    `  return (await loadPageConfigRuntimePromise)(pageId);`,
    `}`,
  ].join('\n')
}
