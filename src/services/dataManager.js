// 資料管理服務
import thingSpeakService from './thingspeak.js'
import dataService from './dataService.js'
import { getConfig, validateConfig } from '../config/thingspeak.config.js'
import powerApiService, { DEVICE_ID } from './powerApiService.js'

class DataManager {
  constructor() {
    this.isThingSpeakEnabled = getConfig('api.enableThingSpeak')
    this.isMockDataEnabled = getConfig('api.enableMockData')
    this.updateInterval = getConfig('api.updateInterval')

    this.dataInterval = null
    this.lastUpdate = null
    this.connectionStatus = 'unknown'

    // 資料快取
    this.cache = new Map()
    this.cacheTTL = getConfig('cache.ttl')

    // 當日碳排放增量快取（分別為單相和三相）
    this.singlePhaseCarbonIncrement = 0
    this.singlePhaseLastCarbonValue = null
    this.singlePhaseTodayStartValue = null

    this.threePhaseCarbonIncrement = 0
    this.threePhaseLastCarbonValue = null
    this.threePhaseTodayStartValue = null

    // 初始化
    this.init()
  }

  async init() {
    // 優先嘗試連接 Power API Server
    const powerApiOk = await powerApiService.checkConnection()
    if (powerApiOk) {
      console.log('✅ Power API Server 連接成功，使用 Power API 資料')
      this.isPowerApiEnabled = true
    } else {
      console.warn('⚠️ Power API Server 無法連接，嘗試 ThingSpeak')
      this.isPowerApiEnabled = false
    }

    // 檢查 ThingSpeak 配置（作為備用）
    if (!this.isPowerApiEnabled && this.isThingSpeakEnabled) {
      const isValid = validateConfig()
      if (isValid) {
        await this.checkThingSpeakConnection()
        await this.initSinglePhaseCarbonBaseline()
        await this.initThreePhaseCarbonBaseline()
      } else {
        console.warn('ThingSpeak 配置無效，將使用模擬資料')
        this.isThingSpeakEnabled = false
      }
    }

    // 立即抓取一次資料，避免等待第一次輪詢間隔（預設 30 秒）才有資料可顯示
    await this.updateAllData()

    // 啟動資料更新
    this.startDataUpdate()
  }

