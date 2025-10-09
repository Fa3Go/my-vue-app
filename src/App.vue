<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import SinglePhaseMonitor from './components/SinglePhaseMonitor.vue'
import ThreePhaseMonitor from './components/ThreePhaseMonitor.vue'
import RealTimeChart from './components/RealTimeChart.vue'
import AIAgent from './components/AIAgent.vue'
import CarbonEmissionChart from './components/CarbonEmissionChart.vue'
import { Monitor, Refresh, Setting, DataAnalysis, Download, Expand, Fold } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import dataManager from './services/dataManager.js'
import dataService from './services/dataService.js'

// 當前選中的頁面
const activePage = ref('realtime')
const dateRange = ref([])

// 側邊欄收縮狀態
const isCollapsed = ref(false)

// 系統概覽顯示類型
const overviewType = ref('single') // 'single' 或 'three'

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

// 初始化歷史資料（使用真實 API 數據）
const initHistoryData = async () => {
  try {
    console.log('🔄 開始載入歷史資料...')

    // 獲取單相歷史資料
    const singleResult = await dataService.getHistoricalData('single', 100)
    if (singleResult.status === 'success' && singleResult.data) {
      historyData.value.single = singleResult.data
      console.log('✅ 單相歷史資料載入成功')
    } else {
      console.warn('⚠️ 單相歷史資料載入失敗，使用模擬資料')
      loadMockHistoryData('single')
    }

    // 獲取三相歷史資料
    const threeResult = await dataService.getHistoricalData('three', 100)
    if (threeResult.status === 'success' && threeResult.data) {
      historyData.value.three = threeResult.data
      console.log('✅ 三相歷史資料載入成功')
    } else {
      console.warn('⚠️ 三相歷史資料載入失敗，使用模擬資料')
      loadMockHistoryData('three')
    }
  } catch (error) {
    console.error('❌ 載入歷史資料失敗:', error)
    // 載入失敗時使用模擬資料
    loadMockHistoryData('single')
    loadMockHistoryData('three')
  }
}

