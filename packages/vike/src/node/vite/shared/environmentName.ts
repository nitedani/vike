export { getVikeEnvironmentName }
export { isVikeEnvironmentBuiltIn }

import '../assertEnvVite.js'

// - Vite's `ssr` environment is Vike's `server` environment
// - Other Vite environments share their name with a Vike environment
function getVikeEnvironmentName(viteEnvironmentName: string): string {
  if (viteEnvironmentName === 'ssr') return 'server'
  return viteEnvironmentName
}

// - Vike's `client` and `server` environments don't need to be declared in Vite's config.environments
function isVikeEnvironmentBuiltIn(environmentName: string): boolean {
  return environmentName === 'client' || environmentName === 'server'
}
