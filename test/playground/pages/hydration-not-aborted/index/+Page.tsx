export default Page

import React from 'react'
import { Counter } from '../../../components/Counter'

function Page() {
  return (
    <>
      <h1>Hydration not aborted</h1>
      <p>
        <a href="/markdown">Link</a> clicked while +onHydrationEnd is running
      </p>
      <Counter />
    </>
  )
}
