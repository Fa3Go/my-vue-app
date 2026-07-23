<template>
  <div class="floorplan-root">
    <div class="floorplan-header">
      <div class="floorplan-title">
        <h2>{{ ROOM.name }} 俯視圖 — 即時用電狀態</h2>
        <p class="floorplan-subtitle">
          最後更新：{{ lastUpdatedLabel }}（每 5 秒自動刷新；資料取自單相110V／單相220V／三相三組真實迴路，同一迴路的分區數值相同）
        </p>
      </div>
      <div class="legend" role="list" aria-label="用電狀態圖例">
        <div
          v-for="key in statusOrder"
          :key="key"
          class="legend-item"
          role="listitem"
        >
          <span class="legend-swatch" :class="`status-${key}`">{{ STATUS_META[key].icon }}</span>
          <span class="legend-label">{{ STATUS_META[key].label }}</span>
        </div>
      </div>
    </div>

    <div class="floorplan-body">
      <div class="plan-scroll">
        <svg
          class="plan-svg"
          :viewBox="`0 0 ${ROOM_RECT.width + 60} ${ROOM_RECT.height + 60}`"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          :aria-label="`${ROOM.name} 平面圖，顯示各設備分區即時用電狀態`"
        >
          <!-- 教室牆體 -->
          <rect
            :x="ROOM_RECT.x" :y="ROOM_RECT.y" :width="ROOM_RECT.width" :height="ROOM_RECT.height"
            class="room-outline"
          />

          <!-- 白板（裝飾，非用電監測點） -->
          <line
            :x1="whiteboard.x" :y1="whiteboard.y1" :x2="whiteboard.x" :y2="whiteboard.y2"
            class="whiteboard-line"
          />
          <text :x="whiteboard.x" :y="whiteboard.labelY" class="whiteboard-label" text-anchor="middle">白板</text>

          <!-- 各用電分區 -->
          <g
            v-for="zone in zoneRects"
            :key="zone.id"
            class="zone-group"
            :class="[`status-${zone.status}`, { active: selectedZoneId === zone.id }]"
            tabindex="0"
            role="button"
            :aria-label="`${zone.displayName}，${STATUS_META[zone.status].label}，${zone.powerKw} 瓩`"
            @click="selectZone(zone.id)"
            @keydown.enter="selectZone(zone.id)"
            @keydown.space.prevent="selectZone(zone.id)"
          >
            <rect
              :x="zone.x" :y="zone.y" :width="zone.width" :height="zone.height"
              class="zone-rect"
              rx="6"
            />
            <foreignObject :x="zone.x" :y="zone.y" :width="zone.width" :height="zone.height">
              <div xmlns="http://www.w3.org/1999/xhtml" class="zone-content" :class="zone.kind">
                <div class="zone-top">
                  <span class="zone-name">{{ zone.displayName }}</span>
                  <span class="zone-status-icon">{{ STATUS_META[zone.status].icon }}</span>
                </div>
                <div class="zone-power">{{ zone.powerKw }} kW</div>
                <div class="zone-ratio-track">
                  <div class="zone-ratio-fill" :style="{ width: Math.min(100, zone.ratio * 100) + '%' }"></div>
                </div>
              </div>
            </foreignObject>
          </g>

          <!-- 電腦桌／螢幕裝飾（僅視覺，非個別監測點，疊加於分區色塊之上） -->
          <g v-for="(monitor, i) in monitorIcons" :key="i" class="monitor-icon-group">
            <rect
              :x="monitor.x" :y="monitor.y" :width="monitor.width" :height="monitor.height"
              class="monitor-icon"
              rx="2"
            />
          </g>
        </svg>
      </div>

      <el-card class="detail-panel" shadow="never">
        <template v-if="selectedZone">
          <h3 class="detail-title">
            {{ selectedZone.displayName }}
            <span class="detail-status-badge" :class="`status-${selectedZone.status}`">
              {{ STATUS_META[selectedZone.status].icon }} {{ STATUS_META[selectedZone.status].label }}
            </span>
          </h3>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">目前功率</span>
              <span class="detail-value">{{ selectedZone.powerKw }} kW</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">額定容量</span>
              <span class="detail-value">{{ selectedZone.capacityKw }} kW</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">使用率</span>
              <span class="detail-value">{{ Math.round(selectedZone.ratio * 100) }}%</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">電壓</span>
              <span class="detail-value">{{ selectedZone.voltage }} V</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">電流</span>
              <span class="detail-value">{{ selectedZone.current }} A</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">更新時間</span>
              <span class="detail-value">{{ formatTime(selectedZone.updatedAt) }}</span>
            </div>
          </div>
        </template>
        <template v-else>
          <p class="detail-empty">點選任一分區查看詳細用電資訊</p>
        </template>
      </el-card>
    </div>

    <div class="hot-rooms" v-if="hotZones.length">
      <el-icon class="hot-rooms-icon"><WarningFilled /></el-icon>
      <span>目前高用電分區：</span>
      <el-tag
        v-for="zone in hotZones"
        :key="zone.id"
        :class="`tag-status-${zone.status}`"
        class="hot-room-tag"
        @click="selectZone(zone.id)"
      >
        {{ zone.displayName }}（{{ zone.powerKw }} kW）
      </el-tag>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { WarningFilled } from '@element-plus/icons-vue'
