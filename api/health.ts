import { allowOnly, type ApiRequest, type ApiResponse } from './_lib/http.js'

export default function handler(request: ApiRequest, response: ApiResponse): void {
  if (!allowOnly(request, response, 'GET')) return
  response.status(200).json({ status: 'ok', time: new Date().toISOString() })
}
