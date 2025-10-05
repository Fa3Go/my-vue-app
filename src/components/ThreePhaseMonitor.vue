<template>
  <div class="three-phase-monitor">
    <!-- field1: 電壓 (V) & field2: 電流 (A) -->
    <el-row :gutter="16">
      <el-col :span="12">
        <div class="metric-card">
          <div class="metric-icon">
            <el-icon><Lightning /></el-icon>
          </div>
          <div class="metric-content">
            <div class="metric-value">{{ data.voltage }} V</div>
            <div class="metric-label">電壓</div>
          </div>
        </div>
      </el-col>
      <el-col :span="12">
        <div class="metric-card">
          <div class="metric-icon">
            <el-icon><Connection /></el-icon>
          </div>
          <div class="metric-content">
            <div class="metric-value">{{ data.current }} A</div>
            <div class="metric-label">電流</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- field3: 功率 (W) & field4: 用電量 (kWh) -->
    <el-row :gutter="16" style="margin-top: 16px;">
      <el-col :span="12">
        <div class="metric-card">
          <div class="metric-icon">
            <el-icon><DataBoard /></el-icon>
          </div>
          <div class="metric-content">
            <div class="metric-value">{{ data.power }} W</div>
            <div class="metric-label">功率</div>
          </div>
        </div>
      </el-col>
      <el-col :span="12">
        <div class="metric-card">
          <div class="metric-icon">
            <el-icon><TrendCharts /></el-icon>
          </div>
          <div class="metric-content">
            <div class="metric-value">{{ data.energy }} kWh</div>
            <div class="metric-label">用電量</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- field5: 頻率 (Hz) & field6: 功率因子 (pf) -->
    <el-row :gutter="16" style="margin-top: 16px;">
      <el-col :span="12">
        <div class="metric-card">
          <div class="metric-icon">
            <el-icon><Clock /></el-icon>
          </div>
          <div class="metric-content">
            <div class="metric-value">{{ data.frequency }} Hz</div>
            <div class="metric-label">頻率</div>
          </div>
        </div>
      </el-col>
      <el-col :span="12">
        <div class="metric-card">
          <div class="metric-icon">
            <el-icon><TrendCharts /></el-icon>
          </div>
          <div class="metric-content">
            <div class="metric-value">{{ data.powerFactor.toFixed(2) }} pf</div>
            <div class="metric-label">功率因子</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- field7: 碳排當量 (kgCO₂e) -->
    <el-row style="margin-top: 16px;">
      <el-col :span="24">
        <div class="carbon-card">
          <div class="carbon-content">
            <div class="carbon-icon">
              <el-icon><Sunny /></el-icon>
            </div>
            <div class="carbon-info">
              <div class="carbon-value">{{ data.carbonEmission }} kgCO₂e</div>
              <div class="carbon-label">碳排當量</div>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-row style="margin-top: 16px;">
      <el-col :span="24">
        <div class="status-indicator">
          <el-icon class="status-icon" :class="{ 'status-normal': isNormal }">
            <CircleCheck v-if="isNormal" />
            <Warning v-else />
          </el-icon>
          <span class="status-text">{{ statusText }}</span>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Lightning, Connection, DataBoard, TrendCharts, Clock, Sunny, CircleCheck, Warning } from '@element-plus/icons-vue'

const props = defineProps({
  data: {
    type: Object,
    required: true
  }
})

// 計算系統狀態
const isNormal = computed(() => {
  const voltage = props.data.voltage
  const current = props.data.current
  const power = props.data.power
  
  return voltage >= 200 && voltage <= 240 && 
         current >= 0 && current <= 20 && 
         power >= 0 && power <= 5000
})

const statusText = computed(() => {
  if (isNormal.value) {
    return '三相電力系統運行正常'
  } else {
    return '三相電力系統需要關注'
  }
})
</script>

<style scoped>
.three-phase-monitor {
  padding: 10px;
}

.metric-card {
  display: flex;
  align-items: center;
  padding: 16px;
  background: #f8fff8;
  border-radius: 8px;
  border-left: 4px solid #4CAF50;
}

.metric-icon {
  margin-right: 12px;
  font-size: 24px;
  color: #4CAF50;
}

.metric-content {
  flex: 1;
}

.metric-value {
  font-size: 22px;
  font-weight: bold;
  color: #2c5530;
  margin-bottom: 4px;
}

.metric-label {
  font-size: 14px;
  color: #4CAF50;
}

.carbon-card {
  padding: 20px;
  background: linear-gradient(135deg, #f0fff0 0%, #e8f5e8 100%);
  border-radius: 12px;
  border: 2px solid #4CAF50;
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.1);
}

.carbon-content {
  display: flex;
  align-items: center;
}

.carbon-icon {
  margin-right: 16px;
  font-size: 32px;
  color: #4CAF50;
}

.carbon-info {
  flex: 1;
}

.carbon-value {
  font-size: 28px;
  font-weight: bold;
  color: #2c5530;
  margin-bottom: 4px;
}

.carbon-label {
  font-size: 14px;
  color: #4CAF50;
  font-weight: 500;
}

.status-indicator {
  display: flex;
  align-items: center;
  padding: 12px;
  background: #f6ffed;
  border-radius: 8px;
  border: 1px solid #b7eb8f;
}

.status-icon {
  margin-right: 8px;
  font-size: 18px;
}

.status-icon.status-normal {
  color: #4CAF50;
}

.status-icon:not(.status-normal) {
  color: #ff9800;
}

.status-text {
  font-size: 14px;
  color: #2c5530;
}
</style> 