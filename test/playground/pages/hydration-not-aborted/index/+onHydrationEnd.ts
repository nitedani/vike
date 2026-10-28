export { onHydrationEnd }

// Gives the test time to click the link while +onHydrationEnd is running
async function onHydrationEnd() {
  await new Promise((resolve) => setTimeout(resolve, 2000))
}
