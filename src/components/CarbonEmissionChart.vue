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
import powerApiService, { deviceIdByType } from '../services/powerApiService.js'

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

// 「三迴路加總」要合併的迴路
const PHASE_KEYS = ['single', 'single220', 'three']

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

// 載入數據（全部由 Power API 計算好各區間增量）
const loadData = async () => {
  // 記錄本次請求的序號；若載入完成時已經有更新的請求發出，就捨棄這次的結果，
  // 避免快速切換選項時，較晚回應的舊請求覆蓋掉新選擇的正確資料
  const requestId = ++loadRequestId
  const isStale = () => requestId !== loadRequestId

  loading.value = true
  try {
    const range = timeRange.value
    let series
    if (phaseType.value === 'total') {
      // 三迴路加總：單相110V／單相220V／三相分別取得後合併
      const all = await Promise.all(PHASE_KEYS.map(k => powerApiService.getCarbonSeries(deviceIdByType(k), range)))
      series = mergeSum(all)
    } else {
      series = await powerApiService.getCarbonSeries(deviceIdByType(phaseType.value), range)
    }
    if (isStale()) return
    chartData.value = series
    updateChart(series)
  } catch (error) {
    console.error('❌ 載入碳排放資料失敗:', error)
  } finally {
    if (!isStale()) loading.value = false
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
