// Power API Server 服務 (power_api_server)
const BASE_URL = import.meta.env.VITE_POWER_API_URL || 'http://localhost:8000'
const DEVICE_SINGLE = Number(import.meta.env.VITE_POWER_API_DEVICE_SINGLE) || 1
const DEVICE_THREE = Number(import.meta.env.VITE_POWER_API_DEVICE_THREE) || 2
const SPACE_ID = Number(import.meta.env.VITE_POWER_API_SPACE_ID) || 1

// 將 API 回傳的欄位映射為應用程式內部格式
const mapDeviceItem = (item) => ({
  voltage: parseFloat(item.voltage_v) || 0,
  current: parseFloat(item.current_a) || 0,
  power: parseFloat(item.power_w) || 0,
  energy: parseFloat(item.energy_kwh) || 0,
  frequency: parseFloat(item.frequency_hz) || 0,
  powerFactor: parseFloat(item.power_factor) || 0,
  carbonEmission: parseFloat(item.co2e_kg) || 0,
  timestamp: item.measured_at || item.updated_at || null
})

class PowerApiService {
  constructor() {
    this.isAvailable = false
  }

  async checkConnection() {
    try {
      const res = await fetch(`${BASE_URL}/api/test`, { signal: AbortSignal.timeout(3000) })
      const data = await res.json()
      this.isAvailable = data.status === 'ok'
      return this.isAvailable
    } catch {
      this.isAvailable = false
      return false
    }
  }

  // 取得指定裝置最新數據
  async getLatestDevice(deviceId) {
    const res = await fetch(`${BASE_URL}/api/devices/${deviceId}/latest`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return data.status === 'ok' ? mapDeviceItem(data.item) : null
  }

  // 取得所有裝置最新數據
  async getLatestAll() {
    const res = await fetch(`${BASE_URL}/api/latest`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return data.status === 'ok' ? (data.items || []).map(mapDeviceItem) : []
  }

  // 取得單相裝置最新數據
  async getSinglePhaseLatest() {
    return this.getLatestDevice(DEVICE_SINGLE)
  }

  // 取得三相裝置最新數據
  async getThreePhaseLatest() {
    return this.getLatestDevice(DEVICE_THREE)
  }

  // 取得今日用電量
  async getTodayEnergy(deviceId) {
    const res = await fetch(`${BASE_URL}/api/devices/${deviceId}/today-energy`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return data.status === 'ok' ? parseFloat(data.today_energy_kwh) || 0 : 0
  }

  // 取得今日碳排放
  async getTodayCo2e(deviceId) {
    const res = await fetch(`${BASE_URL}/api/devices/${deviceId}/today-co2e`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return data.status === 'ok' ? parseFloat(data.today_co2e_kg) || 0 : 0
  }

  // 取得歷史量測數據（用於單日分析）
  async getMeasurements(deviceId, start, end, limit = 1440) {
    const params = new URLSearchParams({ limit })
    if (start) params.set('start', start instanceof Date ? start.toISOString().replace('T', ' ').slice(0, 19) : start)
    if (end) params.set('end', end instanceof Date ? end.toISOString().replace('T', ' ').slice(0, 19) : end)
    const res = await fetch(`${BASE_URL}/api/devices/${deviceId}/measurements?${params}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return data.status === 'ok' ? data.items || [] : []
  }

  // 取得每日彙整數據（用於多日分析）
  async getDailySummary(deviceId, start, end) {
    const params = new URLSearchParams()
    if (start) params.set('start', start instanceof Date ? start.toISOString().split('T')[0] : start)
    if (end) params.set('end', end instanceof Date ? end.toISOString().split('T')[0] : end)
    const res = await fetch(`${BASE_URL}/api/devices/${deviceId}/daily-summary?${params}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return data.status === 'ok' ? data.items || [] : []
  }

  // 取得空間概覽
  async getSpaceOverview(spaceId = SPACE_ID) {
    const res = await fetch(`${BASE_URL}/api/spaces/${spaceId}/overview`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return data.status === 'ok' ? data : null
  }

  // 取得歷史資料並格式化為圖表格式（與 dataService.js 相容）
  async getHistoricalData(deviceId, startDate = null, endDate = null) {
    const historyData = {
      voltage: [], current: [], power: [], energy: [],
      frequency: [], powerFactor: [], carbonEmission: []
    }

    let isSingleDay = false
    if (startDate && endDate) {
      const diff = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24))
      isSingleDay = diff <= 1
    }

    if (isSingleDay) {
      const feeds = await this.getMeasurements(deviceId, startDate, endDate)
      const hourlyMap = new Map()
      const baseCarbon = feeds.length > 0 ? (parseFloat(feeds[0].co2e_kg) || 0) : 0

      feeds.forEach(f => {
        const hour = new Date(f.measured_at).getHours()
        if (!hourlyMap.has(hour)) hourlyMap.set(hour, [])
        hourlyMap.get(hour).push(f)
      })

      for (let h = 0; h < 24; h++) {
        const key = `${String(h).padStart(2, '0')}:00`
        if (hourlyMap.has(h)) {
          const arr = hourlyMap.get(h)
          const avg = (field) => arr.reduce((s, f) => s + (parseFloat(f[field]) || 0), 0) / arr.length
          const carbonAvg = avg('co2e_kg')
          historyData.voltage.push({ time: key, value: avg('voltage_v') })
          historyData.current.push({ time: key, value: avg('current_a') })
          historyData.power.push({ time: key, value: avg('power_w') })
          historyData.energy.push({ time: key, value: avg('energy_kwh') })
          historyData.frequency.push({ time: key, value: avg('frequency_hz') })
          historyData.powerFactor.push({ time: key, value: avg('power_factor') })
          historyData.carbonEmission.push({ time: key, value: Math.max(0, carbonAvg - baseCarbon) })
        } else {
          ['voltage', 'current', 'power', 'energy', 'frequency', 'powerFactor', 'carbonEmission']
            .forEach(k => historyData[k].push({ time: key, value: 0 }))
        }
      }
      return { status: 'success', data: historyData, mode: 'hourly' }
    }

    // 多日：使用 daily-summary
    const summaries = await this.getDailySummary(deviceId, startDate, endDate)
    let prevCarbon = null

    summaries.forEach(s => {
      const [, month, day] = s.date.split('-')
      const time = `${month}/${day}`
      const carbonVal = parseFloat(s.co2e_kg) || 0
      const carbonInc = prevCarbon !== null ? Math.max(0, carbonVal - prevCarbon) : 0
      prevCarbon = carbonVal

      historyData.voltage.push({ time, value: parseFloat(s.avg_power_w) || 0 })
      historyData.current.push({ time, value: 0 })
      historyData.power.push({ time, value: parseFloat(s.avg_power_w) || 0 })
      historyData.energy.push({ time, value: parseFloat(s.energy_kwh) || 0 })
      historyData.frequency.push({ time, value: 0 })
      historyData.powerFactor.push({ time, value: 0 })
      historyData.carbonEmission.push({ time, value: carbonInc })
    })

    return { status: 'success', data: historyData, mode: 'daily' }
  }
}

export const DEVICE_ID = { SINGLE: DEVICE_SINGLE, THREE: DEVICE_THREE, SPACE: SPACE_ID }
export default new PowerApiService()
