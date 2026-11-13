import type { LocateResult } from '@/types/post'
import { matchCity } from '@/utils/geo'

/** 定位参数：低保真、8 秒超时、10 分钟缓存，失败不影响发布与浏览 */
export const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 8000,
  maximumAge: 600000,
}

/** 浏览器定位 API 的最小结构，便于测试注入假实现 */
export interface GeolocationLike {
  getCurrentPosition(
    success: PositionCallback,
    error?: PositionErrorCallback | null,
    options?: PositionOptions,
  ): void
}

/**
 * 请求定位并匹配城市。任何失败（无 API、拒绝授权、超时、异常）
 * 都只降级为「位置不可用」，不抛错、不影响发布与浏览。
 */
export function locateCity(geolocation: GeolocationLike | null | undefined): Promise<LocateResult> {
  return new Promise((resolve) => {
    if (!geolocation || typeof geolocation.getCurrentPosition !== 'function') {
      resolve({ location: null, status: 'unavailable' })
      return
    }

    try {
      geolocation.getCurrentPosition(
        (position) => {
          let city: string | null = null
          try {
            city = matchCity(position.coords.latitude, position.coords.longitude)
          } catch {
            city = null
          }

          resolve(
            city ? { location: city, status: 'ready' } : { location: null, status: 'unavailable' },
          )
        },
        () => resolve({ location: null, status: 'unavailable' }),
        GEOLOCATION_OPTIONS,
      )
    } catch {
      resolve({ location: null, status: 'unavailable' })
    }
  })
}

/**
 * 定位能力封装：对外只暴露一次定位请求，内部负责降级。
 */
export function useGeolocation() {
  function locate(): Promise<LocateResult> {
    const geolocation = typeof navigator === 'undefined' ? undefined : navigator.geolocation
    return locateCity(geolocation)
  }

  return { locate }
}
