import { galleryApp } from './gallery/app'

export function fetch(request: Request): Promise<Response> {
  return galleryApp(request)
}
