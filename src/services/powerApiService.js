// Power API Server 服務（後端位於 server/，讀取 power_monitoring_mqtt）
// 開發時由 Vite proxy 把 /api 轉到 http://127.0.0.1:8000；部署時可用 VITE_POWER_API_URL 指定
const BASE_URL = import.meta.env.VITE_POWER_API_URL || ''

// 裝置 ID（對應 DB devices 表）
export const DEVICE_ID = {
  SINGLE: Number(import.meta.env.VITE_POWER_API_DEVICE_SINGLE) || 1, // H707 單相 110V
  SINGLE220: Number(import.meta.env.VITE_POWER_API_DEVICE_SINGLE220) || 2, // H707 單相 220V
  THREE: Number(import.meta.env.VITE_POWER_API_DEVICE_THREE) || 3, // H707 三相 220V
  SPACE: Number(import.meta.env.VITE_POWER_API_SPACE_ID) || 1
}

// 前端迴路代號 → 裝置 ID
export const deviceIdByType = (type) => ({
  single: DEVICE_ID.SINGLE,
  single220: DEVICE_ID.SINGLE220,
  three: DEVICE_ID.THREE
}[type])

const num = (v) => (v === null || v === undefined ? 0 : Number(v) || 0)
const round2 = (v) => Math.round(num(v) * 100) / 100

// 以瀏覽器本地時區（台灣）格式化 YYYY-MM-DD
export const toLocalDateString = (d) => {
  const date = d instanceof Date ? d : new Date(d)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// API 的 latest item → 應用程式內部格式。carbonEmission 為「今日碳排放增量」
const mapLatestItem = (item) => ({
  voltage: round2(item.voltage_v),
  current: round2(item.current_a),
  power: round2(item.power_w),
  energy: round2(item.energy_kwh),
  frequency: round2(item.frequency_hz),
  powerFactor: round2(item.power_factor),
  carbonEmission: round2(item.today_co2e_kg),
  todayEnergy: round2(item.today_energy_kwh),
  timestamp: item.measured_at ? new Date(item.measured_at) : null // ISO 8601（UTC）
})

const emptyHistory = () => ({
  voltage: [], current: [], power: [], energy: [],
  frequency: [], powerFactor: [], carbonEmission: []
})

class PowerApiService {
  constructor() {
    this.isAvailable = false
  }

  async request(path) {
    const res = await fetch(`${BASE_URL}${path}`)
    if (!res.ok) throw new Error(`Power API ${path} → HTTP ${res.status}`)
    return res.json()
  }

  async checkConnection() {
    try {
      const res = await fetch(`${BASE_URL}/api/test`, { signal: AbortSignal.timeout(3000) })
      const data = await res.json()
      this.isAvailable = data.status === 'ok'
    } catch {
      this.isAvailable = false
    }
    return this.isAvailable
  }

  // 指定裝置最新有效讀值（含今日用電與碳排）
  async getLatestDevice(deviceId) {
    const data = await this.request(`/api/devices/${deviceId}/latest`)
    return data.status === 'ok' && data.item ? mapLatestItem(data.item) : null
  }

  // 所有裝置最新讀值，回傳 { [deviceId]: data }
  async getLatestAll() {
    const data = await this.request('/api/latest')
    const map = {}
    ;(data.items || []).forEach(item => { map[item.device_id] = mapLatestItem(item) })
    return map
  }

  async getTodayEnergy(deviceId) {
    const data = await this.request(`/api/devices/${deviceId}/today-energy`)
    return num(data.today_energy_kwh)
  }

  async getTodayCo2e(deviceId) {
    const data = await this.request(`/api/devices/${deviceId}/today-co2e`)
    return num(data.today_co2e_kg)
  }

  // 台灣時間某日 24 小時彙整
  async getHourly(deviceId, date = new Date()) {
    const data = await this.request(`/api/devices/${deviceId}/hourly?date=${toLocalDateString(date)}`)
    return data.items || []
  }

  // 每日彙整（含首尾日，沒資料的日子 samples=0）
  async getDailySummary(deviceId, start, end) {
    const params = new URLSearchParams()
    if (start) params.set('start', toLocalDateString(start))
    if (end) params.set('end', toLocalDateString(end))
    const data = await this.request(`/api/devices/${deviceId}/daily-summary?${params}`)
    return data.items || []
  }

  // 最近 N 個月彙整
  async getMonthly(deviceId, months = 12) {
    const data = await this.request(`/api/devices/${deviceId}/monthly?months=${months}`)
    return data.items || []
  }

  async getSpaceOverview(spaceId = DEVICE_ID.SPACE) {
    const data = await this.request(`/api/spaces/${spaceId}/overview`)
    return data.status === 'ok' ? data : null
  }

  // 歷史資料（歷史數據分析頁）
  // - 起訖為同一天：該日 24 小時，energy / carbonEmission 為 00:00 起的累計值
  // - 多日（或未指定，預設最近 7 天）：每日彙整，energy / carbonEmission 為當日增量
  async getHistoricalData(deviceId, startDate = null, endDate = null) {
    const history = emptyHistory()
    const push = (time, values) => Object.keys(history).forEach(k => history[k].push({ time, value: round2(values[k]) }))

    const isSingleDay = startDate && endDate && toLocalDateString(startDate) === toLocalDateString(endDate)

    if (isSingleDay) {
      const items = await this.getHourly(deviceId, startDate)
      items.forEach(h => push(h.hour, {
        voltage: h.avg_voltage_v,
        current: h.avg_current_a,
        power: h.avg_power_w,
        energy: h.cum_energy_kwh,
        frequency: h.avg_frequency_hz,
        powerFactor: h.avg_power_factor,
        carbonEmission: h.cum_co2e_kg
      }))
      return { status: 'success', data: history, mode: 'hourly' }
    }

    const items = await this.getDailySummary(deviceId, startDate, endDate)
    items.forEach(s => {
      const [, month, day] = s.date.split('-')
      push(`${month}/${day}`, {
        voltage: s.avg_voltage_v,
        current: s.avg_current_a,
        power: s.avg_power_w,
        energy: s.energy_kwh,
        frequency: s.avg_frequency_hz,
        powerFactor: s.avg_power_factor,
        carbonEmission: s.co2e_kg
      })
    })
    return { status: 'success', data: history, mode: 'daily' }
  }

  // 碳排放趨勢（碳排放分析頁），回傳 [{ time, value }]，value 為各區間增量 kgCO2e
  async getCarbonSeries(deviceId, range) {
    if (range === 'day') {
      const items = await this.getHourly(deviceId, new Date())
      return items.map(h => ({ time: h.hour, value: num(h.co2e_kg) }))
    }
    if (range === 'year') {
      const items = await this.getMonthly(deviceId, 12)
      return items.map(m => ({ time: m.month.replace('-', '/'), value: num(m.co2e_kg) }))
    }
    const days = range === 'week' ? 7 : 30
    const end = new Date()
    const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (days - 1))
    const items = await this.getDailySummary(deviceId, start, end)
    return items.map(s => {
      const [, month, day] = s.date.split('-')
      return { time: `${Number(month)}/${Number(day)}`, value: num(s.co2e_kg) }
    })
  }
}

export default new PowerApiService()
