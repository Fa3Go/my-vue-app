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

  // 獲取歷史資料
  async getHistoricalData(type, results = 100, startDate = null, endDate = null) {
    const config = type === 'single' ? this.singlePhaseConfig : this.threePhaseConfig

    if (!this.isConfigValid(config)) {
      return {
        status: 'not_configured',
        message: `未設定${type === 'single' ? '單相' : '三相'} API`,
        data: null
      }
    }

    try {
      // 計算日期範圍（天數）
      let daysDiff = 0
      let url

      if (startDate && endDate) {
        const start = new Date(startDate)
        const end = new Date(endDate)
        daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24))

        console.log('🔍 收到的日期參數:', {
          startDate原始: startDate,
          endDate原始: endDate,
          start轉換後: start.toISOString(),
          end轉換後: end.toISOString(),
          天數差: daysDiff
        })

        // 根據天數決定查詢方式
        if (daysDiff <= 1) {
          // 單日:查詢所有詳細數據
          url = `https://api.thingspeak.com/channels/${config.channelId}/feeds.json?api_key=${config.apiKey}&start=${start.toISOString()}&end=${end.toISOString()}`
          console.log(`📅 單日查詢: ${start.toLocaleDateString()}`)
        } else {
          // 多日:使用 average=daily 獲取每日匯總
          url = `https://api.thingspeak.com/channels/${config.channelId}/feeds.json?api_key=${config.apiKey}&start=${start.toISOString()}&end=${end.toISOString()}&average=daily`
          console.log(`📅 多日查詢: ${start.toLocaleDateString()} ~ ${end.toLocaleDateString()} (${daysDiff} 天,使用每日平均)`)
          console.log(`🌐 API URL: ${url.replace(config.apiKey, '***')}`)
        }
      } else {
        // 沒有指定日期,預設獲取最近 7 天的數據
        const end = new Date()
        end.setHours(23, 59, 59, 999) // 今天結束

        const start = new Date()
        start.setDate(start.getDate() - 6) // 往前推6天,加上今天共7天
        start.setHours(12, 0, 0, 0) // 從中午開始,避免包含前一天

        url = `https://api.thingspeak.com/channels/${config.channelId}/feeds.json?api_key=${config.apiKey}&start=${start.toISOString()}&end=${end.toISOString()}&average=daily`
        daysDiff = 7
        console.log(`📅 預設查詢最近 7 天數據 (使用每日平均)`)
        console.log(`   開始: ${start.toLocaleDateString('zh-TW')} ${start.toLocaleTimeString('zh-TW')}`)
        console.log(`   結束: ${end.toLocaleDateString('zh-TW')} ${end.toLocaleTimeString('zh-TW')}`)
      }

      const response = await fetch(url)
      const result = await response.json()

      if (!result.feeds || result.feeds.length === 0) {
        return {
          status: 'no_data',
          message: '暫無歷史資料',
          data: null
        }
      }

      // 判斷是單日還是多日
      const isSingleDay = daysDiff <= 1 || !startDate || !endDate

      // 如果使用了 average=daily,ThingSpeak 已經幫我們計算好每日數據了
      // 不需要再手動分組
      let processedFeeds = result.feeds

      // 格式化歷史資料
      const historyData = {
        voltage: [],
        current: [],
        power: [],
        energy: [],
        frequency: [],
        powerFactor: [],
        carbonEmission: []
      }

      processedFeeds.forEach(feed => {
        const date = new Date(feed.created_at)
        let time

        if (isSingleDay) {
          // 單日模式: 顯示時:分
          time = date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
        } else {
          // 多日模式: 顯示月/日
          // 從 created_at 字串直接提取日期 (YYYY-MM-DD)
          const dateStr = feed.created_at.split('T')[0] // "2025-10-05"
          const [year, month, day] = dateStr.split('-')
          time = `${month}/${day}`

        }

        historyData.voltage.push({
          time,
          value: Number(feed.field1) || 0
        })
        historyData.current.push({
          time,
          value: Number(feed.field2) || 0
        })
        historyData.power.push({
          time,
          value: Number(feed.field3) || 0
        })
        historyData.energy.push({
          time,
          value: Number(feed.field4) || 0
        })
        historyData.frequency.push({
          time,
          value: Number(feed.field5) || 0
        })
        historyData.powerFactor.push({
          time,
          value: Number(feed.field6) || 0
        })
        historyData.carbonEmission.push({
          time,
          value: Number(feed.field7) || 0
        })
      })

      return {
        status: 'success',
        message: '歷史資料獲取成功',
        data: historyData,
        mode: isSingleDay ? 'hourly' : 'daily'
      }
    } catch (error) {
      console.error('歷史資料獲取失敗:', error)
      return {
        status: 'error',
        message: '歷史資料獲取失敗',
        data: null
      }
    }
  }

  // 按天分組並取每天的最高值
  groupByDayAndGetMax(feeds) {
    console.log('📊 開始分組處理,共', feeds.length, '筆資料')
    const dayMap = new Map()

    feeds.forEach(feed => {
      const date = new Date(feed.created_at)
      const dayKey = date.toISOString().split('T')[0] // YYYY-MM-DD

      if (!dayMap.has(dayKey)) {
        dayMap.set(dayKey, [])
      }
      dayMap.get(dayKey).push(feed)
    })

    console.log('📅 分組結果: 共', dayMap.size, '天')

    const dailyMaxFeeds = []

    dayMap.forEach((dayFeeds, dayKey) => {
      // 找出當天每個欄位的最大值
      const maxFeed = {
        created_at: dayKey + 'T12:00:00Z', // 設定為當天中午
        field1: Math.max(...dayFeeds.map(f => Number(f.field1) || 0)), // 電壓最高
        field2: Math.max(...dayFeeds.map(f => Number(f.field2) || 0)), // 電流最高
        field3: Math.max(...dayFeeds.map(f => Number(f.field3) || 0)), // 功率最高
        field4: Math.max(...dayFeeds.map(f => Number(f.field4) || 0)), // 用電量最高
        field5: Math.max(...dayFeeds.map(f => Number(f.field5) || 0)), // 頻率最高
        field6: Math.max(...dayFeeds.map(f => Number(f.field6) || 0)), // 功率因子最高
        field7: Math.max(...dayFeeds.map(f => Number(f.field7) || 0))  // 碳排放最高
      }

      console.log(`  ${dayKey}: ${dayFeeds.length}筆資料 -> 最高電壓 ${maxFeed.field1}V, 最高電流 ${maxFeed.field2}A`)
      dailyMaxFeeds.push(maxFeed)
    })

    // 按日期排序
    const sorted = dailyMaxFeeds.sort((a, b) =>
      new Date(a.created_at) - new Date(b.created_at)
    )

    console.log('✅ 多日模式處理完成,輸出', sorted.length, '天的最高數據')
    return sorted
  }
}

export default new DataService()
