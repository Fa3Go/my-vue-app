<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import SinglePhaseMonitor from './components/SinglePhaseMonitor.vue'
import ThreePhaseMonitor from './components/ThreePhaseMonitor.vue'
import RealTimeChart from './components/RealTimeChart.vue'
import { Monitor, Refresh, Setting, DataAnalysis, Download } from '@element-plus/icons-vue'
import dataManager from './services/dataManager.js'

// 當前選中的頁面
const activePage = ref('realtime')
const dateRange = ref([])

// 歷史資料相關
const historyDataType = ref('single') // 'single' 或 'three'
const historyChartType = ref('voltage') // 'voltage', 'current', 'power', 'powerFactor'

const systemStatus = ref({
  totalPower: 0,
  voltage: 0,
  current: 0,
  frequency: 0,
  totalEnergy: 0,
  powerFactor: 0,
  carbonEmission: 0
})

const singlePhaseData = ref({
  voltage: 220,
  current: 10,
  power: 2200,
  energy: 15.5,
  frequency: 50,
  powerFactor: 0.95,
  carbonEmission: 2.1
})

const threePhaseData = ref({
  voltage: 220,
  current: 10,
  power: 2200,
  energy: 15.5,
  frequency: 50,
  powerFactor: 0.92,
  carbonEmission: 4.2
})

const singleChartType = ref('voltage')
const threeChartType = ref('voltage')
const singleChartData = ref([])
const threeChartData = ref([])

// 歷史資料存儲
const historyData = ref({
  single: {
    voltage: [],
    current: [],
    power: [],
    energy: [],
    frequency: [],
    powerFactor: [],
    carbonEmission: []
  },
  three: {
    voltage: [],
    current: [],
    power: [],
    energy: [],
    frequency: [],
    powerFactor: [],
    carbonEmission: []
  }
})

let dataInterval = null

// 生成歷史資料
const generateHistoryData = () => {
  const now = new Date()
  const data = []

  // 生成24小時的歷史資料
  for (let i = 23; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60 * 60 * 1000)
    data.push({
      time: time.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
      value: Math.floor(Math.random() * 50) + 200
    })
  }

  return data
}

// 初始化歷史資料
const initHistoryData = () => {
  // 單向歷史資料
  historyData.value.single.voltage = generateHistoryData()
  historyData.value.single.current = generateHistoryData()
  historyData.value.single.power = generateHistoryData()
  historyData.value.single.energy = generateHistoryData()
  historyData.value.single.frequency = generateHistoryData()
  historyData.value.single.powerFactor = generateHistoryData().map(item => ({
    ...item,
    value: (Math.random() * 0.2 + 0.8).toFixed(2)
  }))
  historyData.value.single.carbonEmission = generateHistoryData()

  // 三相歷史資料
  historyData.value.three.voltage = generateHistoryData()
  historyData.value.three.current = generateHistoryData()
  historyData.value.three.power = generateHistoryData()
  historyData.value.three.energy = generateHistoryData()
  historyData.value.three.frequency = generateHistoryData()
  historyData.value.three.powerFactor = generateHistoryData().map(item => ({
    ...item,
    value: (Math.random() * 0.2 + 0.8).toFixed(2)
  }))
  historyData.value.three.carbonEmission = generateHistoryData()
}

