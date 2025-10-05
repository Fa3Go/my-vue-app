<template>
  <div class="test-chart">
    <h3>Chart.js 測試</h3>
    <canvas ref="chartCanvas" width="400" height="200"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import {
  Chart,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'

// 註冊Chart.js元件
Chart.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

const chartCanvas = ref(null)

onMounted(() => {
  if (chartCanvas.value) {
    new Chart(chartCanvas.value, {
      type: 'line',
      data: {
        labels: ['1', '2', '3', '4', '5'],
        datasets: [{
          label: '測試資料',
          data: [12, 19, 3, 5, 2],
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Chart.js 測試圖表'
          }
        }
      }
    })
  }
})
</script>

<style scoped>
.test-chart {
  padding: 20px;
  border: 1px solid #ddd;
  margin: 20px;
}
</style>
