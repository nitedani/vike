export { handleAssetsManifest }
export { handleAssetsManifest_getBuildConfig }
export { handleAssetsManifest_isFixEnabled }
export { handleAssetsManifest_assertUsageCssCodeSplit }
export { handleAssetsManifest_assertUsageCssTarget }
export { handleAssetsManifest_alignCssTarget }
export { addServerAssets, getPageEntry, resolveAssetParticipants }

import fs from 'node:fs/promises'
import fs_sync from 'node:fs'
import path from 'node:path'
import { existsSync } from 'node:fs'
import type { ViteManifest, ViteManifestEntry } from '../../../../types/ViteManifest.js'
import { assert, assertWarning } from '../../../../utils/assert.js'
import { getGlobalObject } from '../../../../utils/getGlobalObject.js'
import { isEqualStringList } from '../../../../utils/isEqualStringList.js'
import { isObject } from '../../../../utils/isObject.js'
import { pLimit } from '../../../../utils/pLimit.js'
import { unique } from '../../../../utils/unique.js'
import { parseVirtualFileId } from '../../../../shared-server-node/virtualFileId.js'
import type { Environment, ResolvedConfig, Rollup, UserConfig } from 'vite'
import { getAssetsDir } from '../../shared/getAssetsDir.js'
import { isVite8OrAbove } from '../../shared/isVite8OrAbove.js'
import pc from '@brillout/picocolors'
import { isV1Design } from '../../shared/resolveVikeConfigInternal.js'
import { getOutDirs } from '../../shared/getOutDirs.js'
import {
  isViteServerSide_onlySsrEnv,
  isViteServerSide,
  isViteServerSide_viteEnvOptional,
} from '../../shared/isViteServerSide.js'
import { set_macro_ASSETS_MANIFEST } from './pluginProdBuildEntry.js'
import { getManifestFilePathRelative } from '../../shared/getManifestFilePathRelative.js'
import { getVikeConfigInternal } from '../../shared/resolveVikeConfigInternal.js'
import { toPosixPath } from '../../../../utils/path.js'
import type { RuntimeEnvironmentDeclaration } from '../../../../types/Config.js'
import '../../assertEnvVite.js'
type Bundle = Rollup.OutputBundle

const globalObject = getGlobalObject('handleAssetsManifest.ts', {
  assetsJsonFilePath: undefined as string | undefined,
  targetsAll: [] as TargetConfig[],
  configsAll: [] as ResolvedConfig[],
})

type AssetParticipant = {
  environmentName: string
  entryEnvironmentName: string
  assets: RuntimeEnvironmentDeclaration['assets']
}

function resolveAssetParticipants(runtimeEnvironments: RuntimeEnvironmentDeclaration[] | undefined) {
  if (!runtimeEnvironments?.length) return null
  const participants = new Map<string, AssetParticipant>()
  const add = (participant: AssetParticipant) => {
    assert(!participants.has(participant.environmentName))
    participants.set(participant.environmentName, participant)
  }
  add({ environmentName: 'client', entryEnvironmentName: 'client', assets: { role: 'browser-producer' } })
  // Keep the existing `server` virtual ID byte-identical while the Vite environment is named `ssr`.
  add({
    environmentName: 'ssr',
    entryEnvironmentName: 'server',
    assets: { role: 'consumer-finalizer', target: 'client' },
  })
  runtimeEnvironments.forEach(({ name, assets }) => add({ environmentName: name, entryEnvironmentName: name, assets }))
  return participants
}

async function getAssetParticipants() {
  const vikeConfig = await getVikeConfigInternal()
  return resolveAssetParticipants(vikeConfig.config.runtimeEnvironments)
}

// yes  => use workaround config.build.ssrEmitAssets
// false => use workaround extractAssets plugin
function handleAssetsManifest_isFixEnabled(): boolean {
  // Allow user to toggle between the two workarounds? E.g. based on https://vike.dev/includeAssetsImportedByServer.
  return isV1Design()
}

