import { test } from './test'

process.env.ALWAYS_FETCH_PAGE_CONTEXT_FROM_SERVER = 'true'

test('pnpm run dev', true)
