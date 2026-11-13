import { afterEach, describe, expect, it } from 'vitest'
import {
  GEOLOCATION_OPTIONS,
  locateCity,
  useGeolocation,
  type GeolocationLike,
} from '../useGeolocation'

function fakeGeolocation(
  implementation: (
    success: PositionCallback,
    error?: PositionErrorCallback | null,
    options?: PositionOptions,
  ) => void,
): GeolocationLike {
  return { getCurrentPosition: implementation }
}

describe('locateCity', () => {
  it('浏览器没有定位 API 时降级为不可用', async () => {
    await expect(locateCity(undefined)).resolves.toEqual({ location: null, status: 'unavailable' })
    await expect(locateCity(null)).resolves.toEqual({ location: null, status: 'unavailable' })
  })

  it('命中城市时返回城市名', async () => {
    const geo = fakeGeolocation((success) => {
      success({ coords: { latitude: 39.9042, longitude: 116.4074 } } as GeolocationPosition)
    })

    await expect(locateCity(geo)).resolves.toEqual({ location: '北京', status: 'ready' })
  })

  it('坐标不在任何已知城市附近时降级为不可用', async () => {
    const geo = fakeGeolocation((success) => {
      success({ coords: { latitude: 0, longitude: 0 } } as GeolocationPosition)
    })

    await expect(locateCity(geo)).resolves.toEqual({ location: null, status: 'unavailable' })
  })

  it('用户拒绝授权时降级为不可用', async () => {
    const geo = fakeGeolocation((_success, error) => {
      error?.({ code: 1, message: 'denied' } as GeolocationPositionError)
    })

    await expect(locateCity(geo)).resolves.toEqual({ location: null, status: 'unavailable' })
  })

  it('定位 API 抛出异常时降级为不可用', async () => {
    const geo = fakeGeolocation(() => {
      throw new Error('not supported')
    })

    await expect(locateCity(geo)).resolves.toEqual({ location: null, status: 'unavailable' })
  })

  it('使用 8 秒超时与低保真的定位参数', async () => {
    let received: PositionOptions | undefined
    const geo = fakeGeolocation((success, _error, options) => {
      received = options
      success({ coords: { latitude: 39.9042, longitude: 116.4074 } } as GeolocationPosition)
    })

    await locateCity(geo)

    expect(received).toBe(GEOLOCATION_OPTIONS)
    expect(GEOLOCATION_OPTIONS).toMatchObject({
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: 600000,
    })
  })
})

describe('useGeolocation', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'geolocation')
  })

  it('无定位能力时返回不可用', async () => {
    const { locate } = useGeolocation()

    await expect(locate()).resolves.toEqual({ location: null, status: 'unavailable' })
  })

  it('使用浏览器定位能力', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: fakeGeolocation((success) => {
        success({ coords: { latitude: 31.2304, longitude: 121.4737 } } as GeolocationPosition)
      }),
    })

    const { locate } = useGeolocation()

    await expect(locate()).resolves.toEqual({ location: '上海', status: 'ready' })
  })
})
