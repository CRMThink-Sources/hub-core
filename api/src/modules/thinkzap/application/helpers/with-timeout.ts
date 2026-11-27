/**
 * Libera quem chamou se `work` não terminar em `ms`. O trabalho não é cancelado:
 * segue em segundo plano.
 */
export async function withTimeout<T>(
  work: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms)
  })

  try {
    return await Promise.race([work, timeout])
  } finally {
    clearTimeout(timer)
  }
}
