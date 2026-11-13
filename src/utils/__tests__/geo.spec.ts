import { describe, expect, it } from 'vitest'
import { CITY_RADIUS_KM, distanceKm, matchCity } from '../geo'

const BEIJING = { lat: 39.9042, lng: 116.4074 }
const SHANGHAI = { lat: 31.2304, lng: 121.4737 }

describe('distanceKm', () => {
  it('同一点距离为 0', () => {
    expect(distanceKm(BEIJING.lat, BEIJING.lng, BEIJING.lat, BEIJING.lng)).toBe(0)
  })

  it('北京到上海约 1060 公里', () => {
    const d = distanceKm(BEIJING.lat, BEIJING.lng, SHANGHAI.lat, SHANGHAI.lng)
    expect(d).toBeGreaterThan(1030)
    expect(d).toBeLessThan(1100)
  })
})

describe('matchCity', () => {
  it('命中阈值内的城市', () => {
    expect(matchCity(BEIJING.lat, BEIJING.lng)).toBe('北京')
    expect(matchCity(SHANGHAI.lat, SHANGHAI.lng)).toBe('上海')
  })

  it('未命中任何城市时返回 null', () => {
    expect(matchCity(0, 0)).toBeNull()
    expect(matchCity(64.1, -21.9)).toBeNull()
  })

  it('超出城市半径阈值时返回 null', () => {
    // 纬度偏移 1.75° ≈ 195 公里，仍在 200 公里阈值内
    expect(matchCity(BEIJING.lat + 1.75, BEIJING.lng)).toBe('北京')
    // 纬度偏移 2.3° ≈ 256 公里，超出阈值
    expect(matchCity(BEIJING.lat + 2.3, BEIJING.lng)).toBeNull()
  })

  it('半径阈值为 200 公里', () => {
    expect(CITY_RADIUS_KM).toBe(200)
  })
})
