import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, fetch, getServerUrl, run, test } from '@brillout/test-e2e'
import { fixtureRunOptions, tolerateFixtureWarning } from './.testPageContextResponse'

const fixture = '../pageContextResponse/atom'
const testDir = fileURLToPath(new URL('.', import.meta.url))
const artifactPath = fileURLToPath(
  new URL('../pageContextResponse/atom/dist/client/feed.atom/index.html', import.meta.url),
)

execFileSync('pnpm', ['exec', 'vite', 'build', fixture], { cwd: testDir, stdio: 'inherit' })

run(`pnpm exec vite preview ${fixture} --port 3144 --strictPort`, {
  ...fixtureRunOptions(3144),
  tolerateError: ({ logText }) => tolerateFixtureWarning(logText),
})

test('content becomes the prerendered file content', () => {
  expect(existsSync(artifactPath)).toBe(true)
  expect(readFileSync(artifactPath, 'utf8')).toContain('<category term="prerendered"/>')
})

test('the prerendered artifact is served at its route URL', async () => {
  const response = await fetch(`${getServerUrl()}/feed.atom`, { redirect: 'manual' })

  expect(response.status).toBe(200)
  expect(await response.text()).toContain('<category term="prerendered"/>')
})
