export { generateVirtualFilePageEntry }

import { assert, getDebugInfoStr, getProjectError } from '../../../../utils/assert.js'
import type { PageConfigBuildTime } from '../../../../types/PageConfig.js'
import { parseVirtualFileId, generateVirtualFileId } from '../../../../shared-server-node/virtualFileId.js'
import { getVikeConfigInternal } from '../../shared/resolveVikeConfigInternal.js'
import { extractAssetsAddQuery } from '../../../../shared-server-node/extractAssetsQuery.js'
import { debug } from './debug.js'
import {
  FilesEnv,
  serializeConfigValues,
} from '../../../../shared-server-client/page-configs/serialize/serializeConfigValues.js'
import { handleAssetsManifest_isFixEnabled } from '../build/handleAssetsManifest.js'
import { getConfigValueBuildTime } from '../../../../shared-server-client/page-configs/getConfigValueBuildTime.js'
import { resolveIncludeAssetsImportedByServer } from '../../../../server/runtime/renderPageServer/getPageAssets/retrievePageAssetsProd.js'
import type { RuntimeEnv } from './getConfigValueSourcesRelevant.js'
import '../../assertEnvVite.js'

async function generateVirtualFilePageEntry(id: string, isDev: boolean): Promise<string> {
  const result = parseVirtualFileId(id)
  assert(result && result.type === 'page-entry')
  const { pageId, environmentName } = result
  const runtimeEnv = resolveRuntimeEnv(environmentName, isDev)
  const vikeConfig = await getVikeConfigInternal(true)
  const { _pageConfigs: pageConfigs } = vikeConfig
  const pageConfig = pageConfigs.find((pageConfig) => pageConfig.pageId === pageId)

  if (!isDev) assert(pageConfig)
  if (!pageConfig) {
    // Happens very seldom and can't reproduce reliably. Some kind of HMR race condition? It still happens as of June 2026 with Cloudflare Workers in development — but it isn't blocking, reloading the page fixes the issue.
    throw getProjectError(`Outdated request. Try again. ${getDebugInfoStr({ id, pageId })}`)
  }

  const code = getCode(pageConfig, runtimeEnv, pageId, resolveIncludeAssetsImportedByServer(vikeConfig.config), isDev)
  debug(id, environmentName.toUpperCase(), code)
  return code
}

function getCode(
  pageConfig: PageConfigBuildTime,
  runtimeEnv: RuntimeEnv,
  pageId: string,
  includeAssetsImportedByServer: boolean,
  isDev: boolean,
): string {
  const lines: string[] = []
  const importStatements: string[] = []
  const filesEnv: FilesEnv = new Map()
  const isClientRouting = getConfigValueBuildTime(pageConfig, 'clientRouting', 'boolean')?.value ?? false
  if ('environmentName' in runtimeEnv) runtimeEnv.isClientRouting = isClientRouting

  lines.push('export const configValuesSerialized = {')
  lines.push(...serializeConfigValues(pageConfig, importStatements, filesEnv, runtimeEnv, '', false))
  lines.push('};')

  if (shouldImportAssetsFromServer(runtimeEnv, includeAssetsImportedByServer, isDev)) {
    importStatements.push(
      `import '${extractAssetsAddQuery(
        generateVirtualFileId({ type: 'page-entry', pageId, environmentName: 'server' }),
      )}'`,
    )
  }

  const code = [...importStatements, ...lines].join('\n')
  return code
}

function resolveRuntimeEnv(environmentName: string, isDev: boolean): RuntimeEnv {
  return { environmentName, isClientRouting: false, isDev }
}

function shouldImportAssetsFromServer(runtimeEnv: RuntimeEnv, includeAssetsImportedByServer: boolean, isDev: boolean) {
  return (
    handleAssetsManifest_isFixEnabled() === false &&
    includeAssetsImportedByServer &&
    'environmentName' in runtimeEnv &&
    runtimeEnv.environmentName === 'client' &&
    isDev === false
  )
}
