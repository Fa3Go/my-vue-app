<template>
  <div class="carbon-emission-chart">
    <el-card>
      <template #header>
        <div class="chart-header">
          <div class="header-left">
            <el-icon class="header-icon"><TrendCharts /></el-icon>
            <span class="header-title">碳排放趨勢分析</span>
          </div>
          <div class="header-right">
            <el-radio-group v-model="phaseType" size="small" style="margin-right: 15px;">
              <el-radio-button label="single">單相110V</el-radio-button>
              <el-radio-button label="single220">單相220V</el-radio-button>
              <el-radio-button label="three">三相</el-radio-button>
              <el-radio-button label="total">三迴路加總</el-radio-button>
            </el-radio-group>
            <el-radio-group v-model="timeRange" size="small">
              <el-radio-button label="day">日</el-radio-button>
              <el-radio-button label="week">週</el-radio-button>
              <el-radio-button label="month">月</el-radio-button>
              <el-radio-button label="year">年</el-radio-button>
            </el-radio-group>
          </div>
        </div>
      </template>

      <!-- 統計卡片 -->
      <div class="stats-cards">
        <div class="stat-card">
          <div class="stat-icon" style="background: #67c23a20;">
            <el-icon color="#67c23a" :size="24"><TrendCharts /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-label">總碳排放</div>
            <div class="stat-value">{{ totalEmission.toFixed(2) }} <span class="stat-unit">kgCO₂e</span></div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon" style="background: #409eff20;">
            <el-icon color="#409eff" :size="24"><DataAnalysis /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-label">平均碳排放</div>
            <div class="stat-value">{{ avgEmission.toFixed(2) }} <span class="stat-unit">kgCO₂e</span></div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon" style="background: #e6a23c20;">
            <el-icon color="#e6a23c" :size="24"><Orange /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-label">相當於種植</div>
            <div class="stat-value">{{ treesNeeded.toFixed(0) }} <span class="stat-unit">棵樹</span></div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon" style="background: #f56c6c20;">
            <el-icon color="#f56c6c" :size="24"><CaretTop /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-label">峰值</div>
            <div class="stat-value">{{ maxEmission.toFixed(2) }} <span class="stat-unit">kgCO₂e</span></div>
          </div>
        </div>
      </div>

      <!-- 圖表 -->
      <div class="chart-container" v-loading="loading">
        <div ref="chartRef" class="chart"></div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { TrendCharts, DataAnalysis, Orange, CaretTop } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import powerApiService, { DEVICE_ID } from '../services/powerApiService.js'

// State
const chartRef = ref(null)
const chartInstance = ref(null)
const phaseType = ref('single') // single, three
const timeRange = ref('day') // day, week, month, year
const chartData = ref([])
const loading = ref(false)
let loadRequestId = 0 // 請求序號，避免舊請求（例如快速切換時較晚才回應的）覆蓋新選擇的結果

// 統計數據
const totalEmission = computed(() => {
  if (chartData.value.length === 0) return 0
  return chartData.value.reduce((sum, item) => sum + item.value, 0)
})

const avgEmission = computed(() => {
  if (chartData.value.length === 0) return 0
  return totalEmission.value / chartData.value.length
})

const maxEmission = computed(() => {
  if (chartData.value.length === 0) return 0
  return Math.max(...chartData.value.map(item => item.value))
})

const treesNeeded = computed(() => {
  // 一棵樹每年吸收約 21 kg CO₂
  return totalEmission.value / 21
})