  // 初始化單相當日碳排放基準值
  async initSinglePhaseCarbonBaseline() {
    try {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)

      const startISO = yesterday.toISOString()
      const endISO = now.toISOString()

      // 使用單相 Channel ID
      const channelId = import.meta.env.VITE_THINGSPEAK_CHANNEL_ID_SINGLE
      const apiKey = import.meta.env.VITE_THINGSPEAK_API_KEY_SINGLE
      const url = `https://api.thingspeak.com/channels/${channelId}/feeds.json?api_key=${apiKey}&start=${startISO}&end=${endISO}&average=1440`

      const response = await fetch(url)
      const data = await response.json()

      if (data.feeds && data.feeds.length >= 2) {
        this.singlePhaseTodayStartValue = parseFloat(data.feeds[data.feeds.length - 2].field7) || 0
        this.singlePhaseLastCarbonValue = parseFloat(data.feeds[data.feeds.length - 1].field7) || 0
        this.singlePhaseCarbonIncrement = Math.max(0, this.singlePhaseLastCarbonValue - this.singlePhaseTodayStartValue)
        console.log('✅ 單相碳排放基準初始化成功')
      }
    } catch (error) {
      console.error('❌ 初始化單相碳排放基準失敗:', error)
    }
  }

  // 初始化三相當日碳排放基準值
  async initThreePhaseCarbonBaseline() {
    try {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)

      const startISO = yesterday.toISOString()
      const endISO = now.toISOString()

      // 使用三相 Channel ID
      const channelId = import.meta.env.VITE_THINGSPEAK_CHANNEL_ID_THREE
      const apiKey = import.meta.env.VITE_THINGSPEAK_API_KEY_THREE
      const url = `https://api.thingspeak.com/channels/${channelId}/feeds.json?api_key=${apiKey}&start=${startISO}&end=${endISO}&average=1440`

      const response = await fetch(url)
      const data = await response.json()

      if (data.feeds && data.feeds.length >= 2) {
        this.threePhaseTodayStartValue = parseFloat(data.feeds[data.feeds.length - 2].field7) || 0
        this.threePhaseLastCarbonValue = parseFloat(data.feeds[data.feeds.length - 1].field7) || 0
        this.threePhaseCarbonIncrement = Math.max(0, this.threePhaseLastCarbonValue - this.threePhaseTodayStartValue)
        console.log('✅ 三相碳排放基準初始化成功')
      }
    } catch (error) {
      console.error('❌ 初始化三相碳排放基準失敗:', error)
    }
  }

  // 檢查 ThingSpeak 連接狀態
  async checkThingSpeakConnection() {
    try {
      // console.log('開始檢查 ThingSpeak 連接狀態...')
      const status = await thingSpeakService.checkServiceStatus()
      // console.log('連接狀態檢查結果:', status)

      this.connectionStatus = status.status

      if (status.status === 'connected') {
        // console.log('✅ ThingSpeak 連接成功:', status.channelName)
      } else {
        // console.warn('❌ ThingSpeak 連接失敗:', status.error)
        this.isThingSpeakEnabled = false
      }
    } catch (error) {
      // console.error('❌ 檢查 ThingSpeak 連接失敗:', error)
      this.connectionStatus = 'error'
      this.isThingSpeakEnabled = false
    }
  }

  // 啟動資料更新
  startDataUpdate() {
    if (this.dataInterval) {
      clearInterval(this.dataInterval)
    }

    // ThingSpeak 資料更新（每30秒一次）
    this.dataInterval = setInterval(() => {
      this.updateAllData()
    }, this.updateInterval)
    
    // 單相資料更新（每2秒一次，保持跳動效果）
    this.singlePhaseInterval = setInterval(() => {
      this.updateSinglePhaseMockData()
    }, 2000)
  }

  // 停止資料更新
  stopDataUpdate() {
    if (this.dataInterval) {
      clearInterval(this.dataInterval)
      this.dataInterval = null
    }
    if (this.singlePhaseInterval) {
      clearInterval(this.singlePhaseInterval)
      this.singlePhaseInterval = null
    }
  }

  // 更新所有資料
  async updateAllData() {
    try {
      if (this.isPowerApiEnabled) {
        await this.updatePowerApiData()
        this.lastUpdate = new Date()
      } else if (this.isThingSpeakEnabled) {
        await this.updateThingSpeakData()
        this.lastUpdate = new Date()
      }
    } catch (error) {
      console.error('❌ 更新資料失敗:', error)
    }
  }

  // 從 Power API Server 更新資料
  async updatePowerApiData() {
    const [singleData, threeData] = await Promise.all([
      powerApiService.getSinglePhaseLatest(),
      powerApiService.getThreePhaseLatest()
    ])

    if (singleData) {
      try { singleData.carbonEmission = await powerApiService.getTodayCo2e(DEVICE_ID.SINGLE) } catch { /* keep original */ }
      this.cacheData('singlePhase', singleData)
      this.cacheData('systemStatus', singleData)
    }

    if (threeData) {
      try { threeData.carbonEmission = await powerApiService.getTodayCo2e(DEVICE_ID.THREE) } catch { /* keep original */ }
      this.cacheData('threePhase', threeData)
    }
  }

  // 單相資料也使用 ThingSpeak 真實資料（不再使用模擬資料）
  updateSinglePhaseMockData() {
    // 移除模擬資料，單相也使用真實資料
    // console.log('單相資料將使用 ThingSpeak 真實資料')
  }

  // 更新 ThingSpeak 資料
  async updateThingSpeakData() {
    try {
      // console.log('🔄 開始更新 ThingSpeak 數據...')

      // 獲取單相數據（使用原本的 API）
      const realTimeData = await thingSpeakService.getRealTimeData()
      // console.log('獲取到的單相 ThingSpeak 數據:', realTimeData)

      // 獲取三相數據（使用新的 API）
      const threePhaseData = await thingSpeakService.getThreePhaseData()
      // console.log('獲取到的三相 ThingSpeak 數據:', threePhaseData)

      if (realTimeData) {
        // 更新單相當日碳排放增量
        const currentCarbon = realTimeData.carbonEmission || 0
        if (this.singlePhaseTodayStartValue !== null) {
          this.singlePhaseCarbonIncrement = Math.max(0, currentCarbon - this.singlePhaseTodayStartValue)
        }

        // 創建包含當日增量的數據副本，統一格式化小數位數
        const singlePhaseDataWithIncrement = {
          voltage: parseFloat((realTimeData.voltage || 0).toFixed(2)),
          current: parseFloat((realTimeData.current || 0).toFixed(2)),
          power: parseFloat((realTimeData.power || 0).toFixed(2)),
          energy: parseFloat((realTimeData.energy || 0).toFixed(2)),
          frequency: parseFloat((realTimeData.frequency || 0).toFixed(2)),
          powerFactor: parseFloat((realTimeData.powerFactor || 0).toFixed(2)),
          carbonEmission: parseFloat(this.singlePhaseCarbonIncrement.toFixed(2)),
          timestamp: realTimeData.timestamp
        }

        const systemStatusDataWithIncrement = {
          voltage: parseFloat((realTimeData.voltage || 0).toFixed(2)),
          current: parseFloat((realTimeData.current || 0).toFixed(2)),
          power: parseFloat((realTimeData.power || 0).toFixed(2)),
          energy: parseFloat((realTimeData.energy || 0).toFixed(2)),
          frequency: parseFloat((realTimeData.frequency || 0).toFixed(2)),
          powerFactor: parseFloat((realTimeData.powerFactor || 0).toFixed(2)),
          carbonEmission: parseFloat(this.singlePhaseCarbonIncrement.toFixed(2)),
          timestamp: realTimeData.timestamp
        }

        // 單相和系統狀態使用原本的數據
        this.cacheData('singlePhase', singlePhaseDataWithIncrement)
        this.cacheData('systemStatus', systemStatusDataWithIncrement)

        // 減少控制台輸出
        // console.log('✅ 單相 ThingSpeak 數據已更新')
      } else {
        console.warn('⚠️ 未獲取到單相 ThingSpeak 數據')
      }

      if (threePhaseData) {
        // 更新三相當日碳排放增量
        const currentCarbon = threePhaseData.carbonEmission || 0
        if (this.threePhaseTodayStartValue !== null) {
          this.threePhaseCarbonIncrement = Math.max(0, currentCarbon - this.threePhaseTodayStartValue)
        }

        // 三相使用自己的碳排放增量，統一格式化小數位數
        const threePhaseDataWithIncrement = {
          voltage: parseFloat((threePhaseData.voltage || 0).toFixed(2)),
          current: parseFloat((threePhaseData.current || 0).toFixed(2)),
          power: parseFloat((threePhaseData.power || 0).toFixed(2)),
          energy: parseFloat((threePhaseData.energy || 0).toFixed(2)),
          frequency: parseFloat((threePhaseData.frequency || 0).toFixed(2)),
          powerFactor: parseFloat((threePhaseData.powerFactor || 0).toFixed(2)),
          carbonEmission: parseFloat(this.threePhaseCarbonIncrement.toFixed(2)),
          timestamp: threePhaseData.timestamp
        }

        // 三相使用新的 API 數據
        this.cacheData('threePhase', threePhaseDataWithIncrement)

        // console.log('✅ 三相 ThingSpeak 數據已更新:', {
        //   電壓: threePhaseData.voltage + 'V',
        //   電流: threePhaseData.current + 'A',
        //   功率: threePhaseData.power + 'W',
        //   頻率: threePhaseData.frequency + 'Hz',
        //   功率因子: threePhaseData.powerFactor + ' pf',
        //   用電量: threePhaseData.energy + 'kWh',
        //   今日碳排放增量: this.threePhaseCarbonIncrement.toFixed(4) + ' kgCO₂e'
        // })
      } else {
        // console.warn('⚠️ 未獲取到三相 ThingSpeak 數據')
      }

      // 獲取單相 220V 資料（獨立公開頻道，尚無當日增量基準，直接快取最新讀值）
      try {
        const single220Result = await dataService.getSingle220PhaseData()
        if (single220Result.status === 'success' && single220Result.data) {
          const d = single220Result.data
          this.cacheData('single220Phase', {
            voltage: parseFloat((d.voltage || 0).toFixed(2)),
            current: parseFloat((d.current || 0).toFixed(2)),
            power: parseFloat((d.power || 0).toFixed(2)),
            energy: parseFloat((d.energy || 0).toFixed(2)),
            frequency: parseFloat((d.frequency || 0).toFixed(2)),
            powerFactor: parseFloat((d.powerFactor || 0).toFixed(2)),
            carbonEmission: parseFloat((d.carbonEmission || 0).toFixed(2)),
            timestamp: d.timestamp
          })
        }
      } catch (error) {
        console.warn('⚠️ 單相220V ThingSpeak 數據獲取失敗:', error)
      }

    } catch (error) {
      // console.error('❌ 從 ThingSpeak 獲取資料失敗:', error)
      throw error
    }
  }

  // 從 ThingSpeak 獲取系統狀態
  async getSystemStatusFromThingSpeak() {
    try {
      const data = await thingSpeakService.getRealTimeData()
      if (!data) return null

      return {
        totalPower: data.power,
        voltage: data.voltage,
        current: data.current,
        frequency: data.frequency,
        totalEnergy: data.energy,
        powerFactor: data.powerFactor,
        carbonEmission: data.carbonEmission,
        timestamp: data.timestamp
      }
    } catch (error) {
      console.error('獲取系統狀態失敗:', error)
      return null
    }
  }

  // 已移除模擬資料，只使用 ThingSpeak 真實資料

  // 快取資料
  cacheData(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    })
  }

  // 獲取快取資料
  getCachedData(key) {
    const cached = this.cache.get(key)
    if (!cached) return null

    // 檢查快取是否過期
    if (Date.now() - cached.timestamp > this.cacheTTL) {
      this.cache.delete(key)
      return null
    }

    return cached.data
  }

  // 獲取單向資料
  getSinglePhaseData() {
    return this.getCachedData('singlePhase')
  }

  // 獲取三相資料
  getThreePhaseData() {
    return this.getCachedData('threePhase')
  }

  // 獲取單相 220V 資料
  getSingle220PhaseData() {
    return this.getCachedData('single220Phase')
  }

  // 獲取系統狀態
  getSystemStatus() {
    return this.getCachedData('systemStatus')
  }

  // 獲取歷史資料
  async getHistoricalData(type, chartType, results = 100, startDate = null, endDate = null) {
    if (this.isPowerApiEnabled) {
      try {
        const deviceId = type === 'single' ? DEVICE_ID.SINGLE : DEVICE_ID.THREE
        const result = await powerApiService.getHistoricalData(deviceId, startDate, endDate)
        if (result.status === 'success') return result.data[chartType] || []
      } catch (error) {
        console.error('獲取 Power API 歷史資料失敗:', error)
      }
    }

    if (this.isThingSpeakEnabled && this.connectionStatus === 'connected') {
      try {
        const fields = this.getFieldsForChartType(type, chartType)
        const data = await thingSpeakService.getHistoricalData(fields, results, startDate, endDate)
        return this.formatHistoricalDataForChart(data, chartType)
      } catch (error) {
        console.error('獲取 ThingSpeak 歷史資料失敗:', error)
      }
    }

    return this.generateMockHistoricalData(type, chartType, results)
  }

  // 根據圖表類型獲取欄位
  getFieldsForChartType(type, chartType) {
    const fieldMapping = {
      single: {
        voltage: [1],
        current: [2],
        power: [3],
        powerFactor: [4],
        energy: [5]
      },
      three: {
        voltage: [7, 10, 13], // Phase A, B, C 電壓
        current: [8, 11, 14], // Phase A, B, C 電流
        power: [9, 12, 15]    // Phase A, B, C 功率
      }
    }

    return fieldMapping[type]?.[chartType] || [1]
  }

  // 格式化歷史資料用於圖表顯示
  formatHistoricalDataForChart(data, chartType) {
    if (chartType === 'powerFactor') {
      return data.map(item => ({
        time: item.time,
        value: parseFloat(item.powerFactor || 0)
      }))
    }

    // 對於三相資料，需要特殊處理
    if (chartType === 'voltage' || chartType === 'current' || chartType === 'power') {
      // 這裡可以根據需要返回三相資料的平均值或分別顯示
      return data.map(item => ({
        time: item.time,
        value: parseFloat(item[chartType] || 0)
      }))
    }

    return data.map(item => ({
      time: item.time,
      value: parseFloat(item[chartType] || 0)
    }))
  }

  // 生成模擬歷史資料
  generateMockHistoricalData(type, chartType, results) {
    const now = new Date()
    const data = []

    for (let i = results - 1; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 60 * 60 * 1000)
      let value = 0

      // 根據圖表類型生成相應的模擬值
      switch (chartType) {
        case 'voltage':
          value = Math.floor(Math.random() * 20) + 220
          break
        case 'current':
          value = Math.floor(Math.random() * 5) + 10
          break
        case 'power':
          value = Math.floor(Math.random() * 500) + 2000
          break
        case 'powerFactor':
          value = (Math.random() * 0.2 + 0.8).toFixed(2)
          break
        default:
          value = Math.floor(Math.random() * 50) + 200
      }

      data.push({
        time: time.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
        value: value
      })
    }

    return data
  }

  // 獲取連接狀態
  getConnectionStatus() {
    return {
      powerApi: this.isPowerApiEnabled ? 'connected' : 'disconnected',
      thingSpeak: this.connectionStatus,
      mockData: this.isMockDataEnabled,
      lastUpdate: this.lastUpdate
    }
  }

  // 手動刷新資料
  async refreshData() {
    await this.updateAllData()
  }

  // 清理資源
  destroy() {
    this.stopDataUpdate()
    this.cache.clear()
  }
}

// 創建單例實例
const dataManager = new DataManager()

export default dataManager
