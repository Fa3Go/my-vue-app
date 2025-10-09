<template>
  <div class="real-time-chart">
    <div ref="chartRef" class="chart-container"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  type: {
    type: String,
    default: 'power'
  },
  data: {
    type: Array,
    default: () => []
  },
  dataSource: {
    type: String,
    default: 'single' // 'single' 或 'three'
  }
})

const chartRef = ref(null)
let chart = null

const initChart = () => {
  if (chartRef.value) {
    chart = echarts.init(chartRef.value)
    updateChart()
  }
}

const updateChart = () => {
  if (!chart) return

  const times = props.data.map(item => item.time)
  const values = props.data.map(item => item.value)

  // 計算動態範圍
  const yAxisRange = calculateYAxisRange(values)

  const option = {
    title: {
      text: getChartTitle(),
      left: 'center',
      textStyle: {
        fontSize: 16,
        fontWeight: 'normal'
      }
    },
    tooltip: {
      trigger: 'axis',
      formatter: function(params) {
        const data = params[0]
        const value = typeof data.value === 'number' ? data.value.toFixed(2) : data.value
        return `${data.name}<br/>${value} ${getUnit()}`
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: times,
      axisLabel: {
        rotate: 45,
        fontSize: 10
      }
    },
    yAxis: {
      type: 'value',
      name: getUnit(),
      nameLocation: 'middle',
      nameGap: 30,
      min: yAxisRange.min,
      max: yAxisRange.max,
      axisLabel: {
        formatter: function(value) {
          // 格式化為 2 位小數
          return value.toFixed(2) + ' ' + getUnit()
        }
      }
    },
    series: [
      {
        name: getChartTitle(),
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        data: values,
        itemStyle: {
          color: getChartColor()
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            {
              offset: 0,
              color: getChartColor(0.3)
            },
            {
              offset: 1,
              color: getChartColor(0.1)
            }
          ])
        },
        lineStyle: {
          width: 3
        }
      }
    ],
    animation: true,
    animationDuration: 1000
  }

  chart.setOption(option)
}

const getChartTitle = () => {
  const titles = {
    voltage: '實時電壓',
    current: '實時電流',
    power: '實時功率',
    energy: '實時用電量',
    frequency: '實時頻率',
    powerFactor: '實時功率因子',
    carbonEmission: '實時碳排當量'
  }
  return titles[props.type] || '實時數據'
}

const getUnit = () => {
  const units = {
    voltage: 'V',
    current: 'A',
    power: 'W',
    energy: 'kWh',
    frequency: 'Hz',
    powerFactor: 'pf',
    carbonEmission: 'kgCO₂e'
  }
  return units[props.type] || ''
}

const getChartColor = (alpha = 1) => {
  const colors = {
    voltage: `rgba(76, 175, 80, ${alpha})`,       // 綠色 - field1
    current: `rgba(33, 150, 243, ${alpha})`,       // 藍色 - field2
    power: `rgba(255, 152, 0, ${alpha})`,          // 橙色 - field3
    energy: `rgba(156, 39, 176, ${alpha})`,        // 紫色 - field4
    frequency: `rgba(0, 150, 136, ${alpha})`,      // 青色 - field5
    powerFactor: `rgba(63, 81, 181, ${alpha})`,    // 靛藍色 - field6
    carbonEmission: `rgba(244, 67, 54, ${alpha})`  // 紅色 - field7
  }
  return colors[props.type] || `rgba(76, 175, 80, ${alpha})`
}

// 計算動態 Y 軸範圍
const calculateYAxisRange = (values) => {
  if (!values || values.length === 0) {
    return { min: 0, max: 100 }
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min

  // 根據資料類型設定不同的範圍策略
  let minRange, maxRange

  switch (props.type) {
    case 'voltage':
      // 電壓範圍：實際值 ± 10%
      minRange = Math.max(0, min - range * 0.1)
      maxRange = max + range * 0.1
      break
    case 'current':
      // 電流範圍：實際值 ± 20%
      minRange = Math.max(0, min - range * 0.2)
      maxRange = max + range * 0.2
      break
    case 'power':
      // 功率範圍：實際值 ± 15%
      minRange = Math.max(0, min - range * 0.15)
      maxRange = max + range * 0.15
      break
    case 'energy':
      // 用電量範圍：實際值 ± 10%
      minRange = Math.max(0, min - range * 0.1)
      maxRange = max + range * 0.1
      break
    case 'frequency':
      // 頻率範圍：實際值 ± 5%
      minRange = Math.max(45, min - range * 0.05)
      maxRange = Math.min(65, max + range * 0.05)
      break
    case 'powerFactor':
      // 功率因子範圍：0-1
      minRange = 0
      maxRange = 1
      break
    case 'carbonEmission':
      // 碳排當量範圍：實際值 ± 20%
      minRange = Math.max(0, min - range * 0.2)
      maxRange = max + range * 0.2
      break
    default:
      // 其他類型：實際值 ± 20%
      minRange = Math.max(0, min - range * 0.2)
      maxRange = max + range * 0.2
  }

  return { min: minRange, max: maxRange }
}

const handleResize = () => {
  if (chart) {
    chart.resize()
  }
}

onMounted(() => {
  initChart()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  if (chart) {
    chart.dispose()
  }
  window.removeEventListener('resize', handleResize)
})

watch(() => props.data, updateChart, { deep: true })
watch(() => props.type, updateChart)
</script>

<style scoped>
.real-time-chart {
  width: 100%;
  height: 400px;
}

.chart-container {
  width: 100%;
  height: 100%;
}
</style> 