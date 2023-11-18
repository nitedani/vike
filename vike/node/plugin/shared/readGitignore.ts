export { readGitignore, setReadGitignore }

import { cwd } from 'node:process'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { getGlobalObject, unique } from '../utils.js'

const globalObject = getGlobalObject<{
  gitignoreLines?: string[]
  enabled: boolean
}>('findPageFiles.ts', { enabled: false })

function setReadGitignore(enabled: boolean) {
  globalObject.enabled = enabled
}

async function readGitignore(userRootDir: string) {
  if (!globalObject.enabled) {
    return []
  }
  const { gitignoreLines } = globalObject
  if (gitignoreLines) {
    return gitignoreLines
  }
  const searchDirs = [userRootDir, cwd()]
  const allLines: string[] = []
  for (const dir of searchDirs) {
    const res = await readdir(dir)
    const match = res.find((fname) => fname.toLowerCase() === '.gitignore')
    if (match) {
      const content = await readFile(join(dir, match), 'utf8')
      const lines = content.replace(/\r\n/g, '\n').split('\n')
      allLines.push(...lines)
    }
  }

  const uniqueLines = unique(allLines)
  globalObject.gitignoreLines = uniqueLines
  return uniqueLines
}