import { ROOM, ZONES, FACING_PAIRS, STATUS_META, getStatusLevel } from '../data/mockClassrooms.js'
import dataManager from '../services/dataManager.js'

const statusOrder = ['good', 'warning', 'serious', 'critical']

// 各分區對應到現有的哪一組真實迴路（教室沒有逐迴路監測，因此依位置歸類）
// 冷氣（左右牆面）視為三相迴路；老師用電腦與學生電腦排視為單相220V；電風扇視為單相110V
const ZONE_SOURCE = {
  'ac-left': 'three',
  'ac-right': 'three',
  'fan': 'single',
  'teacher-pc': 'single220',
  'row-1': 'single220',
  'row-2': 'single220',
  'row-3': 'single220',
  'row-4': 'single220',
}

function getSourceData(sourceKey) {
  if (sourceKey === 'three') return dataManager.getThreePhaseData()
  if (sourceKey === 'single220') return dataManager.getSingle220PhaseData()
  return dataManager.getSinglePhaseData()
}

// 依真實迴路讀值組出每個分區的顯示資料
function buildReadings() {
  return ZONES.map((zone) => {
    const source = getSourceData(ZONE_SOURCE[zone.id]) || {}
    const powerKw = +((source.power || 0) / 1000).toFixed(3)
    const ratio = zone.capacityKw > 0 ? Math.min(1.05, powerKw / zone.capacityKw) : 0
    return {
      ...zone,
      ratio,
      powerKw,
      status: getStatusLevel(ratio),
      voltage: source.voltage || 0,
      current: source.current || 0,
      updatedAt: source.timestamp ? new Date(source.timestamp) : new Date(),
    }
  })
}

const zones = ref(buildReadings())
const selectedZoneId = ref(null)
const lastUpdated = ref(new Date())
let timer = null

// 平面圖幾何：教室外框（含四周留白），對應資工系電腦教室配置
const ROOM_RECT = { x: 20, y: 20, width: 1100, height: 660 }

// 白板沿右側牆面裝設，僅作平面圖裝飾用
const whiteboard = { x: 1100, y1: 140, y2: 650, labelY: 122 }

// 面對面成對的排別：對內第一排螢幕靠下（面向走道），第二排螢幕靠上（面向走道）
const facingSide = new Map()
FACING_PAIRS.forEach(([firstId, secondId]) => {
  facingSide.set(firstId, 'bottom')
  facingSide.set(secondId, 'top')
})

// 每排電腦桌以一列小螢幕方塊示意，僅作視覺裝飾，非個別監測點
const monitorIcons = computed(() => {
  const rowZones = ZONES.filter((z) => z.id.startsWith('row'))
  const perRow = 10
  const padding = 24
  const gap = 8
  const cellH = 26
  const icons = []
  rowZones.forEach((zone) => {
    const cellW = (zone.width - padding * 2 - gap * (perRow - 1)) / perRow
    const side = facingSide.get(zone.id) || 'bottom'
    const y = side === 'top' ? zone.y + 16 : zone.y + zone.height - cellH - 16
    for (let c = 0; c < perRow; c++) {
      icons.push({
        x: zone.x + padding + c * (cellW + gap),
        y,
        width: cellW,
        height: cellH,
      })
    }
  })
  return icons
})

