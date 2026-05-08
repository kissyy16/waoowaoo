// Next.js Instrumentation - 在应用启动时执行
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { registerNodeInstrumentation } = await import('./instrumentation-node')
  await registerNodeInstrumentation()
}
