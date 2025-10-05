// 資料管理服務
class DataService {
  constructor() {
    this.singlePhaseConfig = {
      apiKey: import.meta.env.VITE_THINGSPEAK_API_KEY_SINGLE,
      channelId: import.meta.env.VITE_THINGSPEAK_CHANNEL_ID_SINGLE
    }

    this.threePhaseConfig = {
      apiKey: import.meta.env.VITE_THINGSPEAK_API_KEY_THREE,
      channelId: import.meta.env.VITE_THINGSPEAK_CHANNEL_ID_THREE
    }
  }

  // 檢查配置是否完整
  isConfigValid(config) {
    return config.apiKey && config.channelId
  }

  // 獲取單相資料
  async getSinglePhaseData() {
    if (!this.isConfigValid(this.singlePhaseConfig)) {
      return {
        status: 'not_configured',
        message: '未設定單相 API',
        data: null
      }
    }

    try {
      const url = `https://api.thingspeak.com/channels/${this.singlePhaseConfig.channelId}/feeds.json?api_key=${this.singlePhaseConfig.apiKey}&results=10`
      const response = await fetch(url)
      const result = await response.json()

      if (!result.feeds || result.feeds.length === 0) {
        return {
          status: 'no_data',
          message: '暫無資料',
          data: null
        }
      }

      // 獲取最新資料
      const latestFeed = result.feeds[result.feeds.length - 1]
      const data = {
        voltage: Number(latestFeed.field1) || 0,
        current: Number(latestFeed.field2) || 0,
        power: Number(latestFeed.field3) || 0,
        energy: Number(latestFeed.field4) || 0,
        frequency: Number(latestFeed.field5) || 0,
        powerFactor: Number(latestFeed.field6) || 0,
        carbonEmission: Number(latestFeed.field7) || 0,
        timestamp: latestFeed.created_at
      }

      return {
        status: 'success',
        message: '資料獲取成功',
        data: data,
        chartData: result.feeds.map(feed => ({
          time: new Date(feed.created_at).toLocaleTimeString(),
          voltage: Number(feed.field1) || 0,
          current: Number(feed.field2) || 0,
          power: Number(feed.field3) || 0,
          energy: Number(feed.field4) || 0,
          frequency: Number(feed.field5) || 0,
          powerFactor: Number(feed.field6) || 0,
          carbonEmission: Number(feed.field7) || 0
        }))
      }
    } catch (error) {
      console.error('單相資料獲取失敗:', error)
      return {
        status: 'error',
        message: '資料獲取失敗',
        data: null
      }
    }
  }

  // 獲取三相資料
  async getThreePhaseData() {
    if (!this.isConfigValid(this.threePhaseConfig)) {
      return {
        status: 'not_configured',
        message: '未設定三相 API',
        data: null
      }
    }

    try {
      const url = `https://api.thingspeak.com/channels/${this.threePhaseConfig.channelId}/feeds.json?api_key=${this.threePhaseConfig.apiKey}&results=10`
      const response = await fetch(url)
      const result = await response.json()

      if (!result.feeds || result.feeds.length === 0) {
        return {
          status: 'no_data',
          message: '暫無資料',
          data: null
        }
      }

      // 獲取最新資料
      const latestFeed = result.feeds[result.feeds.length - 1]
      const data = {
        voltage: Number(latestFeed.field1) || 0,
        current: Number(latestFeed.field2) || 0,
        power: Number(latestFeed.field3) || 0,
        energy: Number(latestFeed.field4) || 0,
        frequency: Number(latestFeed.field5) || 0,
        powerFactor: Number(latestFeed.field6) || 0,
        carbonEmission: Number(latestFeed.field7) || 0,
        timestamp: latestFeed.created_at
      }

      return {
        status: 'success',
        message: '資料獲取成功',
        data: data,
        chartData: result.feeds.map(feed => ({
          time: new Date(feed.created_at).toLocaleTimeString(),
          voltage: Number(feed.field1) || 0,
          current: Number(feed.field2) || 0,
          power: Number(feed.field3) || 0,
          energy: Number(feed.field4) || 0,
          frequency: Number(feed.field5) || 0,
          powerFactor: Number(feed.field6) || 0,
          carbonEmission: Number(feed.field7) || 0
        }))
      }
    } catch (error) {
      console.error('三相資料獲取失敗:', error)
      return {
        status: 'error',
        message: '資料獲取失敗',
        data: null
      }
    }
  }
}

export default new DataService()