const zoneRects = computed(() =>
  zones.value.map((zone) => ({
    ...zone,
    displayName: zone.name.split('\n')[0],
    kind: zone.id.startsWith('ac') || zone.id === 'fan'
      ? 'ac'
      : zone.id.startsWith('row')
        ? `row-${facingSide.get(zone.id) || 'bottom'}`
        : zone.id,
  }))
)

const selectedZone = computed(() => zoneRects.value.find((z) => z.id === selectedZoneId.value) || null)

const hotZones = computed(() =>
  zoneRects.value.filter((z) => z.status === 'serious' || z.status === 'critical')
)

const lastUpdatedLabel = computed(() => formatTime(lastUpdated.value))

function formatTime(date) {
  return new Date(date).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function selectZone(id) {
  selectedZoneId.value = selectedZoneId.value === id ? null : id
}

function refresh() {
  zones.value = buildReadings()
  lastUpdated.value = new Date()
}

onMounted(() => {
  timer = setInterval(refresh, 5000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.floorplan-root {
  --status-good: #0ca30c;
  --status-warning: #fab219;
  --status-serious: #ec835a;
  --status-critical: #d03b3b;
  --surface-1: #fcfcfb;
  --page-plane: #f9f9f7;
  --wall: #52514e;
  --desk-fill: #e1e0d9;
  --text-primary: #0b0b0b;
  --text-secondary: #52514e;
  --text-muted: #898781;
  --border-hairline: rgba(11, 11, 11, 0.1);
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px;
}

@media (prefers-color-scheme: dark) {
  .floorplan-root {
    --status-good: #0ca30c;
    --status-warning: #fab219;
    --status-serious: #ec835a;
    --status-critical: #d03b3b;
    --surface-1: #1a1a19;
    --page-plane: #0d0d0d;
    --wall: #c3c2b7;
    --desk-fill: #2c2c2a;
    --text-primary: #ffffff;
    --text-secondary: #c3c2b7;
    --text-muted: #898781;
    --border-hairline: rgba(255, 255, 255, 0.1);
  }
}

.floorplan-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.floorplan-title h2 {
  margin: 0;
  font-size: 1.25rem;
  color: var(--text-primary);
}

.floorplan-subtitle {
  margin: 4px 0 0;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.legend {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  align-items: center;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.legend-swatch {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  color: #fff;
  font-size: 0.75rem;
  font-weight: 700;
}

.status-good { background: var(--status-good); }
.status-warning { background: var(--status-warning); color: #2b2200; }
.status-serious { background: var(--status-serious); }
.status-critical { background: var(--status-critical); }

.floorplan-body {
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(220px, 1fr);
  gap: 16px;
  align-items: start;
}

.plan-scroll {
  overflow-x: auto;
  background: var(--page-plane);
  border: 1px solid var(--border-hairline);
  border-radius: 12px;
  padding: 10px;
}

.plan-svg {
  width: 100%;
  min-width: 560px;
  height: auto;
  display: block;
  font-family: inherit;
}

.room-outline {
  fill: var(--surface-1);
  stroke: var(--wall);
  stroke-width: 5;
}

.whiteboard-line {
  stroke: var(--wall);
  stroke-width: 4;
}

.whiteboard-label {
  fill: var(--text-secondary);
  font-size: 14px;
  font-weight: 600;
}

.monitor-icon-group {
  pointer-events: none;
}

.monitor-icon {
  fill: var(--desk-fill);
  stroke: var(--wall);
  stroke-opacity: 0.4;
  stroke-width: 1;
}

.zone-group {
  cursor: pointer;
  outline: none;
}

.zone-rect {
  fill: var(--surface-1);
  fill-opacity: 0.85;
  stroke: var(--wall);
  stroke-width: 2;
  transition: filter 0.15s ease;
}

.zone-group:hover .zone-rect {
  filter: brightness(0.97);
}

.zone-group.active .zone-rect {
  stroke: var(--text-primary);
  stroke-width: 3;
}

.zone-group:focus-visible .zone-rect {
  stroke: var(--text-primary);
  stroke-width: 3;
}

.zone-group.status-good .zone-content { border-top: 5px solid var(--status-good); }
.zone-group.status-warning .zone-content { border-top: 5px solid var(--status-warning); }
.zone-group.status-serious .zone-content { border-top: 5px solid var(--status-serious); }
.zone-group.status-critical .zone-content { border-top: 5px solid var(--status-critical); }

.zone-content {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 8px;
  color: var(--text-primary);
  font-family: inherit;
  overflow: hidden;
}

.zone-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 4px;
}

.zone-name {
  font-weight: 600;
  font-size: 0.8rem;
  line-height: 1.2;
  white-space: pre-line;
}

.zone-status-icon {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;
  font-weight: 700;
  color: #fff;
}

.zone-group.status-good .zone-status-icon { background: var(--status-good); }
.zone-group.status-warning .zone-status-icon { background: var(--status-warning); color: #2b2200; }
.zone-group.status-serious .zone-status-icon { background: var(--status-serious); }
.zone-group.status-critical .zone-status-icon { background: var(--status-critical); }

.zone-power {
  font-size: 0.95rem;
  font-weight: 700;
}

.zone-ratio-track {
  height: 5px;
  border-radius: 3px;
  background: var(--border-hairline);
  overflow: hidden;
  margin-top: auto;
}

.zone-group.status-good .zone-ratio-fill { background: var(--status-good); }
.zone-group.status-warning .zone-ratio-fill { background: var(--status-warning); }
.zone-group.status-serious .zone-ratio-fill { background: var(--status-serious); }
.zone-group.status-critical .zone-ratio-fill { background: var(--status-critical); }

.zone-ratio-fill {
  height: 100%;
}

/* 老師用電腦：文字置中堆疊 */
.zone-content.teacher-pc {
  padding: 4px;
  justify-content: center;
  align-items: center;
  text-align: center;
}

.zone-content.teacher-pc .zone-top {
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

/* 冷氣：矮扁的壁掛式機型比例，單行顯示 */
.zone-content.ac {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 2px 10px;
  gap: 6px;
}

.zone-content.ac .zone-top {
  flex: 1;
  min-width: 0;
  gap: 4px;
}

.zone-content.ac .zone-name {
  font-size: 0.75rem;
  white-space: nowrap;
}

.zone-content.ac .zone-power {
  font-size: 0.8rem;
  white-space: nowrap;
}

.zone-content.ac .zone-ratio-track {
  display: none;
}

/* 電腦排（面對面成對）：螢幕圖示靠走道側，文字置於另一側避免重疊 */
.zone-content.row-bottom,
.zone-content.row-top {
  justify-content: flex-start;
}

.zone-content.row-bottom .zone-ratio-track,
.zone-content.row-top .zone-ratio-track {
  display: none;
}

/* 螢幕靠下（面向走道）者，文字維持在頂端 */
.zone-content.row-bottom {
  flex-direction: column;
}

/* 螢幕靠上（面向走道）者，文字改置於底端 */
.zone-content.row-top {
  flex-direction: column-reverse;
}

.detail-panel {
  min-height: 200px;
}

.detail-title {
  margin: 0 0 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1rem;
  color: var(--text-primary);
}

.detail-status-badge {
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 999px;
  color: #fff;
}

.detail-status-badge.status-warning { color: #2b2200; }

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.detail-label {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.detail-value {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
}

.detail-empty {
  color: var(--text-muted);
  font-size: 0.85rem;
}

.hot-rooms {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.hot-rooms-icon {
  color: var(--status-serious);
}

.hot-room-tag {
  cursor: pointer;
  border: none;
  color: #fff;
}

.tag-status-serious { background: var(--status-serious); }
.tag-status-critical { background: var(--status-critical); }

@media (max-width: 768px) {
  .floorplan-body {
    grid-template-columns: 1fr;
  }
}
</style>