// 計算 Power API 年模式月增量
const processYearDataFromApi = (summaries) => {
  const monthlyMap = new Map()
  summaries.forEach(s => {
    const monthKey = s.date.substring(0, 7)
    const displayKey = monthKey.replace('-', '/')
    const val = parseFloat(s.co2e_kg) || 0
    monthlyMap.set(monthKey, { time: displayKey, value: val })
  })

  const sortedMonths = Array.from(monthlyMap.keys()).sort()
  const increments = new Map()
  let prev = null
  sortedMonths.forEach(key => {
    const d = monthlyMap.get(key)
    increments.set(d.time, { time: d.time, value: prev !== null ? Math.max(0, d.value - prev) : 0 })
    prev = d.value
  })

  const result = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`
    result.push(increments.get(key) || { time: key, value: 0 })
  }
  return result
}

// 依迴路類型取得對應的 ThingSpeak 頻道 ID
const CHANNEL_ID_BY_PHASE = {
  single: () => import.meta.env.VITE_THINGSPEAK_CHANNEL_ID_SINGLE,
  single220: () => import.meta.env.VITE_THINGSPEAK_CHANNEL_ID_SINGLE220,
  three: () => import.meta.env.VITE_THINGSPEAK_CHANNEL_ID_THREE,
}

// 依目前選擇的時間範圍組出 ThingSpeak 查詢網址
function buildThingSpeakUrl(channelId) {
  const now = new Date()
  if (timeRange.value === 'day') {
    const start = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    return `https://api.thingspeak.com/channels/${channelId}/feeds.json?start=${start.toISOString()}`
  } else if (timeRange.value === 'week') {
    // 改抓原始資料（不用 ThingSpeak 的每日平均），改用每天最後一筆讀值計算增量，
    // 才不會在裝置剛開始回報、資料不連續時被平均值拉低
    const start = new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000)
    return `https://api.thingspeak.com/channels/${channelId}/feeds.json?start=${start.toISOString()}`
  } else if (timeRange.value === 'month') {
    const start = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000)
    return `https://api.thingspeak.com/channels/${channelId}/feeds.json?start=${start.toISOString()}`
  }
  // year
  return `https://api.thingspeak.com/channels/${channelId}/feeds.json?average=1440&results=400`
}

// 抓取單一迴路的碳排放時間序列（供「三迴路加總」合併使用）
async function fetchPhaseSeries(phaseKey) {
  const channelId = CHANNEL_ID_BY_PHASE[phaseKey]()
  const response = await fetch(buildThingSpeakUrl(channelId))
  if (!response.ok) throw new Error('無法獲取資料')
  const data = await response.json()
  return processChartData(data.feeds)
}

// 將多組時間序列依時間點加總（缺項視為 0）
function mergeSum(seriesList) {
  const map = new Map()
  seriesList.forEach((series) => {
    series.forEach((item) => {
      map.set(item.time, (map.get(item.time) || 0) + (item.value || 0))
    })
  })
  return Array.from(map, ([time, value]) => ({ time, value }))
}

// 載入數據
const loadData = async () => {
  // 記錄本次請求的序號；若載入完成時已經有更新的請求發出，就捨棄這次的結果，
  // 避免快速切換選項時，較晚回應的舊請求覆蓋掉新選擇的正確資料
  const requestId = ++loadRequestId
  const isStale = () => requestId !== loadRequestId

  loading.value = true
  try {
    // 三迴路加總：分別抓取單相110V／單相220V／三相後合併，不走 Power API
    if (phaseType.value === 'total') {
      const [singleSeries, single220Series, threeSeries] = await Promise.all([
        fetchPhaseSeries('single'),
        fetchPhaseSeries('single220'),
        fetchPhaseSeries('three'),
      ])
      if (isStale()) return
      const merged = mergeSum([singleSeries, single220Series, threeSeries])
      chartData.value = merged
      updateChart(merged)
      return
    }

    const deviceId = phaseType.value === 'single' ? DEVICE_ID.SINGLE : DEVICE_ID.THREE
    const now = new Date()

    // 單相220V 目前只有 ThingSpeak 頻道，尚無對應的 Power API 裝置
    if (phaseType.value !== 'single220' && powerApiService.isAvailable) {
      try {
        if (timeRange.value === 'year') {
          const startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1)
          const summaries = await powerApiService.getDailySummary(deviceId, startDate, now)
          if (isStale()) return
          if (summaries.length > 0) {
            const processedData = processYearDataFromApi(summaries)
            chartData.value = processedData
            updateChart(processedData)
            return
          }
        } else {
          const daysMap = { day: 1, week: 7, month: 30 }
          const startDate = new Date(now.getTime() - daysMap[timeRange.value] * 24 * 60 * 60 * 1000)
          const result = await powerApiService.getHistoricalData(deviceId, startDate, now)
          if (isStale()) return
          if (result.status === 'success' && result.data.carbonEmission.length > 0) {
            console.log(`✅ 碳排放資料來自 Power API`)
            chartData.value = result.data.carbonEmission
            updateChart(result.data.carbonEmission)
            return
          }
        }
      } catch (e) {
        console.warn('⚠️ Power API 碳排放失敗，改用 ThingSpeak', e)
      }
    }

    // 備用：ThingSpeak
    const channelId = CHANNEL_ID_BY_PHASE[phaseType.value]()
    console.log(`📊 ThingSpeak 碳排放資料 (${phaseType.value} / ${timeRange.value})`)
    const response = await fetch(buildThingSpeakUrl(channelId))
    if (!response.ok) throw new Error('無法獲取資料')
    const data = await response.json()
    if (isStale()) return

    const processedData = processChartData(data.feeds)
    chartData.value = processedData
    updateChart(processedData)
  } catch (error) {
    console.error('❌ 載入碳排放資料失敗:', error)
  } finally {
    if (!isStale()) loading.value = false
  }
}

