export function data(pageContext) {
  pageContext.headersResponse.append('Set-Cookie', 'core-cookie-a=1; Path=/')
  pageContext.headersResponse.append('Set-Cookie', 'core-cookie-b=2; Path=/')
  pageContext.headersResponse.append('X-Core-Header', 'from-vike')
  return { entries: [{ title: 'A general Vike feed' }] }
}
