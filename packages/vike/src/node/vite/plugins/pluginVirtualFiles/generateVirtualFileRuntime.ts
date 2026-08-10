export { generateVirtualFileRuntime }
export { generateVirtualFileRuntimeCode }

import { generateVirtualFileId } from '../../../../shared-server-node/virtualFileId.js'
import { requireResolveDistFile } from '../../../../utils/requireResolve.js'
import '../../assertEnvVite.js'

function generateVirtualFileRuntime(environmentName: string, isDev: boolean): string {
  return generateVirtualFileRuntimeCode(environmentName, isDev, requireResolveDistFile('dist/runtime/createRuntime.js'))
}

function generateVirtualFileRuntimeCode(environmentName: string, isDev: boolean, createRuntimeFile: string): string {
  const createRuntimeFileSerialized = JSON.stringify(createRuntimeFile)
  const environmentNameSerialized = JSON.stringify(environmentName)
  const globalEntryIdSerialized = JSON.stringify(resolveGlobalEntryId(environmentName))
  const isDevSerialized = JSON.stringify(isDev)
  return [
    `import { createRuntime } from ${createRuntimeFileSerialized};`,
    `export const environmentName = ${environmentNameSerialized};`,
    `let loadPageConfigRuntimePromise;`,
    `export async function loadPageConfig(pageId) {`,
    `  loadPageConfigRuntimePromise ??= import(${globalEntryIdSerialized}).then(({ pageConfigsSerialized, pageConfigGlobalSerialized }) =>`,
    `    createRuntime(pageConfigsSerialized, pageConfigGlobalSerialized, ${isDevSerialized}),`,
    `  );`,
    `  return (await loadPageConfigRuntimePromise)(pageId);`,
    `}`,
  ].join('\n')
}

function resolveGlobalEntryId(environmentName: string) {
  if (environmentName === 'client') {
    return generateVirtualFileId({ type: 'global-entry', environmentName: 'client', isClientRouting: true })
  }
  if (environmentName === 'ssr' || environmentName === 'server') {
    return generateVirtualFileId({ type: 'global-entry', environmentName: 'server' })
  }
  return generateVirtualFileId({ type: 'global-entry', environmentName })
}