/** https://github.com/vikejs/vike/issues/1339 */
async function fixServerAssets(
  config: ResolvedConfig,
): Promise<{ clientManifestMod: ViteManifest; serverManifestMod: ViteManifest }> {
  const clientManifest = await readManifestFile(config, true)
  const serverManifest = await readManifestFile(config, false)

  const { clientManifestMod, serverManifestMod, filesToMove, filesToRemove } = addServerAssets(
    clientManifest,
    serverManifest,
  )
  await copyAssets(filesToMove, filesToRemove, config)

  return { clientManifestMod, serverManifestMod }
}
async function copyAssets(filesToMove: string[], filesToRemove: string[], config: ResolvedConfig) {
  const { outDirClient, outDirServer } = getOutDirs(config, undefined)
  await copyParticipantAssets(filesToMove, filesToRemove, outDirServer, outDirClient, config)
}

async function copyParticipantAssets(
  filesToMove: string[],
  filesToRemove: string[],
  sourceOutDir: string,
  targetOutDir: string,
  config: ResolvedConfig,
) {
  const assetsDir = getAssetsDir(config)
  const sourceAssetsDir = path.posix.join(sourceOutDir, assetsDir)
  if (!filesToMove.length && !filesToRemove.length && !existsSync(sourceAssetsDir)) return
  assert(existsSync(sourceAssetsDir))
  const concurrencyLimit = pLimit(10)
  await Promise.all(
    filesToMove.map((file) =>
      concurrencyLimit(async () => {
        const source = path.posix.join(sourceOutDir, file)
        const target = path.posix.join(targetOutDir, file)
        await fs.mkdir(path.posix.dirname(target), { recursive: true })
        await fs.rename(source, target)
      }),
    ),
  )
  filesToRemove.forEach((file) => {
    const filePath = path.posix.join(sourceOutDir, file)
    fs_sync.unlinkSync(filePath)
  })
  /* We cannot do that because, with some edge case Rollup settings (outputting JavaScript chunks and static assets to the same directory), this removes JavaScript chunks, see https://github.com/vikejs/vike/issues/1154#issuecomment-1975762404
  await fs.rm(assetsDirServer, { recursive: true })
  */
  removeEmptyDirectories(sourceAssetsDir)
}

async function handleAssetParticipants(
  config: ResolvedConfig,
  viteEnv: Environment,
  bundle: Bundle,
  participants: Map<string, AssetParticipant>,
) {
  const environmentName = viteEnv.name
  if (!environmentName) return
  const finalizer = participants.get(environmentName)
  if (!finalizer || finalizer.assets.role !== 'consumer-finalizer') return
  const producer = participants.get(finalizer.assets.target)
  assert(producer?.assets.role === 'browser-producer')

  const producerManifestFilePath = getParticipantManifestFilePath(config, producer)
  const finalizerManifestFilePath = getParticipantManifestFilePath(config, finalizer)
  const assetsJsonFilePath = getParticipantAssetsJsonFilePath(config, producer)
  // Another finalizer targeting the same producer may have already consumed its Vite manifest.
  const producerManifest = await readManifestFileAt(
    existsSync(producerManifestFilePath) ? producerManifestFilePath : assetsJsonFilePath,
  )
  const finalizerManifest = await readManifestFileAt(finalizerManifestFilePath)
  const { filesToMove, filesToRemove } = addServerAssets(
    producerManifest,
    finalizerManifest,
    { producer: producer.entryEnvironmentName, finalizer: finalizer.entryEnvironmentName },
    true,
  )
  await copyParticipantAssets(
    filesToMove,
    filesToRemove,
    getParticipantOutDir(config, finalizer),
    getParticipantOutDir(config, producer),
    config,
  )
  await writeManifestFile(producerManifest, assetsJsonFilePath)
  const noop = await set_macro_ASSETS_MANIFEST(assetsJsonFilePath, bundle, getParticipantOutDir(config, finalizer))
  if (finalizer.environmentName === 'ssr') assert(!noop)
  await fs.rm(finalizerManifestFilePath)
  if (existsSync(producerManifestFilePath)) await fs.rm(producerManifestFilePath)
}

function getParticipantOutDir(config: ResolvedConfig, participant: AssetParticipant) {
  const environment = config.environments[participant.environmentName]
  assert(environment)
  const outDir = environment.build.outDir
  assert(outDir)
  return toPosixPath(path.resolve(config.root, outDir))
}

function getParticipantManifestFilePath(config: ResolvedConfig, participant: AssetParticipant) {
  const environment = config.environments[participant.environmentName]
  assert(environment)
  return path.posix.join(
    getParticipantOutDir(config, participant),
    getManifestFilePathRelative(environment.build.manifest),
  )
}

