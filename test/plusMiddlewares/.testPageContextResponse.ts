export { fixtureCommand, fixtureRunOptions, tolerateFixtureWarning }

function fixtureCommand(name: string, port: number): string {
  return `pnpm exec vite dev ../pageContextResponse/${name} --port ${port} --strictPort`
}

function fixtureRunOptions(port: number) {
  const serverUrl = `http://localhost:${port}`
  return {
    serverUrl,
    serverIsReadyMessage: (log: string) => log.includes('Local:') && log.includes(serverUrl),
  }
}

function tolerateFixtureWarning(logText: string): boolean {
  return logText.includes('Failed to resolve dependency: vike >') || logText.includes('[COMMONJS_VARIABLE_IN_ESM]')
}
