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
          // 為了計算第一天的增量，往前多取5天數據（以防前幾天沒有有效數據）
          const adjustedStart = new Date(start)
          adjustedStart.setDate(adjustedStart.getDate() - 5)

          url = `https://api.thingspeak.com/channels/${config.channelId}/feeds.json?api_key=${config.apiKey}&start=${adjustedStart.toISOString()}&end=${end.toISOString()}&average=daily`
          console.log(`📅 多日查詢: ${start.toLocaleDateString()} ~ ${end.toLocaleDateString()} (${daysDiff} 天,使用每日平均)`)
          console.log(`📅 實際查詢從: ${adjustedStart.toLocaleDateString()} (往前5天作為基準)`)
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
      const isSingleDay = daysDiff <= 1 && startDate && endDate

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

      // 單日模式：按小時分組顯示 24 小時數據
      if (isSingleDay) {
        console.log('📊 單日模式：處理小時數據')

        // 取得當日 00:00 的碳排放基準值（第一筆數據）
        const todayStartCarbonValue = result.feeds.length > 0 ? (Number(result.feeds[0].field7) || 0) : 0
        console.log(`📊 今日碳排放基準值: ${todayStartCarbonValue}`)

        // 按小時分組
        const hourlyData = new Map()

        result.feeds.forEach(feed => {
          const timestamp = new Date(feed.created_at)
          const hour = timestamp.getHours()

          if (!hourlyData.has(hour)) {
            hourlyData.set(hour, [])
          }

          hourlyData.get(hour).push({
            voltage: Number(feed.field1) || 0,
            current: Number(feed.field2) || 0,
            power: Number(feed.field3) || 0,
            energy: Number(feed.field4) || 0,
            frequency: Number(feed.field5) || 0,
            powerFactor: Number(feed.field6) || 0,
            carbonEmission: Number(feed.field7) || 0
          })
        })

        // 生成完整的 24 小時數據
        for (let hour = 0; hour < 24; hour++) {
          const hourKey = `${String(hour).padStart(2, '0')}:00`

          if (hourlyData.has(hour)) {
            // 該小時有數據，取平均值
            const feeds = hourlyData.get(hour)
            const avg = {
              voltage: feeds.reduce((sum, f) => sum + f.voltage, 0) / feeds.length,
              current: feeds.reduce((sum, f) => sum + f.current, 0) / feeds.length,
              power: feeds.reduce((sum, f) => sum + f.power, 0) / feeds.length,
              energy: feeds.reduce((sum, f) => sum + f.energy, 0) / feeds.length,
              frequency: feeds.reduce((sum, f) => sum + f.frequency, 0) / feeds.length,
              powerFactor: feeds.reduce((sum, f) => sum + f.powerFactor, 0) / feeds.length,
              carbonEmission: feeds.reduce((sum, f) => sum + f.carbonEmission, 0) / feeds.length
            }

            // 碳排放：計算該小時累積值相對於今日 00:00 的增量
            const carbonIncrement = Math.max(0, avg.carbonEmission - todayStartCarbonValue)

            historyData.voltage.push({ time: hourKey, value: avg.voltage })
            historyData.current.push({ time: hourKey, value: avg.current })
            historyData.power.push({ time: hourKey, value: avg.power })
            historyData.energy.push({ time: hourKey, value: avg.energy })
            historyData.frequency.push({ time: hourKey, value: avg.frequency })
            historyData.powerFactor.push({ time: hourKey, value: avg.powerFactor })
            historyData.carbonEmission.push({ time: hourKey, value: carbonIncrement })
          } else {
            // 該小時沒有數據，填充 0
            historyData.voltage.push({ time: hourKey, value: 0 })
            historyData.current.push({ time: hourKey, value: 0 })
            historyData.power.push({ time: hourKey, value: 0 })
            historyData.energy.push({ time: hourKey, value: 0 })
            historyData.frequency.push({ time: hourKey, value: 0 })
            historyData.powerFactor.push({ time: hourKey, value: 0 })
            historyData.carbonEmission.push({ time: hourKey, value: 0 })
          }
        }

        console.log(`✅ 單日模式完成，生成 ${historyData.voltage.length} 小時數據`)

        return {
          status: 'success',
          message: '歷史資料獲取成功',
          data: historyData,
          mode: 'hourly'
        }
      }

      // 多日模式：按日期處理
      // 儲存碳排放累積值用於計算增量
      let previousCarbonValue = null

      // 如果有指定日期範圍，記錄開始日期用於過濾（只取日期部分，不考慮時區）
      let userStartDate = null
      let userEndDate = null
      if (startDate && endDate) {
        const ds = new Date(startDate)
        const de = new Date(endDate)
        // 格式化為 YYYY-MM-DD，使用本地日期
        userStartDate = `${ds.getFullYear()}-${String(ds.getMonth() + 1).padStart(2, '0')}-${String(ds.getDate()).padStart(2, '0')}`
        userEndDate = `${de.getFullYear()}-${String(de.getMonth() + 1).padStart(2, '0')}-${String(de.getDate()).padStart(2, '0')}`
      }

      // 第一步：收集所有數據並計算碳排放增量
      const feedDataMap = new Map() // 存儲每個日期的完整數據

      result.feeds.forEach((feed) => {
        const feedDate = feed.created_at.split('T')[0] // YYYY-MM-DD
        const [, month, day] = feedDate.split('-')
        const time = `${month}/${day}`

        // 獲取當前碳排放值
        const currentCarbonValue = Number(feed.field7)
        const hasValidCarbon = currentCarbonValue && !isNaN(currentCarbonValue)

        let carbonIncrement = 0
        let hasIncrement = false

        if (hasValidCarbon && previousCarbonValue !== null) {
          carbonIncrement = Math.max(0, currentCarbonValue - previousCarbonValue)
          hasIncrement = true
        }

        // 存儲該日期的所有數據（在更新 previousCarbonValue 之前）
        feedDataMap.set(feedDate, {
          time,
          voltage: Number(feed.field1) || 0,
          current: Number(feed.field2) || 0,
          power: Number(feed.field3) || 0,
          energy: Number(feed.field4) || 0,
          frequency: Number(feed.field5) || 0,
          powerFactor: Number(feed.field6) || 0,
          carbonIncrement: hasIncrement ? carbonIncrement : 0,
          hasValidCarbon
        })

        // 更新前一個值（只有在有效時）
        if (hasValidCarbon) {
          previousCarbonValue = currentCarbonValue
        }
      })

      // 第二步：如果有指定日期範圍，填補缺失的日期
      if (userStartDate && userEndDate && !isSingleDay) {
        const start = new Date(userStartDate)
        const end = new Date(userEndDate)

        // 遍歷日期範圍內的每一天
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0]
          const [, month, day] = dateStr.split('-')
          const time = `${month}/${day}`

          if (feedDataMap.has(dateStr)) {
            // 有API返回數據的日期
            const data = feedDataMap.get(dateStr)
            historyData.voltage.push({ time, value: data.voltage })
            historyData.current.push({ time, value: data.current })
            historyData.power.push({ time, value: data.power })
            historyData.energy.push({ time, value: data.energy })
            historyData.frequency.push({ time, value: data.frequency })
            historyData.powerFactor.push({ time, value: data.powerFactor })
            historyData.carbonEmission.push({ time, value: data.carbonIncrement })
          } else {
            // API沒有返回的日期，填充 0
            historyData.voltage.push({ time, value: 0 })
            historyData.current.push({ time, value: 0 })
            historyData.power.push({ time, value: 0 })
            historyData.energy.push({ time, value: 0 })
            historyData.frequency.push({ time, value: 0 })
            historyData.powerFactor.push({ time, value: 0 })
            historyData.carbonEmission.push({ time, value: 0 })
          }
        }
      } else {
        // 沒有指定日期範圍，使用原有邏輯（只顯示有數據的日期）
        feedDataMap.forEach((data) => {
          if (data.hasValidCarbon || data.carbonIncrement > 0) {
            historyData.voltage.push({ time: data.time, value: data.voltage })
            historyData.current.push({ time: data.time, value: data.current })
            historyData.power.push({ time: data.time, value: data.power })
            historyData.energy.push({ time: data.time, value: data.energy })
            historyData.frequency.push({ time: data.time, value: data.frequency })
            historyData.powerFactor.push({ time: data.time, value: data.powerFactor })
            historyData.carbonEmission.push({ time: data.time, value: data.carbonIncrement })
          }
        })
      }

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