function getParticipantAssetsJsonFilePath(config: ResolvedConfig, producer: AssetParticipant) {
  const fileName = producer.environmentName === 'client' ? 'assets.json' : `assets.${producer.environmentName}.json`
  return path.posix.join(path.posix.dirname(getParticipantOutDir(config, producer)), fileName)
}

type Resource = { src: string; hash: string }
// Add serverManifest resources to clientManifest
function addServerAssets(
  clientManifest: ViteManifest,
  serverManifest: ViteManifest,
  environments = { producer: 'client', finalizer: 'server' },
  mergeEntryCollisions = false,
) {
  const entriesClient = new Map<
    string, // (environmentName, pageId)
    {
      key: string
      pageId: string
      css: Resource[]
      assets: Resource[]
    }
  >()
  const entriesServer = new Map<
    string, // (environmentName, pageId)
    {
      key: string
      pageId: string
      css: Resource[]
      assets: Resource[]
    }
  >()

  for (const [key, entry] of Object.entries(clientManifest)) {
    const pageEntry = getPageEntry(key)
    if (!pageEntry || pageEntry.environmentName !== environments.producer) continue
    const resources = collectResources(entry, clientManifest)
    const correlationKey = getPageCorrelationKey(pageEntry)
    assert(!entriesClient.has(correlationKey))
    entriesClient.set(correlationKey, { key, pageId: pageEntry.pageId, ...resources })
  }
  for (const [key, entry] of Object.entries(serverManifest)) {
    const pageEntry = getPageEntry(key)
    if (!pageEntry || pageEntry.environmentName !== environments.finalizer) continue
    const resources = collectResources(entry, serverManifest)
    const correlationKey = getPageCorrelationKey(pageEntry)
    assert(!entriesServer.has(correlationKey))
    entriesServer.set(correlationKey, { key, pageId: pageEntry.pageId, ...resources })
  }

  let filesToMove: string[] = []
  let filesToRemove: string[] = []

  // Copy page assets
  for (const entryClient of entriesClient.values()) {
    const entryServer = entriesServer.get(
      getPageCorrelationKey({ environmentName: environments.finalizer, pageId: entryClient.pageId }),
    )
    if (!entryServer) continue

    const cssToMove: string[] = []
    const cssToRemove: string[] = []
    const assetsToMove: string[] = []
    const assetsToRemove: string[] = []

    entryServer.css.forEach((cssServer) => {
      if (!entryClient.css.some((cssClient) => cssServer.hash === cssClient.hash)) {
        cssToMove.push(cssServer.src)
      } else {
        cssToRemove.push(cssServer.src)
      }
    })
    entryServer.assets.forEach((assetServer) => {
      if (!entryClient.assets.some((assetClient) => assetServer.hash === assetClient.hash)) {
        assetsToMove.push(assetServer.src)
      } else {
        assetsToRemove.push(assetServer.src)
      }
    })

    if (cssToMove.length) {
      const { key } = entryClient
      filesToMove.push(...cssToMove)
      clientManifest[key]!.css ??= []
      clientManifest[key]!.css?.push(...cssToMove)
    }
    if (cssToRemove.length) {
      const { key } = entryServer
      filesToRemove.push(...cssToRemove)
      serverManifest[key]!.css ??= []
      serverManifest[key]!.css = serverManifest[key]!.css!.filter((entry) => !cssToRemove.includes(entry))
    }

    if (assetsToMove.length) {
      const { key } = entryClient
      filesToMove.push(...assetsToMove)
      clientManifest[key]!.assets ??= []
      clientManifest[key]!.assets?.push(...assetsToMove)
    }
    if (assetsToRemove.length) {
      const { key } = entryServer
      filesToRemove.push(...assetsToRemove)
      serverManifest[key]!.assets ??= []
      serverManifest[key]!.assets = serverManifest[key]!.assets!.filter((entry) => !assetsToRemove.includes(entry))
    }
  }

  // Also copy assets of virtual:@brillout/vite-plugin-server-entry:serverEntry
  {
    const filesClientAll: string[] = []
    for (const key in clientManifest) {
      const entry = clientManifest[key]!
      filesClientAll.push(entry.file)
      filesClientAll.push(...(entry.assets ?? []))
      filesClientAll.push(...(entry.css ?? []))
    }
    for (const key in serverManifest) {
      const entry = serverManifest[key]!
      if (!entry.isEntry) continue
      const pageEntry = getPageEntry(key)
      if (pageEntry && pageEntry.environmentName !== environments.finalizer) continue
      const resources = collectResources(entry, serverManifest)
      const css = resources.css.map((css) => css.src).filter((file) => !filesClientAll.includes(file))
      const assets = resources.assets.map((asset) => asset.src).filter((file) => !filesClientAll.includes(file))
      filesToMove.push(...css, ...assets)
      if (css.length > 0 || assets.length > 0) {
        const entryClient = clientManifest[key]
        if (entryClient) {
          assert(mergeEntryCollisions)
          entryClient.css = unique([...(entryClient.css ?? []), ...css])
          entryClient.assets = unique([...(entryClient.assets ?? []), ...assets])
        } else {
          clientManifest[key] = {
            ...entry,
            css,
            assets,
            dynamicImports: undefined,
            imports: undefined,
          }
        }
      }
    }
  }

  const clientManifestMod = clientManifest
  const serverManifestMod = serverManifest
  filesToMove = unique(filesToMove)
  filesToRemove = unique(filesToRemove).filter((file) => !filesToMove.includes(file))
  return { clientManifestMod, serverManifestMod, filesToMove, filesToRemove }
}

