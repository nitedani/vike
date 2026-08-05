import { redirect } from 'vike/abort'

export function guard() {
  throw redirect('/about')
}
