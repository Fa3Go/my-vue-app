// 單一教室內各設備分區的平面圖配置。
// 教室本身沒有逐迴路（分電盤）監測，因此每個分區依所在位置對應到現有的
// 單相110V／單相220V／三相 其中一組真實迴路讀值（見 ClassroomFloorPlan.vue
// 的 ZONE_SOURCE 對照表），同一迴路的分區會顯示相同數值。
//
// 本配置對應資工系電腦教室平面圖：右側為白板，上方為兩台分離式冷氣（靠左右兩側牆），
// 老師用電腦位於第一排最前端（靠近白板／講台側），面對學生。
// 四排學生電腦桌兩兩成對面對面（第一、二排面對面，第三、四排面對面），
// 對內小走道緊靠，兩組之間則留較大的通道走道。

export const ROOM = { id: 'cs-lab', name: '資工系電腦教室' }

// 教室內各用電分區在平面圖上的座標（SVG 座標系，room 內部相對位置）
export const ZONES = [
  { id: 'ac-left', name: '冷氣 A', x: 60, y: 35, width: 240, height: 42, capacityKw: 3 },
  { id: 'fan', name: '電風扇', x: 490, y: 35, width: 120, height: 42, capacityKw: 0.1 },
  { id: 'ac-right', name: '冷氣 B', x: 800, y: 35, width: 240, height: 42, capacityKw: 3 },
  { id: 'teacher-pc', name: '老師用電腦', x: 900, y: 140, width: 180, height: 110, capacityKw: 0.4 },
  { id: 'row-1', name: '電腦（第一排）', x: 20, y: 140, width: 860, height: 110, capacityKw: 4 },
  { id: 'row-2', name: '電腦（第二排）', x: 20, y: 265, width: 1060, height: 110, capacityKw: 5 },
  { id: 'row-3', name: '電腦（第三排）', x: 20, y: 425, width: 1060, height: 110, capacityKw: 5 },
  { id: 'row-4', name: '電腦（第四排）', x: 20, y: 550, width: 1060, height: 110, capacityKw: 5 },
]

// 面對面成對的電腦排：每一對的兩排螢幕朝向彼此（中間走道）
export const FACING_PAIRS = [
  ['row-1', 'row-2'],
  ['row-3', 'row-4'],
]

export function getStatusLevel(ratio) {
  if (ratio >= 0.95) return 'critical'
  if (ratio >= 0.8) return 'serious'
  if (ratio >= 0.6) return 'warning'
  return 'good'
}

export const STATUS_META = {
  good: { label: '正常', icon: '✓' },
  warning: { label: '注意', icon: '!' },
  serious: { label: '偏高', icon: '▲' },
  critical: { label: '過載風險', icon: '✕' },
}