type PageEntry = { environmentName: string; pageId: string }
function getPageEntry(key: string): PageEntry | null {
  const virtualFileIdIndex = key.indexOf('virtual:vike')
  if (virtualFileIdIndex < 0) return null
  const prefix = key.slice(0, virtualFileIdIndex)
  // Vite sometimes prefixes manifest keys with relative path segments. Don't mistake a third-party
  // virtual ID that merely embeds a Vike virtual ID for one of Vike's own entries.
  if (prefix && !/^(?:\.\.\/)+$/.test(prefix)) return null
  // Normalize from:
  //   ../../virtual:vike:page-entry:client:/pages/index
  // to:
  //   virtual:vike:page-entry:client:/pages/index
  // (This seems to be needed only for vitest tests that use Vite's build() API with an inline config.)
  key = key.substring(virtualFileIdIndex)
  const result = parseVirtualFileId(key)
  return result && result.type === 'page-entry'
    ? { environmentName: result.environmentName, pageId: result.pageId }
    : null
}

function getPageCorrelationKey({ environmentName, pageId }: PageEntry) {
  return `${environmentName}\0${pageId}`
}

function collectResources(entryRoot: ViteManifestEntry, manifest: ViteManifest) {
  const css: Resource[] = []
  const assets: Resource[] = []

  const entries = new Set([entryRoot])
  for (const entry of entries) {
    for (const entryImport of entry.imports ?? []) {
      entries.add(manifest[entryImport]!)
    }

    const entryCss = entry.css ?? []
    if (entry.file.endsWith('.css')) entryCss.push(entry.file)
    for (const src of entryCss) {
      const hash = getHash(src)
      css.push({ src, hash })
    }
    const entryAssets = entry.assets ?? []
    for (const src of entryAssets) {
      const hash = getHash(src)
      assets.push({ src, hash })
    }
  }

  return { css, assets }
}

// Use the hash of resources to determine whether they are equal. We need this, otherwise we get:
// ```html
// <head>
//   <link rel="stylesheet" type="text/css" href="/assets/static/onRenderClient.2j6TxKIB.css">
//   <link rel="stylesheet" type="text/css" href="/assets/static/onRenderHtml.2j6TxKIB.css">
// </head>
// ```
function getHash(src: string) {
  // src is guaranteed to end with `.[hash][extname]`, see pluginDistFileNames.ts
  const hash = src.split('.').at(-2)
  assert(hash)
  return hash
}

// https://github.com/vikejs/vike/issues/1993
function handleAssetsManifest_assertUsageCssCodeSplit(config: ResolvedConfig) {
  if (!handleAssetsManifest_isFixEnabled()) return
  assertWarning(
    config.build.cssCodeSplit,
    `${pc.cyan('build.cssCodeSplit')} shouldn't be set to ${pc.cyan(
      'false',
    )} (https://github.com/vikejs/vike/issues/1993)`,
    { onlyOnce: true },
  )
}

