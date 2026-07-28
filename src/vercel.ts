import { app } from './app'

export function fetch(request: Request): Promise<Response> {
  return app(request)
}
