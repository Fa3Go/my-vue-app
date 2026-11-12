// 資料管理服務：唯一資料來源為 Power API Server（server/）
import powerApiService, { DEVICE_ID } from './powerApiService.js'

const UPDATE_INTERVAL = Number(import.meta.env.VITE_DATA_UPDATE_INTERVAL) || 10000
const CACHE_TTL = Math.max(UPDATE_INTERVAL * 3, 30000)

// 快取 key → 裝置 ID
const CACHE_KEYS = {
  singlePhase: DEVICE_ID.SINGLE,
  single220Phase: DEVICE_ID.SINGLE220,
  threePhase: DEVICE_ID.THREE
}

class DataManager {
  constructor() {
    this.dataInterval = null
    this.lastUpdate = null
    this.isPowerApiEnabled = false
    this.cache = new Map()
    this.initPromise = null
  }

  // 可重複呼叫，只會初始化一次
  init() {
    if (!this.initPromise) {
      this.initPromise = (async () => {
        const ok = await powerApiService.checkConnection()
        this.isPowerApiEnabled = ok
        if (ok) console.log('✅ Power API Server 連接成功')
        else console.warn('⚠️ Power API Server 無法連接，請確認 server/ 已啟動（預設 :8000）')
        await this.updateAllData()
        this.startDataUpdate()
      })()
    }
    return this.initPromise
  }

  startDataUpdate() {
    this.stopDataUpdate()
    this.dataInterval = setInterval(() => this.updateAllData(), UPDATE_INTERVAL)
  }

  stopDataUpdate() {
    if (this.dataInterval) {
      clearInterval(this.dataInterval)
      this.dataInterval = null
    }
  }

  async updateAllData() {
    try {
      const latest = await powerApiService.getLatestAll()
      this.isPowerApiEnabled = true
      powerApiService.isAvailable = true
      Object.entries(CACHE_KEYS).forEach(([key, deviceId]) => {
        if (latest[deviceId]) this.cacheData(key, latest[deviceId])
      })
      // 系統狀態沿用單相 110V 讀值
      if (latest[DEVICE_ID.SINGLE]) this.cacheData('systemStatus', latest[DEVICE_ID.SINGLE])
      this.lastUpdate = new Date()
    } catch (error) {
      this.isPowerApiEnabled = false
      powerApiService.isAvailable = false
      console.error('❌ 更新資料失敗:', error)
    }
  }

  cacheData(key, data) {
    this.cache.set(key, { data, timestamp: Date.now() })
  }

  getCachedData(key) {
    const cached = this.cache.get(key)
    if (!cached) return null
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      this.cache.delete(key)
      return null
    }
    return cached.data
  }

  getSinglePhaseData() {
    return this.getCachedData('singlePhase')
  }

  getThreePhaseData() {
    return this.getCachedData('threePhase')
  }

  getSingle220PhaseData() {
    return this.getCachedData('single220Phase')
  }

  getSystemStatus() {
    return this.getCachedData('systemStatus')
  }

  getConnectionStatus() {
    return {
      powerApi: this.isPowerApiEnabled ? 'connected' : 'disconnected',
      lastUpdate: this.lastUpdate
    }
  }

  async refreshData() {
    await this.updateAllData()
  }

  destroy() {
    this.stopDataUpdate()
    this.cache.clear()
    this.initPromise = null
  }
}

const dataManager = new DataManager()

export default dataManager