// https://github.com/vikejs/vike/issues/1815
// https://github.com/vitejs/vite/issues/20505
type CssTarget = ResolvedConfig['build']['cssTarget']
type Target = ResolvedConfig['build']['target'] | CssTarget
type TargetConfig = { global: Exclude<Target, undefined>; css: Target; isServerSide: boolean }
async function handleAssetsManifest_alignCssTarget(config: ResolvedConfig) {
  const participants = await getAssetParticipants()
  if (participants) {
    for (const finalizer of participants.values()) {
      if (finalizer.assets.role !== 'consumer-finalizer') continue
      const producer = participants.get(finalizer.assets.target)
      assert(producer?.assets.role === 'browser-producer')
      const producerConfig = config.environments[producer.environmentName]
      assert(producerConfig)
      const { cssTarget } = producerConfig.build
      assert(cssTarget)
      const finalizerConfig = config.environments[finalizer.environmentName]
      assert(finalizerConfig)
      finalizerConfig.build.cssTarget = cssTarget
    }
    return
  }
  globalObject.configsAll.push(config)
  const clientSideConfigs = globalObject.configsAll.filter((c) => !isViteServerSide_viteEnvOptional(c, undefined))
  if (clientSideConfigs.length === 0) return
  const { cssTarget } = clientSideConfigs.at(-1)!.build
  assert(cssTarget)
  globalObject.configsAll.forEach((c) => (c.build.cssTarget = cssTarget))
}
async function handleAssetsManifest_assertUsageCssTarget(config: ResolvedConfig, env: Environment) {
  if (!handleAssetsManifest_isFixEnabled()) return
  const participants = await getAssetParticipants()
  if (participants) {
    const environmentName = env.name
    if (!environmentName) return
    const participant = participants.get(environmentName)
    if (!participant || participant.assets.role !== 'consumer-finalizer') return
    const producer = participants.get(participant.assets.target)
    assert(producer?.assets.role === 'browser-producer')
    const producerConfig = config.environments[producer.environmentName]
    assert(producerConfig)
    assertCssTargetsEqual(
      { global: producerConfig.build.target, css: producerConfig.build.cssTarget, isServerSide: false },
      { global: env.config.build.target, css: env.config.build.cssTarget, isServerSide: true },
    )
    return
  }
  const isServerSide = isViteServerSide(config, env)
  assert(typeof isServerSide === 'boolean')
  assert(config.build.target !== undefined)
  const { targetsAll } = globalObject
  targetsAll.push({ global: config.build.target, css: config.build.cssTarget, isServerSide })
  const targetsServer = targetsAll.filter((t) => t.isServerSide)
  const targetsClient = targetsAll.filter((t) => !t.isServerSide)
  targetsClient.forEach((targetClient) => {
    targetsServer.forEach((targetServer) => {
      assertCssTargetsEqual(targetClient, targetServer)
    })
  })
}
function assertCssTargetsEqual(targetClient: TargetConfig, targetServer: TargetConfig) {
  const targetCssResolvedClient = resolveCssTarget(targetClient)
  const targetCssResolvedServer = resolveCssTarget(targetServer)
  assertWarning(
    isEqualStringList(targetCssResolvedClient, targetCssResolvedServer),
    [
      'The CSS browser target should be the same for both client and server, but we got:',
      `Client: ${pc.cyan(JSON.stringify(targetCssResolvedClient))}`,
      `Server: ${pc.cyan(JSON.stringify(targetCssResolvedServer))}`,
      `Different targets lead to CSS duplication, see ${pc.underline('https://github.com/vikejs/vike/issues/1815#issuecomment-2507002979')} for more information.`,
    ].join('\n'),
    {
      showStackTrace: true,
      onlyOnce: 'different-css-target',
    },
  )
}
function resolveCssTarget(target: TargetConfig) {
  return target.css ?? target.global
}

/**
 * Recursively remove all empty directories in a given directory.
 */
function removeEmptyDirectories(dirPath: string): void {
  // Read the directory contents
  const files = fs_sync.readdirSync(dirPath)

  // Iterate through the files and subdirectories
  for (const file of files) {
    const fullPath = path.join(dirPath, file)

    // Check if it's a directory
    if (fs_sync.statSync(fullPath).isDirectory()) {
      // Recursively clean up the subdirectory
      removeEmptyDirectories(fullPath)
    }
  }

  // Re-check the directory; remove it if it's now empty
  if (fs_sync.readdirSync(dirPath).length === 0) {
    fs_sync.rmdirSync(dirPath)
  }
}