// 更新資料（使用資料管理器）
const updateData = async () => {
  try {
    // 從資料管理器獲取最新資料
    const systemData = dataManager.getSystemStatus()
    const singleData = dataManager.getSinglePhaseData()
    const threeData = dataManager.getThreePhaseData()

    // 檢查資料來源並記錄到控制台
    const connectionStatus = dataManager.getConnectionStatus()
    console.log('資料來源狀態:', connectionStatus)

    if (systemData && systemData.timestamp) {
      console.log('✅ 使用 ThingSpeak 真實資料')
      console.log('ThingSpeak 資料:', {
        電壓: systemData.voltage + 'V',
        電流: systemData.current + 'A',
        功率: systemData.power + 'W',
        頻率: systemData.frequency + 'Hz',
        功率因子: systemData.powerFactor + ' pf',
        用電量: systemData.energy + 'kWh',
        碳排放量: systemData.carbonEmission + 'kgCO2e'
      })
    } else {
      console.log('⚠️ 未獲取到 ThingSpeak 資料')
    }

    // 更新系統狀態（使用 ThingSpeak 真實資料）
    if (systemData) {
      systemStatus.value = {
        totalPower: systemData.power || 0,
        voltage: systemData.voltage || 0,
        current: systemData.current || 0,
        frequency: systemData.frequency || 0,
        totalEnergy: systemData.energy || 0,
        powerFactor: systemData.powerFactor || 0,
        carbonEmission: systemData.carbonEmission || 0
      }
    }

    // 更新單相資料（使用 ThingSpeak 真實資料）
    if (singleData) {
      singlePhaseData.value = {
        voltage: singleData.voltage || 0,
        current: singleData.current || 0,
        power: singleData.power || 0,
        energy: singleData.energy || 0,
        frequency: singleData.frequency || 0,
        powerFactor: singleData.powerFactor || 0,
        carbonEmission: singleData.carbonEmission || 0
      }
    }

    // 更新三相資料（使用 ThingSpeak 真實資料）
    if (threeData) {
      threePhaseData.value = {
        voltage: threeData.voltage || 0,
        current: threeData.current || 0,
        power: threeData.power || 0,
        energy: threeData.energy || 0,
        frequency: threeData.frequency || 0,
        powerFactor: threeData.powerFactor || 0,
        carbonEmission: threeData.carbonEmission || 0
      }
    }

    // 更新圖表資料（使用 ThingSpeak 真實資料）
    const now = new Date()
    const timeString = now.toLocaleTimeString()

    // 更新單相圖表資料
    if (singleData) {
      // 儲存完整的資料對象到歷史記錄
      singleDataHistory.value.push({
        time: timeString,
        data: { ...singleData }
      })

      // 保持最多 20 筆歷史記錄
      if (singleDataHistory.value.length > 20) {
        singleDataHistory.value.shift()
      }

      // 根據當前圖表類型計算顯示值
      const singleValue = getChartValue(singleData, singleChartType.value)
      singleChartData.value.push({
        time: timeString,
        value: singleValue
      })

      if (singleChartData.value.length > 20) {
        singleChartData.value.shift()
      }
    }

    // 更新三相圖表資料
    if (threeData) {
      // 儲存完整的資料對象到歷史記錄
      threeDataHistory.value.push({
        time: timeString,
        data: { ...threeData }
      })

      // 保持最多 20 筆歷史記錄
      if (threeDataHistory.value.length > 20) {
        threeDataHistory.value.shift()
      }

      // 根據當前圖表類型計算顯示值
      const threeValue = getChartValue(threeData, threeChartType.value)
      threeChartData.value.push({
        time: timeString,
        value: threeValue
      })

      if (threeChartData.value.length > 20) {
        threeChartData.value.shift()
      }
    }
  } catch (error) {
    console.error('更新資料失敗:', error)
  }
}

// 根據圖表類型獲取對應的資料值
const getChartValue = (data, chartType) => {
  switch (chartType) {
    case 'voltage':
      return data.voltage || 0
    case 'current':
      return data.current || 0
    case 'power':
      return data.power || 0
    case 'frequency':
      return data.frequency || 0
    case 'powerFactor':
      return data.powerFactor || 0
    case 'energy':
      return data.energy || 0
    case 'carbonEmission':
      return data.carbonEmission || 0
    default:
      return data.power || 0
  }
}

const refreshData = async () => {
  await dataManager.refreshData()
  await updateData()
}

const showSettings = () => {
  // 顯示設定對話框
  console.log('顯示設定')
}

// 頁面切換處理
const handlePageChange = (page) => {
  activePage.value = page
}

// 歷史資料類型切換
const handleHistoryTypeChange = (type) => {
  historyDataType.value = type
}

// 歷史圖表類型切換
const handleHistoryChartTypeChange = (type) => {
  historyChartType.value = type
}