// 處理圖表資料
const processChartData = (feeds) => {
  if (!feeds || feeds.length < 2) return []

  if (timeRange.value === 'day') {
    // 日模式：按小時分組，計算每小時的增量
    const grouped = {}

    feeds.forEach(feed => {
      // 轉換為本地時間
      const timestamp = new Date(feed.created_at)
      const localHour = timestamp.getHours()
      const localDate = timestamp.getDate()
      const localMonth = timestamp.getMonth() + 1

      // 使用 "月/日 時:00" 格式，確保跨天時也能正確排序
      const hourKey = `${localMonth}/${localDate} ${String(localHour).padStart(2, '0')}:00`

      if (!grouped[hourKey]) {
        grouped[hourKey] = {
          values: [],
          timestamp: timestamp.getTime()
        }
      }

      const carbonValue = parseFloat(feed.field7)
      // 只添加有效的數值
      if (carbonValue && !isNaN(carbonValue)) {
        grouped[hourKey].values.push(carbonValue)
      }
    })

    // 按時間戳排序，然後計算每小時的增量
    const result = []
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
      return grouped[a].timestamp - grouped[b].timestamp
    })

    sortedKeys.forEach(key => {
      const values = grouped[key].values
      if (values.length > 0) {
        const increment = values[values.length - 1] - values[0]
        // 只顯示小時部分（去掉日期）
        const timeOnly = key.split(' ')[1]
        result.push({
          time: timeOnly,
          value: Math.max(0, increment)
        })
      }
    })

    return result
  } else if (timeRange.value === 'year') {
    // 年模式：計算月與月之間的增量
    const monthlyData = new Map()

    // 按時間順序處理，保存每月最後一筆有效數據
    feeds.forEach(feed => {
      const carbonValue = parseFloat(feed.field7)
      if (!carbonValue || isNaN(carbonValue)) {
        return // 跳過無效數據
      }

      const feedDate = feed.created_at.split('T')[0] // YYYY-MM-DD
      const monthKey = feedDate.substring(0, 7) // YYYY-MM
      const displayKey = monthKey.replace('-', '/') // YYYY/MM

      // 總是保存該月的數據（後面的會覆蓋前面的，確保是最後一筆）
      monthlyData.set(monthKey, {
        time: displayKey,
        value: carbonValue,
        date: feedDate
      })
    })

    // 計算月與月之間的增量
    const sortedMonths = Array.from(monthlyData.keys()).sort()
    const monthlyIncrements = new Map()
    let previousValue = null

    sortedMonths.forEach(monthKey => {
      const data = monthlyData.get(monthKey)
      let increment = 0

      if (previousValue !== null) {
        increment = Math.max(0, data.value - previousValue)
      }

      // 使用 data.time (YYYY/MM 格式) 作為 key
      monthlyIncrements.set(data.time, {
        time: data.time,
        value: increment,
        hasValidData: true
      })

      previousValue = data.value
    })

    // 生成最近12個月的完整列表
    const result = []
    const now = new Date()

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const year = d.getFullYear()
      const month = d.getMonth() + 1
      const displayKey = `${year}/${String(month).padStart(2, '0')}` // YYYY/MM

      if (monthlyIncrements.has(displayKey)) {
        result.push(monthlyIncrements.get(displayKey))
      } else {
        // 沒有數據的月份，填充 0
        result.push({ time: displayKey, value: 0, hasValidData: false })
      }
    }

    return result
  } else {
    // 週和月模式：現在抓的是原始資料（非 ThingSpeak 的每日平均），
    // 第一步：先依「當地日期」分組，取每天最後一筆有效讀值
    // （用當天結束時的累積值計算增量，避免裝置剛開始回報、資料不連續時
    // 被「當日平均值」拉低，導致跟日模式的增量算法對不起來）
    const lastValueByDate = new Map()

    feeds.forEach(feed => {
      const currentValue = parseFloat(feed.field7)
      if (!currentValue || isNaN(currentValue)) return

      const feedDate = feed.created_at.split('T')[0] // YYYY-MM-DD
      const timestamp = new Date(feed.created_at)
      const existing = lastValueByDate.get(feedDate)
      if (!existing) {
        lastValueByDate.set(feedDate, { firstValue: currentValue, value: currentValue, timestamp })
      } else if (timestamp > existing.timestamp) {
        existing.value = currentValue
        existing.timestamp = timestamp
      }
    })

    // 第二步：依日期順序，計算相鄰兩天「當日最後讀值」的差值。
    // 若是這段區間裡「第一個有資料的日子」（沒有前一天可比對，例如裝置剛開始回報），
    // 改用「當天最後讀值 - 當天第一筆讀值」，才不會漏算裝置開始回報那天自己累積的量
    const dataMap = new Map()
    let previousValue = null

    Array.from(lastValueByDate.keys()).sort().forEach(feedDate => {
      const { value: currentValue, firstValue, timestamp } = lastValueByDate.get(feedDate)
      const dateKey = `${timestamp.getMonth() + 1}/${timestamp.getDate()}`

      const increment = previousValue !== null
        ? Math.max(0, currentValue - previousValue)
        : Math.max(0, currentValue - firstValue)

      dataMap.set(feedDate, { time: dateKey, value: increment, hasValidData: true })
      previousValue = currentValue
    })

    // 第二步：填補缺失的日期
    const result = []
    const now = new Date()
    let daysToShow = timeRange.value === 'week' ? 7 : 30

    // 生成日期範圍（往前推指定天數）
    for (let i = daysToShow - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      const dateKey = `${d.getMonth() + 1}/${d.getDate()}`

      if (dataMap.has(dateStr)) {
        result.push(dataMap.get(dateStr))
      } else {
        // 沒有數據的日期，填充 0
        result.push({ time: dateKey, value: 0, hasValidData: false })
      }
    }

    return result
  }
}