// 載入模擬歷史資料（作為備用）
const loadMockHistoryData = (type) => {
  const target = type === 'single' ? historyData.value.single : historyData.value.three

  target.voltage = generateHistoryData()
  target.current = generateHistoryData()
  target.power = generateHistoryData()
  target.energy = generateHistoryData()
  target.frequency = generateHistoryData()
  target.powerFactor = generateHistoryData().map(item => ({
    ...item,
    value: (Math.random() * 0.2 + 0.8).toFixed(2)
  }))
  target.carbonEmission = generateHistoryData()
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
      console.log('✅ 使用 ThingSpeak 資料')
      console.log('ThingSpeak 資料:', {
        電壓: systemData.voltage + 'V',
        電流: systemData.current + 'A',
        功率: systemData.power + 'W',
        頻率: systemData.frequency + 'Hz',
        功率因子: systemData.powerFactor + ' pf',
        用電量: systemData.energy + 'kWh',
        碳排放量: systemData.carbonEmission + 'kgCO₂e'
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

// 刷新歷史資料
const refreshHistoryData = async () => {
  let startDate = dateRange.value && dateRange.value[0] ? dateRange.value[0] : null
  let endDate = dateRange.value && dateRange.value[1] ? dateRange.value[1] : null

  // 修正日期時區問題
  if (startDate) {
    startDate = new Date(startDate)
    // 設定為當天的 12:00:00 (中午,確保在當天範圍內)
    startDate.setHours(12, 0, 0, 0)
  }

  if (endDate) {
    endDate = new Date(endDate)
    // 設定為當天的 23:59:59 (本地時間)
    endDate.setHours(23, 59, 59, 999)
  }

  console.log('📅 選擇的日期範圍:', {
    原始開始: dateRange.value?.[0],
    原始結束: dateRange.value?.[1],
    處理後開始: startDate?.toLocaleString('zh-TW'),
    處理後結束: endDate?.toLocaleString('zh-TW'),
    ISO開始: startDate?.toISOString(),
    ISO結束: endDate?.toISOString()
  })

  try {
    ElMessage.info('正在載入歷史資料...')

    // 根據選擇的類型載入資料
    if (historyDataType.value === 'single') {
      const singleResult = await dataService.getHistoricalData('single', 100, startDate, endDate)
      console.log('單相歷史資料結果:', singleResult)

      if (singleResult.status === 'success' && singleResult.data) {
        historyData.value.single = singleResult.data

        // 顯示載入模式資訊
        const mode = singleResult.mode === 'hourly' ? '單日小時數據' : '多日最高數據'
        ElMessage.success(`單相歷史資料載入成功 (${mode})`)
        console.log(`📊 顯示模式: ${mode}`)
      } else if (singleResult.status === 'not_configured') {
        ElMessage.warning('未設定單相 API 金鑰，使用模擬資料')
        loadMockHistoryData('single')
      } else {
        ElMessage.warning(`單相歷史資料載入失敗: ${singleResult.message}`)
        loadMockHistoryData('single')
      }
    } else {
      const threeResult = await dataService.getHistoricalData('three', 100, startDate, endDate)
      console.log('三相歷史資料結果:', threeResult)

      if (threeResult.status === 'success' && threeResult.data) {
        historyData.value.three = threeResult.data

        // 顯示載入模式資訊
        const mode = threeResult.mode === 'hourly' ? '單日小時數據' : '多日最高數據'
        ElMessage.success(`三相歷史資料載入成功 (${mode})`)
        console.log(`📊 顯示模式: ${mode}`)
      } else if (threeResult.status === 'not_configured') {
        ElMessage.warning('未設定三相 API 金鑰，使用模擬資料')
        loadMockHistoryData('three')
      } else {
        ElMessage.warning(`三相歷史資料載入失敗: ${threeResult.message}`)
        loadMockHistoryData('three')
      }
    }
  } catch (error) {
    console.error('載入歷史資料失敗:', error)
    ElMessage.error('載入歷史資料失敗')
    // 發生錯誤時使用模擬資料
    loadMockHistoryData(historyDataType.value)
  }
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
    csvContent += "時間,電壓(V),電流(A),功率(W),用電量(kWh),頻率(Hz),功率因子(pf),碳排放量(kgCO₂e)\n"
    for (let i = 0; i < data.voltage.length; i++) {
      csvContent += `${data.voltage[i].time},${data.voltage[i].value},${data.current[i].value},${data.power[i].value},${data.energy[i].value},${data.frequency[i].value},${data.powerFactor[i].value},${data.carbonEmission[i].value}\n`
    }
  } else {
    // 三相完整資料
    csvContent += "時間,電壓(V),電流(A),功率(W),用電量(kWh),頻率(Hz),功率因子(pf),碳排放量(kgCO₂e)\n"
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

  // 初始化歷史數據（使用 await 確保載入完成）
  await initHistoryData()

  // 更新數據並初始化圖表
  await updateData()

  // 初始化圖表數據（添加初始數據點，避免圖表為空）
  await initChartData()

  // 設置定時更新（每30秒更新一次）
  dataInterval = setInterval(updateData, 30000)
})

// 監聽日期範圍變化
watch(dateRange, (newVal) => {
  if (newVal && newVal.length === 2) {
    refreshHistoryData()
  }
})

// 監聽歷史數據類型變化
watch(historyDataType, () => {
  refreshHistoryData()
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
        <el-aside :width="isCollapsed ? '64px' : '250px'" class="sidebar">
          <!-- 標題欄與收縮按鈕 -->
          <div class="sidebar-top">
            <h3 v-if="!isCollapsed" class="sidebar-title">功能選單</h3>
            <div class="collapse-btn" @click="isCollapsed = !isCollapsed">
              <el-icon>
                <component :is="isCollapsed ? 'Expand' : 'Fold'" />
              </el-icon>
            </div>
          </div>

          <el-menu
            :default-active="activePage"
            class="sidebar-menu"
            :collapse="isCollapsed"
            @select="handlePageChange"
            background-color="#2c3e50"
            text-color="#ecf0f1"
            active-text-color="#4CAF50"
          >

            <el-menu-item index="realtime" class="menu-item">
              <el-icon><Monitor /></el-icon>
              <span>即時監測數據</span>
            </el-menu-item>

            <el-menu-item index="history" class="menu-item">
              <el-icon><Histogram /></el-icon>
              <span>歷史數據分析</span>
            </el-menu-item>

            <el-menu-item index="carbon" class="menu-item">
              <el-icon><DataAnalysis /></el-icon>
              <span>碳排放趨勢</span>
            </el-menu-item>

            <el-menu-item index="download" class="menu-item">
              <el-icon><Download /></el-icon>
              <span>歷史資料下載</span>
            </el-menu-item>
          </el-menu>
        </el-aside>

        <!-- 主要內容區域 -->
        <el-main class="app-main">
          <!-- 實時監測資料頁面 -->
          <div v-if="activePage === 'realtime'" class="page-content">
            <el-row :gutter="20">
              <!-- 系統概覽卡片 -->
              <el-col :span="24">
                <el-card class="overview-card">
                  <template #header>
                    <div class="card-header">
                      <span>系統概覽</span>
                      <div class="overview-controls">
                        <el-radio-group v-model="overviewType" size="small">
                          <el-radio-button label="single">單相</el-radio-button>
                          <el-radio-button label="three">三相</el-radio-button>
                        </el-radio-group>
                        <el-tag type="success">運行正常</el-tag>
                      </div>
                    </div>
                  </template>
                  <el-row :gutter="20">
                    <el-col :span="4">
                      <div class="metric-item">
                        <div class="metric-value">{{ overviewType === 'single' ? singlePhaseData.power : threePhaseData.power }} W</div>
                        <div class="metric-label">功率</div>
                      </div>
                    </el-col>
                    <el-col :span="4">
                      <div class="metric-item">
                        <div class="metric-value">{{ overviewType === 'single' ? singlePhaseData.voltage : threePhaseData.voltage }} V</div>
                        <div class="metric-label">電壓</div>
                      </div>
                    </el-col>
                    <el-col :span="4">
                      <div class="metric-item">
                        <div class="metric-value">{{ overviewType === 'single' ? singlePhaseData.current : threePhaseData.current }} A</div>
                        <div class="metric-label">電流</div>
                      </div>
                    </el-col>
                    <el-col :span="4">
                      <div class="metric-item">
                        <div class="metric-value">{{ overviewType === 'single' ? singlePhaseData.frequency : threePhaseData.frequency }} Hz</div>
                        <div class="metric-label">頻率</div>
                      </div>
                    </el-col>
                    <el-col :span="4">
                      <div class="metric-item">
                        <div class="metric-value">{{ overviewType === 'single' ? singlePhaseData.energy : threePhaseData.energy }} kWh</div>
                        <div class="metric-label">用電量</div>
                      </div>
                    </el-col>
                    <el-col :span="4">
                      <div class="metric-item">
                        <div class="metric-value">{{ overviewType === 'single' ? singlePhaseData.carbonEmission : threePhaseData.carbonEmission }} kgCO₂e</div>
                        <div class="metric-label">碳排放</div>
                      </div>
                    </el-col>
                  </el-row>
                </el-card>
              </el-col>
            </el-row>

            <el-row :gutter="20" style="margin-top: 20px;">
              <!-- 單相電力監測 -->
              <el-col :span="12">
                <el-card class="monitoring-card">
                  <template #header>
                    <div class="card-header">
                      <span>單相220V電力監測</span>
                      <el-tag type="success">即時資料</el-tag>
                    </div>
                  </template>
                  <SinglePhaseMonitor :data="singlePhaseData" />
                </el-card>
              </el-col>

              <!-- 三相電力監測 -->
              <el-col :span="12">
                <el-card class="monitoring-card">
                  <template #header>
                    <div class="card-header">
                      <span>三相電力監測</span>
                      <el-tag type="success">即時資料</el-tag>
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
                      <el-tag type="success">即時資料</el-tag>
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
                      <el-tag type="success">即時資料</el-tag>
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

          <!-- 歷史數據分析 -->
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
                    <el-button type="primary" size="small" @click="refreshHistoryData">
                      <el-icon><Refresh /></el-icon>
                      刷新數據
                    </el-button>
                  </div>
                </div>
              </template>
              
              <div class="history-content">
                <!-- 單相歷史數據 -->
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
                            <el-tag type="info">kgCO₂e</el-tag>
                          </div>
                        </template>
                        <RealTimeChart type="carbonEmission" :data="historyData.single.carbonEmission" />
                      </el-card>
                    </el-col>
                  </el-row>
                </div>

                <!-- 三相歷史數據 -->
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
                            <el-tag type="warning">kgCO₂e</el-tag>
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

          <!-- 碳排放趨勢頁面 -->
          <div v-else-if="activePage === 'carbon'" class="page-content">
            <CarbonEmissionChart />
          </div>

          <!-- 歷史資料下載 -->
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

    <!-- AI 助手 -->
    <AIAgent :current-data="{
      ...systemStatus,
      singlePhase: singlePhaseData,
      threePhase: threePhaseData
    }" />
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

/* 側邊欄樣式 */
.sidebar {
  background-color: #2c3e50;
  border-right: 1px solid #34495e;
  position: relative;
  transition: width 0.3s ease;
}

.sidebar-top {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 15px;
  border-bottom: 1px solid #34495e;
  background-color: rgba(255, 255, 255, 0.05);
}

.sidebar-title {
  color: #ecf0f1;
  margin: 0;
  font-size: 18px;
  flex: 1;
}

.collapse-btn {
  width: 36px;
  height: 36px;
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #ecf0f1;
  transition: all 0.3s;
  flex-shrink: 0;
}

.collapse-btn .el-icon {
  font-size: 18px;
}

.collapse-btn:hover {
  background-color: rgba(255, 255, 255, 0.2);
  color: #4CAF50;
}

.sidebar-menu {
  border: none;
  height: calc(100% - 60px);
  transition: width 0.3s ease;
}

.menu-item {
  margin: 5px 10px;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.menu-item:hover {
  background-color: #34495e !important;
}

.sidebar-menu:not(.el-menu--collapse) .menu-item .el-icon {
  margin-right: 10px;
  font-size: 18px;
}

.sidebar-menu.el-menu--collapse .menu-item {
  margin: 5px 0;
  padding: 0 !important;
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

.overview-controls {
  display: flex;
  gap: 15px;
  align-items: center;
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
