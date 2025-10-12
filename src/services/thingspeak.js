// ThingSpeak API 服務模組
class ThingSpeakService {
  constructor() {
    // ThingSpeak API 基礎 URL
    this.baseUrl = 'https://api.thingspeak.com'

    // 從環境變數獲取 API 金鑰（生產環境中應該從環境變數獲取）
    this.apiKey = import.meta.env.VITE_THINGSPEAK_API_KEY || ''
    this.channelId = import.meta.env.VITE_THINGSPEAK_CHANNEL_ID || ''

    // 調試資訊
    console.log('ThingSpeak 服務初始化:')
    console.log('- API Key:', this.apiKey ? '已設定' : '未設定')
    console.log('- Channel ID:', this.channelId || '未設定')
    console.log('- Base URL:', this.baseUrl)
  }

  // 獲取即時資料（單相）
  async getRealTimeData() {
    try {
      // 使用單相專用的 API 金鑰和 Channel ID
      const url = `https://api.thingspeak.com/channels/${import.meta.env.VITE_THINGSPEAK_CHANNEL_ID_SINGLE}/feeds.json?api_key=${import.meta.env.VITE_THINGSPEAK_API_KEY_SINGLE}&results=10`

      console.log('單相 ThingSpeak API 請求 URL:', url.replace(import.meta.env.VITE_THINGSPEAK_API_KEY_SINGLE, '***'))

      const response = await fetch(url)
      console.log('單相 API 回應狀態:', response.status, response.statusText)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log('單相 API 原始回應:', data)

      const parsedData = this.parseRealTimeData(data)
      console.log('單相解析後的資料:', parsedData)

      return parsedData
    } catch (error) {
      console.error('❌ 獲取單相 ThingSpeak 即時資料失敗:', error)
      throw error
    }
  }

  // 獲取歷史資料
  async getHistoricalData(fields = null, results = 100, startDate = null, endDate = null) {
    try {
      // 支援多種參數：
      // - results: 指定回傳幾筆資料 (預設 100)
      // - start/end: 指定時間區間 (ISO 格式)
      // - fields: 指定要取得的欄位
      let url = `${this.baseUrl}/channels/${this.channelId}/feeds.json?api_key=${this.apiKey}&results=${results}`

      if (fields && Array.isArray(fields)) {
        // 例如: fields=[1,2,3] -> &field1&field2&field3
        fields.forEach(field => {
          url += `&field${field}`
        })
      }

      if (startDate) {
        url += `&start=${startDate.toISOString()}`
      }

      if (endDate) {
        url += `&end=${endDate.toISOString()}`
      }

      console.log('📊 獲取歷史資料 API 請求:', url)

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log(`✅ 成功獲取 ${data.feeds?.length || 0} 筆歷史資料`)

      return this.parseHistoricalData(data)
    } catch (error) {
      console.error('❌ 獲取 ThingSpeak 歷史資料失敗:', error)
      throw error
    }
  }

  // 獲取通道資訊
  async getChannelInfo() {
    try {
      const url = `${this.baseUrl}/channels/${this.channelId}.json?api_key=${this.apiKey}`

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      // 檢查返回的資料結構
      if (!data || !data.channel) {
        console.warn('⚠️ Channel info 資料結構異常:', data)
        return {
          name: 'Unknown Channel',
          updated_at: new Date().toISOString(),
          field_count: 7
        }
      }

      return data.channel
    } catch (error) {
      console.error('❌ 獲取 ThingSpeak 通道資訊失敗:', error)
      throw error
    }
  }

  // 解析即時資料
  parseRealTimeData(data) {
    if (!data.feeds || data.feeds.length === 0) {
      return null
    }

    const feed = data.feeds[0]
    const channel = data.channel || {}

    // ThingSpeak 通道欄位映射（根據 channel 定義）：
    // field1: 電壓 (V)
    // field2: 電流 (A)
    // field3: 功率 (W)
    // field4: 用電量 (kWh)
    // field5: 頻率 (Hz)
    // field6: 功率因子 (pf)
    // field7: 碳排當量 (kgCO₂e)
    return {
      timestamp: new Date(feed.created_at),
      voltage: parseFloat(feed.field1) || 0,      // 電壓 (V)
      current: parseFloat(feed.field2) || 0,      // 電流 (A)
      power: parseFloat(feed.field3) || 0,        // 功率 (W)
      energy: parseFloat(feed.field4) || 0,       // 用電量 (kWh)
      frequency: parseFloat(feed.field5) || 50,   // 頻率 (Hz)
      powerFactor: parseFloat(feed.field6) || 0,  // 功率因子 (pf)
      carbonEmission: parseFloat(feed.field7) || 0, // 碳排當量 (kgCO₂e)
      // 保存原始資料用於調試
      rawData: feed,
      channelInfo: channel
    }
  }