// 更新圖表
const updateChart = (data) => {
  if (!chartInstance.value || data.length === 0) return

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const param = params[0]
        return `
          <div style="padding: 8px;">
            <div style="font-weight: bold; margin-bottom: 8px;">${param.name}</div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${param.color};"></span>
              <span>碳排放: <strong>${param.value.toFixed(2)} kgCO₂e</strong></span>
            </div>
            <div style="margin-top: 8px; font-size: 12px; color: #999;">
              🌳 相當於需種植 ${(param.value / 21).toFixed(1)} 棵樹抵消
            </div>
          </div>
        `
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: data.map(item => item.time),
      axisLabel: {
        rotate: (timeRange.value === 'month' || timeRange.value === 'year') ? 45 : 0,
        fontSize: 11
      }
    },
    yAxis: {
      type: 'value',
      name: 'kgCO₂e',
      axisLabel: {
        formatter: '{value}'
      }
    },
    series: [
      {
        name: '碳排放',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: {
          width: 3
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(103, 194, 58, 0.3)' },
            { offset: 1, color: 'rgba(103, 194, 58, 0.05)' }
          ])
        },
        itemStyle: {
          color: '#67c23a'
        },
        data: data.map(item => item.value)
      }
    ]
  }

  chartInstance.value.setOption(option)
}

// 初始化圖表
const initChart = () => {
  if (!chartRef.value) return

  chartInstance.value = echarts.init(chartRef.value)

  // 響應式調整
  window.addEventListener('resize', () => {
    chartInstance.value?.resize()
  })
}

// 生命週期
onMounted(() => {
  initChart()
  loadData()
})

onUnmounted(() => {
  chartInstance.value?.dispose()
})

watch(timeRange, () => {
  loadData()
})

watch(phaseType, () => {
  loadData()
})
</script>

<style scoped>
.carbon-emission-chart {
  width: 100%;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-icon {
  font-size: 20px;
  color: #67c23a;
}

.header-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;
  transition: all 0.3s;
}

.stat-card:hover {
  background: #ecf5ff;
  transform: translateY(-2px);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-content {
  flex: 1;
}

.stat-label {
  font-size: 13px;
  color: #909399;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}

.stat-unit {
  font-size: 12px;
  font-weight: 400;
  color: #909399;
}

.chart-container {
  width: 100%;
  min-height: 400px;
  position: relative;
}

.chart {
  width: 100%;
  height: 400px;
}
</style>
