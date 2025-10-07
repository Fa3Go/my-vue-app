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
            <el-radio-group v-model="timeRange" size="small" @change="loadData">
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

// State
const chartRef = ref(null)
const chartInstance = ref(null)
const timeRange = ref('day') // day, week, month
const chartData = ref([])
const loading = ref(false)

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

// 載入數據
const loadData = async () => {
  loading.value = true
  try {
    let url = ''
    const now = new Date()

    if (timeRange.value === 'day') {
      // 日模式：獲取最近24小時的所有原始數據（不使用average）
      const start = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      url = `https://api.thingspeak.com/channels/2521976/feeds.json?start=${start.toISOString()}`
    } else if (timeRange.value === 'week') {
      // 週模式：最近 8 天的每日平均值
      const start = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000)
      url = `https://api.thingspeak.com/channels/2521976/feeds.json?start=${start.toISOString()}&average=1440`
    } else if (timeRange.value === 'month') {
      // 月模式：最近 31 天的每日平均值
      const start = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000)
      url = `https://api.thingspeak.com/channels/2521976/feeds.json?start=${start.toISOString()}&average=1440`
    } else if (timeRange.value === 'year') {
      // 年模式：最近 13 個月的每日平均值（用於計算每月增量）
      const start = new Date(now.getTime() - 13 * 30 * 24 * 60 * 60 * 1000)
      url = `https://api.thingspeak.com/channels/2521976/feeds.json?start=${start.toISOString()}&average=1440`
    }

    console.log(`📊 載入 ${timeRange.value} 碳排放資料...`, url)

    const response = await fetch(url)

    if (!response.ok) {
      throw new Error('無法獲取資料')
    }

    const data = await response.json()
    console.log(`✅ 獲取 ${data.feeds?.length || 0} 筆資料`)

    // 處理並分組資料
    const processedData = processChartData(data.feeds)
    chartData.value = processedData

    // 更新圖表
    updateChart(processedData)
  } catch (error) {
    console.error('❌ 載入碳排放資料失敗:', error)
  } finally {
    loading.value = false
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

      const carbonValue = parseFloat(feed.field7) || 0
      grouped[hourKey].values.push(carbonValue)
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
    // 年模式：按月分組，計算每月的碳排放增量
    const monthlyData = {}

    // 先將每日數據按月份分組
    feeds.forEach(feed => {
      const timestamp = new Date(feed.created_at)
      const year = timestamp.getFullYear()
      const month = timestamp.getMonth() + 1
      const monthKey = `${year}/${String(month).padStart(2, '0')}`

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = []
      }

      const carbonValue = parseFloat(feed.field7) || 0
      monthlyData[monthKey].push(carbonValue)
    })

    // 計算每月的增量（月底 - 月初）
    const result = []
    const sortedMonths = Object.keys(monthlyData).sort()

    sortedMonths.forEach(monthKey => {
      const values = monthlyData[monthKey]
      if (values.length > 0) {
        // 取該月最後一天減去第一天的值
        const monthIncrement = values[values.length - 1] - values[0]
        result.push({
          time: monthKey,
          value: Math.max(0, monthIncrement)
        })
      }
    })

    // 返回最近12個月
    return result.slice(-12)
  } else {
    // 週和月模式：計算相鄰兩天的差值
    const result = []

    for (let i = 1; i < feeds.length; i++) {
      const currentValue = parseFloat(feeds[i].field7) || 0
      const previousValue = parseFloat(feeds[i - 1].field7) || 0
      const increment = currentValue - previousValue

      const timestamp = new Date(feeds[i].created_at)
      const dateKey = `${timestamp.getMonth() + 1}/${timestamp.getDate()}`

      result.push({
        time: dateKey,
        value: Math.max(0, increment)
      })
    }

    // 根據時間範圍限制返回的資料筆數
    if (timeRange.value === 'week') {
      return result.slice(-7)
    } else {
      return result.slice(-30)
    }
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
