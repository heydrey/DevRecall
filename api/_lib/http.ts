export interface ApiRequest {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
}

export interface ApiResponse {
  status(code: number): ApiResponse
  json(value: unknown): void
  setHeader(name: string, value: string): void
}

export class ApiError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message)
  }
}

export function authorizationInitData(request: ApiRequest): string {
  const header = request.headers.authorization
  const value = Array.isArray(header) ? header[0] : header
  if (!value?.startsWith('tma ')) throw new ApiError(401, 'Не переданы данные авторизации Telegram.')
  return value.slice(4).trim()
}

export function sendError(response: ApiResponse, error: unknown): void {
  const status = error instanceof ApiError ? error.statusCode : 500
  const message = error instanceof ApiError ? error.message : 'Внутренняя ошибка сервера.'
  if (!(error instanceof ApiError)) console.error(error)
  response.status(status).json({ error: message })
}

export function allowOnly(request: ApiRequest, response: ApiResponse, method: string): boolean {
  response.setHeader('Cache-Control', 'no-store')
  if (request.method === method) return true
  response.status(405).json({ error: 'Метод не поддерживается.' })
  return false
}