// 下載歷史資料
const downloadHistoryData = () => {
  const data = historyDataType.value === 'single'
    ? historyData.value.single
    : historyData.value.three

  // 添加BOM頭以支援中文顯示
  let csvContent = "\uFEFF"

  if (historyDataType.value === 'single') {
    // 單向單一資料
    csvContent += "時間," + historyChartType.value + "\n"
    csvContent += data[historyChartType.value].map(item =>
      `${item.time},${item.value}`
    ).join("\n")
  } else {
    // 三相單一資料
    csvContent += "時間," + historyChartType.value + "\n"
    csvContent += data[historyChartType.value].map(item =>
      `${item.time},${item.value}`
    ).join("\n")
  }

  // 創建Blob對象並下載
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.setAttribute("href", url)
  link.setAttribute("download", `${historyDataType.value}_${historyChartType.value}_${new Date().toISOString().split('T')[0]}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

// 下載完整歷史資料
const downloadCompleteHistoryData = () => {
  const data = historyDataType.value === 'single'
    ? historyData.value.single
    : historyData.value.three

  // 添加BOM頭以支援中文顯示
  let csvContent = "\uFEFF"

  if (historyDataType.value === 'single') {
    // 單向完整資料
    csvContent += "時間,電壓(V),電流(A),功率(W),用電量(kWh),頻率(Hz),功率因子(pf),碳排放量(kgCO2e)\n"
    for (let i = 0; i < data.voltage.length; i++) {
      csvContent += `${data.voltage[i].time},${data.voltage[i].value},${data.current[i].value},${data.power[i].value},${data.energy[i].value},${data.frequency[i].value},${data.powerFactor[i].value},${data.carbonEmission[i].value}\n`
    }
  } else {
    // 三相完整資料
    csvContent += "時間,電壓(V),電流(A),功率(W),用電量(kWh),頻率(Hz),功率因子(pf),碳排放量(kgCO2e)\n"
    for (let i = 0; i < data.voltage.length; i++) {
      csvContent += `${data.voltage[i].time},${data.voltage[i].value},${data.current[i].value},${data.power[i].value},${data.energy[i].value},${data.frequency[i].value},${data.powerFactor[i].value},${data.carbonEmission[i].value}\n`
    }
  }

  // 創建Blob對象並下載
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.setAttribute("href", url)
  link.setAttribute("download", `${historyDataType.value}_complete_data_${new Date().toISOString().split('T')[0]}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

onMounted(async () => {
  // 初始化資料管理器
  await dataManager.init()

  // 初始化歷史數據
  initHistoryData()

  // 更新數據並初始化圖表
  await updateData()

  // 初始化圖表數據（添加初始數據點，避免圖表為空）
  await initChartData()

  // 設置定時更新（每1分鐘更新一次，與 ThingSpeak 配置一致）
  dataInterval = setInterval(updateData, 60000)
})

// 初始化圖表資料
const initChartData = async () => {
  const singleData = dataManager.getSinglePhaseData()
  const threeData = dataManager.getThreePhaseData()

  const now = new Date()
  const timeString = now.toLocaleTimeString()

  if (singleData) {
    // 初始化歷史記錄
    singleDataHistory.value = [{
      time: timeString,
      data: { ...singleData }
    }]

    // 初始化圖表資料
    const singleValue = getChartValue(singleData, singleChartType.value)
    singleChartData.value = [{
      time: timeString,
      value: singleValue
    }]
    console.log('初始化單相圖表資料:', singleChartData.value)
  }

  if (threeData) {
    // 初始化歷史記錄
    threeDataHistory.value = [{
      time: timeString,
      data: { ...threeData }
    }]

    // 初始化圖表資料
    const threeValue = getChartValue(threeData, threeChartType.value)
    threeChartData.value = [{
      time: timeString,
      value: threeValue
    }]
    console.log('初始化三相圖表資料:', threeChartData.value)
  }
}

// 儲存歷史資料記錄（每次更新時儲存完整的資料對象）
const singleDataHistory = ref([])
const threeDataHistory = ref([])

// 監聽圖表類型變化，重新計算圖表資料
watch(singleChartType, (newType) => {
  console.log('單相圖表類型切換為:', newType)
  // 根據歷史資料重新計算圖表資料
  singleChartData.value = singleDataHistory.value.map(item => ({
    time: item.time,
    value: getChartValue(item.data, newType)
  }))
  console.log(`單相圖表資料 (${newType}):`, singleChartData.value)
})

watch(threeChartType, (newType) => {
  console.log('三相圖表類型切換為:', newType)
  // 根據歷史資料重新計算圖表資料
  threeChartData.value = threeDataHistory.value.map(item => ({
    time: item.time,
    value: getChartValue(item.data, newType)
  }))
  console.log(`三相圖表資料 (${newType}):`, threeChartData.value)
})

onUnmounted(() => {
  if (dataInterval) {
    clearInterval(dataInterval)
  }
  // 清理資料管理器資源
  dataManager.destroy()
})
</script>

<template>
  <div id="app">
    <el-container class="app-container">
      <!-- 头部导航 -->
      <el-header class="app-header">
        <div class="header-content">
          <h1 class="app-title">
            <el-icon><Monitor /></el-icon>
            AI電力監測系統
          </h1>
          <div class="header-info">
            <el-tag type="success" size="large" class="classroom-tag">教室 H707</el-tag>
          </div>
          <div class="header-actions">
            <el-button type="success" @click="refreshData">
              <el-icon><Refresh /></el-icon>
              刷新數據
            </el-button>
            <el-button type="info" @click="showSettings">
              <el-icon><Setting /></el-icon>
              設置
            </el-button>
          </div>
        </div>
      </el-header>

      <el-container>
        <!-- 左侧导航栏 -->
        <el-aside width="250px" class="sidebar">
          <el-menu
            :default-active="activePage"
            class="sidebar-menu"
            @select="handlePageChange"
            background-color="#2c3e50"
            text-color="#ecf0f1"
            active-text-color="#4CAF50"
          >
            <div class="sidebar-header">
              <h3>功能選單</h3>
            </div>
            
            <el-menu-item index="realtime" class="menu-item">
              <el-icon><Monitor /></el-icon>
              <span>即時監測數據</span>
            </el-menu-item>
            
            <!-- <el-menu-item index="history" class="menu-item">
              <el-icon><DataAnalysis /></el-icon>
              <span>歷史數據分析</span>
            </el-menu-item> -->
            
            <el-menu-item index="download" class="menu-item">
              <el-icon><Download /></el-icon>
              <span>歷史資料下載</span>
            </el-menu-item>
          </el-menu>
        </el-aside>

        <!-- 主要内容区域 -->
        <el-main class="app-main">
          <!-- 实时监测数据页面 -->
          <div v-if="activePage === 'realtime'" class="page-content">
            <el-row :gutter="20">
              <!-- 系统概览卡片 -->
              <el-col :span="24">
                <el-card class="overview-card">
                  <template #header>
                    <div class="card-header">
                      <span>系統概覽</span>
                      <el-tag type="success">運行正常</el-tag>
                    </div>
                  </template>
                  <el-row :gutter="20">
                    <el-col :span="4">
                      <div class="metric-item">
                        <div class="metric-value">{{ systemStatus.totalPower }} W</div>
                        <div class="metric-label">總功率</div>
                      </div>
                    </el-col>
                    <el-col :span="4">
                      <div class="metric-item">
                        <div class="metric-value">{{ systemStatus.voltage }} V</div>
                        <div class="metric-label">電壓</div>
                      </div>
                    </el-col>
                    <el-col :span="4">
                      <div class="metric-item">
                        <div class="metric-value">{{ systemStatus.current }} A</div>
                        <div class="metric-label">電流</div>
                      </div>
                    </el-col>
                    <el-col :span="4">
                      <div class="metric-item">
                        <div class="metric-value">{{ systemStatus.frequency }} Hz</div>
                        <div class="metric-label">頻率</div>
                      </div>
                    </el-col>
                    <el-col :span="4">
                      <div class="metric-item">
                        <div class="metric-value">{{ systemStatus.totalEnergy }} kWh</div>
                        <div class="metric-label">用電量</div>
                      </div>
                    </el-col>
                    <el-col :span="4">
                      <div class="metric-item">
                        <div class="metric-value">{{ systemStatus.carbonEmission }} kgCO2e</div>
                        <div class="metric-label">碳排放</div>
                      </div>
                    </el-col>
                  </el-row>
                </el-card>
              </el-col>
            </el-row>

            <el-row :gutter="20" style="margin-top: 20px;">
              <!-- 单向电力监测 -->
              <el-col :span="12">
                <el-card class="monitoring-card">
                  <template #header>
                    <div class="card-header">
                      <span>單相電力監測</span>
                      <el-tag type="success">ThingSpeak 真實資料</el-tag>
                    </div>
                  </template>
                  <SinglePhaseMonitor :data="singlePhaseData" />
                </el-card>
              </el-col>

              <!-- 三相电力监测 -->
              <el-col :span="12">
                <el-card class="monitoring-card">
                  <template #header>
                    <div class="card-header">
                      <span>三相電力監測</span>
                      <el-tag type="success">ThingSpeak 真實資料</el-tag>
                    </div>
                  </template>
                  <ThreePhaseMonitor :data="threePhaseData" />
                </el-card>
              </el-col>
            </el-row>

            <el-row :gutter="20" style="margin-top: 20px;">
              <!-- 單相實時數據圖表 -->
              <el-col :span="12">
                <el-card class="chart-card">
                  <template #header>
                    <div class="card-header">
                      <span>單相實時數據圖表</span>
                      <el-tag type="success">ThingSpeak 真實資料</el-tag>
                    </div>
                  </template>
                  <div class="chart-controls">
                    <el-radio-group v-model="singleChartType" size="small">
                      <el-radio-button label="voltage">電壓</el-radio-button>
                      <el-radio-button label="current">電流</el-radio-button>
                      <el-radio-button label="power">功率</el-radio-button>
                      <el-radio-button label="energy">用電量</el-radio-button>
                      <el-radio-button label="frequency">頻率</el-radio-button>
                      <el-radio-button label="powerFactor">功率因子</el-radio-button>
                      <el-radio-button label="carbonEmission">碳排當量</el-radio-button>
                    </el-radio-group>
                  </div>
                  <RealTimeChart :type="singleChartType" :data="singleChartData" :data-source="'single'" />
                </el-card>
              </el-col>

              <!-- 三相實時數據圖表 -->
              <el-col :span="12">
                <el-card class="chart-card">
                  <template #header>
                    <div class="card-header">
                      <span>三相實時數據圖表</span>
                      <el-tag type="success">ThingSpeak 真實資料</el-tag>
                    </div>
                  </template>
                  <div class="chart-controls">
                    <el-radio-group v-model="threeChartType" size="small">
                      <el-radio-button label="voltage">電壓</el-radio-button>
                      <el-radio-button label="current">電流</el-radio-button>
                      <el-radio-button label="power">功率</el-radio-button>
                      <el-radio-button label="energy">用電量</el-radio-button>
                      <el-radio-button label="frequency">頻率</el-radio-button>
                      <el-radio-button label="powerFactor">功率因子</el-radio-button>
                      <el-radio-button label="carbonEmission">碳排當量</el-radio-button>
                    </el-radio-group>
                  </div>
                  <RealTimeChart :type="threeChartType" :data="threeChartData" :data-source="'three'" />
                </el-card>
              </el-col>
            </el-row>
          </div>

          <!-- 历史数据分析页面 -->
          <div v-else-if="activePage === 'history'" class="page-content">
            <el-card class="history-card">
              <template #header>
                <div class="card-header">
                  <span>歷史數據分析</span>
                  <div class="history-controls">
                    <el-radio-group v-model="historyDataType" @change="handleHistoryTypeChange" size="small">
                      <el-radio-button label="single">單相</el-radio-button>
                      <el-radio-button label="three">三相</el-radio-button>
                    </el-radio-group>
                    <el-date-picker
                      v-model="dateRange"
                      type="daterange"
                      range-separator="至"
                      start-placeholder="開始日期"
                      end-placeholder="結束日期"
                      size="small"
                    />
                  </div>
                </div>
              </template>
              
              <div class="history-content">
                <!-- 单向历史数据 -->
                <div v-if="historyDataType === 'single'" class="single-history">
                  <el-row :gutter="20">
                    <el-col :span="12">
                      <el-card class="history-chart-card">
                        <template #header>
                          <div class="chart-header">
                            <span>電壓歷史趨勢</span>
                            <el-tag type="info">V</el-tag>
                          </div>
                        </template>
                        <RealTimeChart type="voltage" :data="historyData.single.voltage" />
                      </el-card>
                    </el-col>
                    <el-col :span="12">
                      <el-card class="history-chart-card">
                        <template #header>
                          <div class="chart-header">
                            <span>電流歷史趨勢</span>
                            <el-tag type="info">A</el-tag>
                          </div>
                        </template>
                        <RealTimeChart type="current" :data="historyData.single.current" />
                      </el-card>
                    </el-col>
                  </el-row>
                  
                  <el-row :gutter="20" style="margin-top: 20px;">
                    <el-col :span="12">
                      <el-card class="history-chart-card">
                        <template #header>
                          <div class="chart-header">
                            <span>功率歷史趨勢</span>
                            <el-tag type="info">W</el-tag>
                          </div>
                        </template>
                        <RealTimeChart type="power" :data="historyData.single.power" />
                      </el-card>
                    </el-col>
                    <el-col :span="12">
                      <el-card class="history-chart-card">
                        <template #header>
                          <div class="chart-header">
                            <span>用電量歷史趨勢</span>
                            <el-tag type="info">kWh</el-tag>
                          </div>
                        </template>
                        <RealTimeChart type="energy" :data="historyData.single.energy" />
                      </el-card>
                    </el-col>
                  </el-row>

                  <el-row :gutter="20" style="margin-top: 20px;">
                    <el-col :span="12">
                      <el-card class="history-chart-card">
                        <template #header>
                          <div class="chart-header">
                            <span>頻率歷史趨勢</span>
                            <el-tag type="info">Hz</el-tag>
                          </div>
                        </template>
                        <RealTimeChart type="frequency" :data="historyData.single.frequency" />
                      </el-card>
                    </el-col>
                    <el-col :span="12">
                      <el-card class="history-chart-card">
                        <template #header>
                          <div class="chart-header">
                            <span>功率因子歷史趨勢</span>
                            <el-tag type="info">PF</el-tag>
                          </div>
                        </template>
                        <RealTimeChart type="powerFactor" :data="historyData.single.powerFactor" />
                      </el-card>
                    </el-col>
                  </el-row>

                  <el-row :gutter="20" style="margin-top: 20px;">
                    <el-col :span="24">
                      <el-card class="history-chart-card">
                        <template #header>
                          <div class="chart-header">
                            <span>碳排放量歷史趨勢</span>
                            <el-tag type="info">kgCO2e</el-tag>
                          </div>
                        </template>
                        <RealTimeChart type="carbonEmission" :data="historyData.single.carbonEmission" />
                      </el-card>
                    </el-col>
                  </el-row>
                </div>

                <!-- 三相历史数据 -->
                <div v-else class="three-history">
                  <!-- 電壓歷史趨勢 -->
                  <el-row :gutter="20">
                    <el-col :span="12">
                      <el-card class="history-chart-card">
                        <template #header>
                          <div class="chart-header">
                            <span>三相電壓歷史趨勢</span>
                            <el-tag type="warning">V</el-tag>
                          </div>
                        </template>
                        <RealTimeChart type="voltage" :data="historyData.three.voltage" />
                      </el-card>
                    </el-col>
                    <el-col :span="12">
                      <el-card class="history-chart-card">
                        <template #header>
                          <div class="chart-header">
                            <span>三相電流歷史趨勢</span>
                            <el-tag type="warning">A</el-tag>
                          </div>
                        </template>
                        <RealTimeChart type="current" :data="historyData.three.current" />
                      </el-card>
                    </el-col>
                  </el-row>
                  
                  <!-- 功率和用電量歷史趨勢 -->
                  <el-row :gutter="20" style="margin-top: 20px;">
                    <el-col :span="12">
                      <el-card class="history-chart-card">
                        <template #header>
                          <div class="chart-header">
                            <span>三相功率歷史趨勢</span>
                            <el-tag type="warning">W</el-tag>
                          </div>
                        </template>
                        <RealTimeChart type="power" :data="historyData.three.power" />
                      </el-card>
                    </el-col>
                    <el-col :span="12">
                      <el-card class="history-chart-card">
                        <template #header>
                          <div class="chart-header">
                            <span>三相用電量歷史趨勢</span>
                            <el-tag type="warning">kWh</el-tag>
                          </div>
                        </template>
                        <RealTimeChart type="energy" :data="historyData.three.energy" />
                      </el-card>
                    </el-col>
                  </el-row>
                  
                  <!-- 頻率和功率因子歷史趨勢 -->
                  <el-row :gutter="20" style="margin-top: 20px;">
                    <el-col :span="12">
                      <el-card class="history-chart-card">
                        <template #header>
                          <div class="chart-header">
                            <span>三相頻率歷史趨勢</span>
                            <el-tag type="warning">Hz</el-tag>
                          </div>
                        </template>
                        <RealTimeChart type="frequency" :data="historyData.three.frequency" />
                      </el-card>
                    </el-col>
                    <el-col :span="12">
                      <el-card class="history-chart-card">
                        <template #header>
                          <div class="chart-header">
                            <span>三相功率因子歷史趨勢</span>
                            <el-tag type="warning">PF</el-tag>
                          </div>
                        </template>
                        <RealTimeChart type="powerFactor" :data="historyData.three.powerFactor" />
                      </el-card>
                    </el-col>
                  </el-row>

                  <!-- 碳排放量歷史趨勢 -->
                  <el-row :gutter="20" style="margin-top: 20px;">
                    <el-col :span="24">
                      <el-card class="history-chart-card">
                        <template #header>
                          <div class="chart-header">
                            <span>三相碳排放量歷史趨勢</span>
                            <el-tag type="warning">kgCO2e</el-tag>
                          </div>
                        </template>
                        <RealTimeChart type="carbonEmission" :data="historyData.three.carbonEmission" />
                      </el-card>
                    </el-col>
                  </el-row>




                </div>
              </div>
            </el-card>
          </div>

          <!-- 历史资料下载页面 -->
          <div v-else-if="activePage === 'download'" class="page-content">
            <el-card class="download-card">
              <template #header>
                <div class="card-header">
                  <span>歷史資料下載</span>
                  <div class="download-buttons">
                    <el-button type="primary" @click="downloadHistoryData">
                      <el-icon><Download /></el-icon>
                      下載單一數據
                    </el-button>
                    <el-button type="success" @click="downloadCompleteHistoryData">
                      <el-icon><Download /></el-icon>
                      下載完整數據
                    </el-button>
                  </div>
                </div>
              </template>
              
              <div class="download-content">
                <el-row :gutter="20">
                  <el-col :span="12">
                    <el-card class="download-option-card">
                      <template #header>
                        <div class="download-option-header">
                          <span>數據類型選擇</span>
                        </div>
                      </template>
                      <div class="download-options">
                        <el-radio-group v-model="historyDataType" @change="handleHistoryTypeChange">
                          <el-radio label="single">單相數據</el-radio>
                          <el-radio label="three">三相數據</el-radio>
                        </el-radio-group>
                      </div>
                    </el-card>
                  </el-col>
                  
                  <el-col :span="12">
                    <el-card class="download-option-card">
                      <template #header>
                        <div class="download-option-header">
                          <span>監測數值選擇（僅用於單一下載）</span>
                        </div>
                      </template>
                      <div class="download-options">
                        <el-radio-group v-model="historyChartType" @change="handleHistoryChartTypeChange">
                          <el-radio label="voltage">電壓</el-radio>
                          <el-radio label="current">電流</el-radio>
                          <el-radio label="power">功率</el-radio>
                          <el-radio label="energy">用電量</el-radio>
                          <el-radio label="frequency">頻率</el-radio>
                          <el-radio label="powerFactor">功率因子</el-radio>
                          <el-radio label="carbonEmission">碳排放量</el-radio>
                        </el-radio-group>
                      </div>
                    </el-card>
                  </el-col>
                </el-row>
                
                <el-row style="margin-top: 20px;">
                  <el-col :span="24">
                    <el-card class="download-info-card">
                      <template #header>
                        <div class="download-info-header">
                          <span>下載說明</span>
                        </div>
                      </template>
                      <div class="download-info">
                        <el-alert
                          title="單一下載"
                          description="選擇特定的監測數值（如電壓、電流等）進行下載，適合需要分析特定參數的用戶。"
                          type="info"
                          show-icon
                          :closable="false"
                          style="margin-bottom: 15px;"
                        />
                        <el-alert
                          title="完整數據下載"
                          description="下載所選類型（單相或三相）的所有監測數據，包含完整的24小時歷史記錄，適合需要進行全面數據分析的用戶。"
                          type="success"
                          show-icon
                          :closable="false"
                        />
                      </div>
                    </el-card>
                  </el-col>
                </el-row>
              </div>
            </el-card>
          </div>
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<style scoped>
.app-container {
  height: 100vh;
}

.app-header {
  background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
  color: white;
  padding: 0;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100%;
  padding: 0 20px;
}

.app-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-size: 24px;
}

.header-info {
  margin-left: 20px;
}

.header-actions {
  display: flex;
  gap: 10px;
}

/* 教室標籤樣式 */
.classroom-tag {
  font-size: 18px !important;
  font-weight: bold !important;
  padding: 8px 16px !important;
  border-radius: 8px !important;
  background: linear-gradient(135deg, #66bb6a 0%, #4caf50 100%) !important;
  border: 2px solid #2e7d32 !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) !important;
  color: white !important;
}

/* 侧边栏样式 */
.sidebar {
  background-color: #2c3e50;
  border-right: 1px solid #34495e;
}

.sidebar-menu {
  border: none;
  height: 100%;
}

.sidebar-header {
  padding: 20px;
  text-align: center;
  border-bottom: 1px solid #34495e;
}

.sidebar-header h3 {
  color: #ecf0f1;
  margin: 0;
  font-size: 18px;
}

.menu-item {
  margin: 5px 10px;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.menu-item:hover {
  background-color: #34495e !important;
}

.menu-item .el-icon {
  margin-right: 10px;
  font-size: 18px;
}

.app-main {
  background-color: #f8fff8;
  padding: 20px;
  height: calc(100vh - 60px);
  overflow-y: auto;
}

.page-content {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.overview-card,
.monitoring-card,
.chart-card,
.history-card,
.download-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header span {
  font-size: 18px;
  font-weight: 600;
  color: #2c5530;
}

.history-controls {
  display: flex;
  gap: 15px;
  align-items: center;
}

.metric-item {
  text-align: center;
  padding: 20px;
  background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
  border-radius: 10px;
  color: white;
}

.metric-value {
  font-size: 28px;
  font-weight: bold;
  margin-bottom: 5px;
}

.metric-label {
  font-size: 14px;
  opacity: 0.9;
}

.history-content {
  min-height: 400px;
}

.history-chart-card {
  margin-bottom: 20px;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.download-content {
  min-height: 400px;
}

.download-option-card {
  margin-bottom: 20px;
}

.download-option-header {
  font-weight: bold;
}

.download-options {
  padding: 20px 0;
}

.download-buttons {
  display: flex;
  gap: 10px;
}

.download-info-card {
  margin-top: 20px;
}

.download-info-header {
  font-weight: bold;
}

.download-info {
  padding: 10px 0;
}

.chart-controls {
  margin-bottom: 15px;
  padding: 10px 0;
  border-bottom: 1px solid #e8f5e8;
}
</style>
