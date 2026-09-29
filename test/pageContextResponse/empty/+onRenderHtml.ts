export default function onRenderHtml() {
  throw new Error('The HTML renderer should not run for an empty response')
}