  // 解析歷史資料
  parseHistoricalData(data) {
    if (!data.feeds || data.feeds.length === 0) {
      return []
    }

    return data.feeds.map(feed => ({
      timestamp: new Date(feed.created_at),
      time: new Date(feed.created_at).toLocaleTimeString('zh-TW', {
        hour: '2-digit',
        minute: '2-digit'
      }),
      voltage: parseFloat(feed.field1) || 0,         // 電壓 (V)
      current: parseFloat(feed.field2) || 0,         // 電流 (A)
      power: parseFloat(feed.field3) || 0,           // 功率 (W)
      energy: parseFloat(feed.field4) || 0,          // 用電量 (kWh)
      frequency: parseFloat(feed.field5) || 50,      // 頻率 (Hz)
      powerFactor: parseFloat(feed.field6) || 0,     // 功率因子 (pf)
      carbonEmission: parseFloat(feed.field7) || 0,  // 碳排當量 (kgCO₂e)
      rawData: feed
    }))
  }

  // 獲取三相資料（從大葉大學機械系 H707 教室電能監測系統）
  async getThreePhaseData() {
    try {
      // 使用三相專用的 API 金鑰和 Channel ID (教室 H707)
      const url = `https://api.thingspeak.com/channels/${import.meta.env.VITE_THINGSPEAK_CHANNEL_ID_THREE}/feeds.json?api_key=${import.meta.env.VITE_THINGSPEAK_API_KEY_THREE}&results=1`

      console.log('📊 獲取三相資料 API 請求 URL:', url.replace(import.meta.env.VITE_THINGSPEAK_API_KEY_THREE, '***'))

      const response = await fetch(url)
      console.log('📡 三相資料 API 回應狀態:', response.status, response.statusText)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log('📦 三相資料 API 原始回應:', data)

      // 顯示 channel 資訊
      if (data.channel) {
        console.log('📌 Channel 資訊:', {
          名稱: data.channel.name,
          描述: data.channel.description,
          最後更新: data.channel.updated_at
        })
      }

      if (!data.feeds || data.feeds.length === 0) {
        console.warn('⚠️ 三相資料為空，feeds 陣列不存在或長度為 0')
        return null
      }

      // 使用最新的資料（feeds 陣列的最後一筆是最新的）
      const feed = data.feeds[data.feeds.length - 1]
      console.log('🎯 使用的 feed 資料:', {
        時間: feed.created_at,
        電壓: feed.field1,
        電流: feed.field2,
        功率: feed.field3,
        能量: feed.field4,
        頻率: feed.field5,
        功率因子: feed.field6,
        碳排放: feed.field7
      })

      // 解析三相資料（欄位映射與單相相同）
      const parsedData = {
        voltage: parseFloat(feed.field1) || 0,         // 電壓 (V)
        current: parseFloat(feed.field2) || 0,         // 電流 (A)
        power: parseFloat(feed.field3) || 0,           // 功率 (W)
        energy: parseFloat(feed.field4) || 0,          // 用電量 (kWh)
        frequency: parseFloat(feed.field5) || 50,      // 頻率 (Hz)
        powerFactor: parseFloat(feed.field6) || 0,     // 功率因子 (pf)
        carbonEmission: parseFloat(feed.field7) || 0,  // 碳排當量 (kgCO₂e)
        timestamp: new Date(feed.created_at)
      }

      console.log('✅ 解析後的三相資料:', parsedData)

      return parsedData
    } catch (error) {
      console.error('❌ 獲取三相資料失敗:', error)
      return null
    }
  }

  // 檢查服務狀態
  async checkServiceStatus() {
    try {
      // 直接嘗試獲取資料來檢查服務狀態，而不是獲取 channel info
      const testData = await this.getRealTimeData()
      if (testData && testData.voltage !== undefined) {
        return {
          status: 'connected',
          channelName: 'ThingSpeak Channel',
          lastUpdate: testData.timestamp,
          fieldCount: 7
        }
      } else {
        throw new Error('無法獲取有效資料')
      }
    } catch (error) {
      console.error('檢查服務狀態失敗:', error)
      return {
        status: 'disconnected',
        error: error.message
      }
    }
  }
}

// 創建單例實例
const thingSpeakService = new ThingSpeakService()

export default thingSpeakService
