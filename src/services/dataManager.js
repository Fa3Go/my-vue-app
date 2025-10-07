// 資料管理服務
import thingSpeakService from './thingspeak.js'
import { getConfig, validateConfig } from '../config/thingspeak.config.js'

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

    // 當日碳排放增量快取
    this.todayCarbonIncrement = 0
    this.lastCarbonValue = null
    this.todayStartCarbonValue = null

    // 初始化
    this.init()
  }

  async init() {
    // 檢查 ThingSpeak 配置
    if (this.isThingSpeakEnabled) {
      const isValid = validateConfig()
      if (isValid) {
        await this.checkThingSpeakConnection()
        // 初始化當日碳排放基準值
        await this.initTodayCarbonBaseline()
      } else {
        console.warn('ThingSpeak 配置無效，將使用模擬資料')
        this.isThingSpeakEnabled = false
      }
    }

    // 啟動資料更新
    this.startDataUpdate()
  }

  // 初始化當日碳排放基準值（獲取今天00:00的碳排放值）
  async initTodayCarbonBaseline() {
    try {
      // 獲取今天和昨天的每日平均碳排放
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)

      const startISO = yesterday.toISOString()
      const endISO = now.toISOString()

      const url = `https://api.thingspeak.com/channels/2521976/feeds.json?start=${startISO}&end=${endISO}&average=1440`

      const response = await fetch(url)
      const data = await response.json()

      if (data.feeds && data.feeds.length >= 2) {
        // 獲取昨天的碳排放值作為今天的基準
        this.todayStartCarbonValue = parseFloat(data.feeds[data.feeds.length - 2].field7) || 0
        this.lastCarbonValue = parseFloat(data.feeds[data.feeds.length - 1].field7) || 0
        this.todayCarbonIncrement = Math.max(0, this.lastCarbonValue - this.todayStartCarbonValue)

        console.log('✅ 初始化當日碳排放基準:', {
          昨天碳排放: this.todayStartCarbonValue.toFixed(2) + ' kgCO₂e',
          當前碳排放: this.lastCarbonValue.toFixed(2) + ' kgCO₂e',
          今日增量: this.todayCarbonIncrement.toFixed(4) + ' kgCO₂e'
        })
      }
    } catch (error) {
      console.error('❌ 初始化當日碳排放基準失敗:', error)
    }
  }

  // 檢查 ThingSpeak 連接狀態
  async checkThingSpeakConnection() {
    try {
      console.log('開始檢查 ThingSpeak 連接狀態...')
      const status = await thingSpeakService.checkServiceStatus()
      console.log('連接狀態檢查結果:', status)

      this.connectionStatus = status.status

      if (status.status === 'connected') {
        console.log('✅ ThingSpeak 連接成功:', status.channelName)
      } else {
        console.warn('❌ ThingSpeak 連接失敗:', status.error)
        this.isThingSpeakEnabled = false
      }
    } catch (error) {
      console.error('❌ 檢查 ThingSpeak 連接失敗:', error)
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
      console.log('🔄 開始更新資料...')

      // 只使用 ThingSpeak 真實資料，不使用 mock data
      if (this.isThingSpeakEnabled) {
        await this.updateThingSpeakData()
        this.lastUpdate = new Date()
        console.log('✅ 資料更新成功')
      } else {
        console.warn('⚠️ ThingSpeak 未啟用，無法獲取資料')
      }
    } catch (error) {
      console.error('❌ 更新資料失敗:', error)
      // 不使用 mock data，保持資料為空或上次的值
    }
  }

  // 單相資料也使用 ThingSpeak 真實資料（不再使用模擬資料）
  updateSinglePhaseMockData() {
    // 移除模擬資料，單相也使用真實資料
    console.log('單相資料將使用 ThingSpeak 真實資料')
  }

  // 更新 ThingSpeak 資料
  async updateThingSpeakData() {
    try {
      console.log('🔄 開始更新 ThingSpeak 數據...')

      // 獲取單相數據（使用原本的 API）
      const realTimeData = await thingSpeakService.getRealTimeData()
      console.log('獲取到的單相 ThingSpeak 數據:', realTimeData)

      // 獲取三相數據（使用新的 API）
      const threePhaseData = await thingSpeakService.getThreePhaseData()
      console.log('獲取到的三相 ThingSpeak 數據:', threePhaseData)

      if (realTimeData) {
        // 更新當日碳排放增量
        const currentCarbon = realTimeData.carbonEmission || 0
        if (this.todayStartCarbonValue !== null) {
          this.todayCarbonIncrement = Math.max(0, currentCarbon - this.todayStartCarbonValue)
        }

        // 創建包含當日增量的數據副本（保留2位小數）
        const singlePhaseDataWithIncrement = {
          ...realTimeData,
          carbonEmission: parseFloat(this.todayCarbonIncrement.toFixed(2))  // 使用當日增量替換累積值，保留2位小數
        }

        const systemStatusDataWithIncrement = {
          ...realTimeData,
          carbonEmission: parseFloat(this.todayCarbonIncrement.toFixed(2))  // 使用當日增量替換累積值，保留2位小數
        }

        // 單相和系統狀態使用原本的數據
        this.cacheData('singlePhase', singlePhaseDataWithIncrement)
        this.cacheData('systemStatus', systemStatusDataWithIncrement)

        console.log('✅ 單相 ThingSpeak 數據已更新:', {
          電壓: realTimeData.voltage + 'V',
          電流: realTimeData.current + 'A',
          功率: realTimeData.power + 'W',
          頻率: realTimeData.frequency + 'Hz',
          功率因子: realTimeData.powerFactor + ' pf',
          用電量: realTimeData.energy + 'kWh',
          碳排放累積: currentCarbon.toFixed(2) + ' kgCO₂e',
          今日碳排放增量: this.todayCarbonIncrement.toFixed(4) + ' kgCO₂e'
        })
      } else {
        console.warn('⚠️ 未獲取到單相 ThingSpeak 數據')
      }

      if (threePhaseData) {
        // 三相也使用當日碳排放增量（保留2位小數）
        const threePhaseDataWithIncrement = {
          ...threePhaseData,
          carbonEmission: parseFloat(this.todayCarbonIncrement.toFixed(2))  // 使用當日增量替換累積值，保留2位小數
        }

        // 三相使用新的 API 數據
        this.cacheData('threePhase', threePhaseDataWithIncrement)

        console.log('✅ 三相 ThingSpeak 數據已更新:', {
          電壓: threePhaseData.voltage + 'V',
          電流: threePhaseData.current + 'A',
          功率: threePhaseData.power + 'W',
          頻率: threePhaseData.frequency + 'Hz',
          功率因子: threePhaseData.powerFactor + ' pf',
          用電量: threePhaseData.energy + 'kWh',
          今日碳排放增量: this.todayCarbonIncrement.toFixed(4) + ' kgCO₂e'
        })
      } else {
        console.warn('⚠️ 未獲取到三相 ThingSpeak 數據')
      }

    } catch (error) {
      console.error('❌ 從 ThingSpeak 獲取資料失敗:', error)
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

  // 獲取系統狀態
  getSystemStatus() {
    return this.getCachedData('systemStatus')
  }

  // 獲取歷史資料
  async getHistoricalData(type, chartType, results = 100, startDate = null, endDate = null) {
    if (this.isThingSpeakEnabled && this.connectionStatus === 'connected') {
      try {
        // 根據類型和圖表類型確定要獲取的欄位
        const fields = this.getFieldsForChartType(type, chartType)
        const data = await thingSpeakService.getHistoricalData(fields, results, startDate, endDate)
        return this.formatHistoricalDataForChart(data, chartType)
      } catch (error) {
        console.error('獲取 ThingSpeak 歷史資料失敗:', error)
        // 回退到模擬資料
        return this.generateMockHistoricalData(type, chartType, results)
      }
    } else {
      // 使用模擬資料
      return this.generateMockHistoricalData(type, chartType, results)
    }
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
        voltage: [7, 10, 13], // Phase A, B, C 电压
        current: [8, 11, 14], // Phase A, B, C 电流
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