async function readManifestFile(config: ResolvedConfig, client: boolean) {
  const manifestFilePath = getManifestFilePath(config, client)
  return readManifestFileAt(manifestFilePath)
}
async function readManifestFileAt(manifestFilePath: string) {
  const manifestFileContent = await fs.readFile(manifestFilePath, 'utf-8')
  assert(manifestFileContent)
  const manifest: unknown = JSON.parse(manifestFileContent)
  assert(manifest)
  assert(isObject(manifest))
  return manifest as ViteManifest
}
async function writeManifestFile(manifest: ViteManifest, manifestFilePath: string) {
  assert(isObject(manifest))
  const manifestFileContent = JSON.stringify(manifest, null, 2)
  await fs.writeFile(manifestFilePath, manifestFileContent, 'utf-8')
}

async function handleAssetsManifest_getBuildConfig(config: UserConfig) {
  const isFixEnabled = handleAssetsManifest_isFixEnabled()
  // Set default values (i.e. allow user to override these values)
  const build: UserConfig['build'] = {}
  if (isFixEnabled) {
    // https://github.com/vikejs/vike/issues/1339
    if (config.build?.ssrEmitAssets === undefined) build.ssrEmitAssets = true
    // Required if `ssrEmitAssets: true`, see https://github.com/vitejs/vite/pull/11430#issuecomment-1454800934
    if (config.build?.cssMinify === undefined) build.cssMinify = isVite8OrAbove(config) ? true : 'esbuild'
  }
  if (config.build?.manifest === undefined) build.manifest = true
  /* Already set by vike:build:pluginBuildApp
  if (config.build?.copyPublicDir === undefined) build.copyPublicDir = !isViteServerSide_viteEnvOptional(config)
  */
  return build
}

async function handleAssetsManifest(
  config: ResolvedConfig,
  viteEnv: Environment,
  options: { dir: string | undefined },
  bundle: Bundle,
) {
  const participants = await getAssetParticipants()
  if (participants) {
    await handleAssetParticipants(config, viteEnv, bundle, participants)
    return
  }
  const isSsrEnv = isViteServerSide_onlySsrEnv(config, viteEnv)
  if (isSsrEnv) {
    const outDirs = getOutDirs(config, viteEnv)
    globalObject.assetsJsonFilePath = path.posix.join(outDirs.outDirRoot, 'assets.json')
    await writeAssetsManifestFile(globalObject.assetsJsonFilePath, config)
  }
  if (isViteServerSide(config, viteEnv)) {
    const outDir = options.dir
    assert(outDir)
    // Replace ASSETS_MANIFEST in server builds
    // - Always replace it in dist/server/
    // - Also in some other server builds such as dist/vercel/ from vike-vercel
    // - Other server builds without ASSETS_MANIFEST are left unchanged
    const noop = await set_macro_ASSETS_MANIFEST(globalObject.assetsJsonFilePath, bundle, outDir)
    if (isSsrEnv) assert(!noop) // dist/server should always contain ASSETS_MANIFEST
  }
}
async function writeAssetsManifestFile(assetsJsonFilePath: string, config: ResolvedConfig) {
  const isFixEnabled = handleAssetsManifest_isFixEnabled()
  const clientManifestFilePath = getManifestFilePath(config, true)
  const serverManifestFilePath = getManifestFilePath(config, false)
  if (!isFixEnabled) {
    await fs.copyFile(clientManifestFilePath, assetsJsonFilePath)
  } else {
    const { clientManifestMod } = await fixServerAssets(config)
    await writeManifestFile(clientManifestMod, assetsJsonFilePath)
  }
  await fs.rm(clientManifestFilePath)
  await fs.rm(serverManifestFilePath)
}

function getManifestFilePath(config: ResolvedConfig, client: boolean) {
  const outDirs = getOutDirs(config, undefined)
  const outDir = client ? outDirs.outDirClient : outDirs.outDirServer
  const env = client ? config.environments.client : config.environments.ssr
  assert(env)
  const manifestFilePathRelative = getManifestFilePathRelative(env.build.manifest)
  const manifestFilePath = path.posix.join(outDir, manifestFilePathRelative)
  return manifestFilePath
}
