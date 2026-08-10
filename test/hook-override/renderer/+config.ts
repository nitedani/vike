export default {
  clientRouting: true,
  hydrationCanBeAborted: true,
  passToClient: ['user'],
  ...(process.env.ALWAYS_FETCH_PAGE_CONTEXT_FROM_SERVER === 'true' ? { alwaysFetchPageContextFromServer: true } : {}),
}
