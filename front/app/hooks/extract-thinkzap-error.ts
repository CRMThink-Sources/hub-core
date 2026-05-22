export function extractThinkzapError(err: unknown, fallback: string): string {
  if (
    err &&
    typeof err === 'object' &&
    'response' in err &&
    err.response &&
    typeof err.response === 'object' &&
    'data' in err.response
  ) {
    const data = err.response.data
    if (data && typeof data === 'object' && 'result' in data) {
      const result = data.result
      if (
        result &&
        typeof result === 'object' &&
        'error' in result &&
        typeof result.error === 'string'
      ) {
        return (result as { error: string }).error
      }
    }
  }
  return fallback
}
