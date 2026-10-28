export default Page

import React from 'react'

function Page() {
  return <p>Never rendered on the client-side because of +guard.client.ts</p>
}
