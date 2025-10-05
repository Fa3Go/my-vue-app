<template>
  <div class="chart-container">
    <canvas ref="chartCanvas"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import {
  Chart,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'

// 註冊Chart.js元件
Chart.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const props = defineProps({
  data: {
    type: Array,
    default: () => []
  },
  type: {
    type: String,
    default: 'power'
  },
  title: {
    type: String,
    default: '數據圖表'
  }
})

const chartCanvas = ref(null)
let chartInstance = null

const chartConfig = {
  power: {
    label: '功率 (W)',
    color: '#4CAF50'
  },
  voltage: {
    label: '電壓 (V)',
    color: '#2196F3'
  },
  current: {
    label: '電流 (A)',
    color: '#FF9800'
  },
  energy: {
    label: '用電量 (kWh)',
    color: '#9C27B0'
  },
  frequency: {
    label: '頻率 (Hz)',
    color: '#F44336'
  },
  powerFactor: {
    label: '功率因子 (pf)',
    color: '#00BCD4'
  },
  carbonEmission: {
    label: '碳排放量 (kgCO₂e)',
    color: '#795548'
  }
}

const createChart = () => {
  if (!chartCanvas.value) return

  const config = chartConfig[props.type] || chartConfig.power
  
  const chartData = {
    labels: props.data.map(item => item.time),
    datasets: [{
      label: config.label,
      data: props.data.map(item => item[props.type]),
      borderColor: config.color,
      backgroundColor: config.color + '20',
      borderWidth: 2,
      fill: true,
      tension: 0.4
    }]
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: props.title
      },
      legend: {
        display: false
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: '時間'
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: config.label
        }
      }
    },
    animation: {
      duration: 750
    }
  }

  chartInstance = new Chart(chartCanvas.value, {
    type: 'line',
    data: chartData,
    options: options
  })
}

const updateChart = () => {
  if (!chartInstance) return

  const config = chartConfig[props.type] || chartConfig.power
  
  chartInstance.data.labels = props.data.map(item => item.time)
  chartInstance.data.datasets[0].data = props.data.map(item => item[props.type])
  chartInstance.data.datasets[0].label = config.label
  chartInstance.data.datasets[0].borderColor = config.color
  chartInstance.data.datasets[0].backgroundColor = config.color + '20'
  
  chartInstance.options.plugins.title.text = props.title
  chartInstance.options.scales.y.title.text = config.label
  
  chartInstance.update()
}

watch(() => [props.data, props.type, props.title], () => {
  nextTick(() => {
    if (chartInstance) {
      updateChart()
    } else {
      createChart()
    }
  })
}, { deep: true })

onMounted(() => {
  nextTick(() => {
    createChart()
  })
})

onUnmounted(() => {
  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }
})
</script>

<style scoped>
.chart-container {
  position: relative;
  height: 300px;
  width: 100%;
}
</style>
