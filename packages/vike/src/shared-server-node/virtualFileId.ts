export { parseVirtualFileId }
export { generateVirtualFileId }
export { virtualFileIdGlobalEntryServer }
export { virtualFileIdGlobalEntryClientSR }
export { virtualFileIdGlobalEntryClientCR }

import { extractAssetsRemoveQuery } from './extractAssetsQuery.js'
import { assert } from '../utils/assert.js'
import { assertIsNotBrowser } from '../utils/assertIsNotBrowser.js'
import { removeVirtualFileIdPrefix } from '../utils/virtualFileId.js'

assertIsNotBrowser()

// Global entries
const virtualFileIdGlobalEntryServer =
  //
  'virtual:vike:global-entry:server'
const virtualFileIdGlobalEntryClientSR =
  //
  'virtual:vike:global-entry:client:server-routing'
const virtualFileIdGlobalEntryClientCR =
  //
  'virtual:vike:global-entry:client:client-routing'

// Page entries
const virtualFileIdPageEntryClient =
  //
  'virtual:vike:page-entry:client:' // ${pageId}
const virtualFileIdPageEntryServer =
  //
  'virtual:vike:page-entry:server:' //  ${pageId}

// Virtual ID prefixes
const virtualFileIdPageEntryPrefix =
  //
  'virtual:vike:page-entry:'
const virtualFileIdGlobalEntryPrefix =
  //
  'virtual:vike:global-entry:'
const virtualFileIdRuntimePrefix =
  //
  'virtual:vike:runtime:'

type VirtualFileIdEntryParsed =
  | {
      type: 'global-entry'
      environmentName: string
      isForClientSide: boolean
      isClientRouting: boolean
    }
  | { type: 'runtime'; environmentName: string }
  | {
      type: 'page-entry'
      environmentName: string
      isForClientSide: boolean
      pageId: string
      isExtractAssets: boolean
    }

function parseVirtualFileId(id: string): false | VirtualFileIdEntryParsed {
  id = removeVirtualFileIdPrefix(id)
  if (
    !id.startsWith(virtualFileIdGlobalEntryPrefix) &&
    !id.startsWith(virtualFileIdPageEntryPrefix) &&
    !id.startsWith(virtualFileIdRuntimePrefix)
  )
    return false

  // Environment-local public runtime API
  if (id.startsWith(virtualFileIdRuntimePrefix)) {
    const environmentName = id.slice(virtualFileIdRuntimePrefix.length)
    assert(environmentName && !environmentName.includes(':'))
    return { type: 'runtime', environmentName }
  }

  // Global entry
  if (id.startsWith(virtualFileIdGlobalEntryPrefix)) {
    const isClientRouting = id === virtualFileIdGlobalEntryClientCR
    const environmentName = (() => {
      if (id === virtualFileIdGlobalEntryServer) return 'server'
      if (id === virtualFileIdGlobalEntryClientSR || id === virtualFileIdGlobalEntryClientCR) return 'client'
      const environmentName = id.slice(virtualFileIdGlobalEntryPrefix.length)
      assert(environmentName && !environmentName.includes(':'))
      return environmentName
    })()
    const isForClientSide = environmentName === 'client'
    return {
      type: 'global-entry',
      environmentName,
      isForClientSide,
      isClientRouting,
    }
  }

  // Page entry
  if (id.startsWith(virtualFileIdPageEntryPrefix)) {
    const idOriginal = id
    id = extractAssetsRemoveQuery(id)
    const isExtractAssets = idOriginal !== id
    const environmentNameBegin = virtualFileIdPageEntryPrefix.length
    const environmentNameEnd = id.indexOf(':', environmentNameBegin)
    assert(environmentNameEnd > environmentNameBegin)
    const environmentName = id.slice(environmentNameBegin, environmentNameEnd)
    const pageIdSerialized = id.slice(environmentNameEnd + 1)
    const pageId = deserializePageId(pageIdSerialized)
    const isForClientSide = environmentName === 'client'
    if (isForClientSide) assert(isExtractAssets === false)
    return {
      type: 'page-entry',
      environmentName,
      pageId,
      isForClientSide,
      isExtractAssets,
    }
  }

  return false
}

function generateVirtualFileId(
  args:
    | { type: 'global-entry'; isForClientSide: boolean; isClientRouting: boolean }
    | { type: 'global-entry'; environmentName: string }
    | { type: 'page-entry'; pageId: string; isForClientSide: boolean }
    | { type: 'page-entry'; pageId: string; environmentName: string }
    | { type: 'runtime'; environmentName: string },
): string {
  if (args.type === 'runtime') {
    assert(args.environmentName && !args.environmentName.includes(':'))
    return `${virtualFileIdRuntimePrefix}${args.environmentName}`
  }
  if (args.type === 'global-entry') {
    if ('environmentName' in args) {
      assert(args.environmentName && !args.environmentName.includes(':'))
      return `${virtualFileIdGlobalEntryPrefix}${args.environmentName}`
    }
    const { isForClientSide, isClientRouting } = args
    if (!isForClientSide) {
      return virtualFileIdGlobalEntryServer
    } else if (isClientRouting) {
      return virtualFileIdGlobalEntryClientCR
    } else {
      return virtualFileIdGlobalEntryClientSR
    }
  }
  if (args.type === 'page-entry') {
    const { pageId } = args
    const pageIdSerialized = serializePageId(pageId)
    if (!('environmentName' in args)) {
      const prefix = args.isForClientSide ? virtualFileIdPageEntryClient : virtualFileIdPageEntryServer
      return `${prefix}${pageIdSerialized}`
    }
    const { environmentName } = args
    assert(environmentName && !environmentName.includes(':'))
    const id = `${virtualFileIdPageEntryPrefix}${environmentName}:${pageIdSerialized}` as const
    return id
  }
  assert(false)
}

// Workaround:
// - We replace virtual:vike:page-entry:client:/ with virtual:vike:page-entry:client:ROOT
// - In order to avoid Vite to replace `virtual:vike:page-entry:client:/` with `virtual:vike:page-entry:client:`
// - I guess Vite/Rollup mistakenly treat the virtual ID as a path and tries to normalize id
const ROOT = 'ROOT'
function serializePageId(pageId: string): string {
  return pageId === '/' ? ROOT : pageId
}
function deserializePageId(pageId: string): string {
  return pageId === ROOT ? '/' : pageId
}
