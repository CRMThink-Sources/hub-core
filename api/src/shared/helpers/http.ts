export type httpResponse<T = unknown> = {
  status: number
  result: T
}
