// 歷史資料服務：由 Power API Server 提供
import powerApiService, { deviceIdByType } from './powerApiService.js'

class DataService {
  // type: 'single' | 'single220' | 'three'
  async getHistoricalData(type, _results = 100, startDate = null, endDate = null) {
    const deviceId = deviceIdByType(type)
    if (!deviceId) {
      return { status: 'error', message: `未知的迴路類型：${type}`, data: null }
    }
    try {
      return await powerApiService.getHistoricalData(deviceId, startDate, endDate)
    } catch (error) {
      console.error('歷史資料獲取失敗:', error)
      return { status: 'error', message: '無法連接 Power API Server', data: null }
    }
  }
}

export default new DataService()
