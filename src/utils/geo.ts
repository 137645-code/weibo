/** 命中阈值：与最近城市的距离超过该值即视为不在已知城市附近 */
export const CITY_RADIUS_KM = 200

/** [城市名, 纬度, 经度]，离线匹配，不调用任何外部接口 */
export const CITY_TABLE: ReadonlyArray<readonly [string, number, number]> = [
  ['北京', 39.9, 116.41],
  ['上海', 31.23, 121.47],
  ['广州', 23.13, 113.26],
  ['深圳', 22.54, 114.06],
  ['天津', 39.08, 117.2],
  ['重庆', 29.56, 106.55],
  ['成都', 30.57, 104.07],
  ['杭州', 30.27, 120.16],
  ['南京', 32.06, 118.8],
  ['武汉', 30.59, 114.31],
  ['西安', 34.34, 108.94],
  ['苏州', 31.3, 120.58],
  ['郑州', 34.75, 113.63],
  ['长沙', 28.23, 112.94],
  ['青岛', 36.07, 120.38],
  ['沈阳', 41.81, 123.43],
  ['大连', 38.91, 121.61],
  ['厦门', 24.48, 118.09],
  ['福州', 26.07, 119.3],
  ['济南', 36.65, 117.12],
  ['合肥', 31.82, 117.23],
  ['昆明', 25.04, 102.71],
  ['南昌', 28.68, 115.86],
  ['贵阳', 26.65, 106.63],
  ['南宁', 22.82, 108.37],
  ['太原', 37.87, 112.55],
  ['石家庄', 38.04, 114.51],
  ['哈尔滨', 45.8, 126.53],
  ['长春', 43.82, 125.32],
  ['兰州', 36.06, 103.83],
  ['乌鲁木齐', 43.83, 87.62],
  ['呼和浩特', 40.84, 111.75],
  ['银川', 38.49, 106.23],
  ['西宁', 36.62, 101.78],
  ['拉萨', 29.65, 91.14],
  ['海口', 20.04, 110.2],
  ['香港', 22.32, 114.17],
  ['台北', 25.03, 121.57],
  ['澳门', 22.2, 113.54],
]

function toRadians(value: number): number {
  return (value * Math.PI) / 180
}

/** Haversine 球面距离，单位公里 */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const earthRadius = 6371
  const dLat = toRadians(lat2 - lat1)
  const dLng = toRadians(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)

  return 2 * earthRadius * Math.asin(Math.sqrt(a))
}

/**
 * 在坐标表里找最近城市，超出阈值返回 null。
 */
export function matchCity(
  lat: number,
  lng: number,
  radiusKm: number = CITY_RADIUS_KM,
): string | null {
  let nearestName: string | null = null
  let nearestKm = Number.POSITIVE_INFINITY

  for (const [name, cityLat, cityLng] of CITY_TABLE) {
    const distance = distanceKm(lat, lng, cityLat, cityLng)
    if (distance < nearestKm) {
      nearestKm = distance
      nearestName = name
    }
  }

  return nearestKm <= radiusKm ? nearestName : null
}
