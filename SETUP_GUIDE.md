# AI電力監測系統 - 設置指南

## 環境變數設置

請在專案根目錄創建 `.env.local` 檔案，並設置以下環境變數：

```env
# ThingSpeak API 配置
# 单相电力监测
VITE_THINGSPEAK_API_KEY_SINGLE=your_single_phase_api_key_here
VITE_THINGSPEAK_CHANNEL_ID_SINGLE=your_single_phase_channel_id_here

# 三相电力监测
VITE_THINGSPEAK_API_KEY_THREE=your_three_phase_api_key_here
VITE_THINGSPEAK_CHANNEL_ID_THREE=your_three_phase_channel_id_here
```

## ThingSpeak 數據欄位對應

系統預設以下欄位對應：

- field1: 電壓 (V)
- field2: 電流 (A)
- field3: 功率 (W)
- field4: 用電量 (kWh)
- field5: 頻率 (Hz)
- field6: 功率因子 (pf)
- field7: 碳排放量 (kgCO₂e)

## 安裝依賴

```bash
npm install
```

## 啟動開發服務器

```bash
npm run dev
```

## 功能說明

### 即時數據監測
- 單相電力監測：顯示單相電力數據和即時折線圖
- 三相電力監測：顯示三相電力數據和即時折線圖
- 每分鐘自動更新數據
- 支援手動刷新數據

### 狀態顯示
- **未設定 API**：當環境變數未設置時顯示
- **暫無數據**：當 ThingSpeak 頻道沒有數據時顯示
- **數據獲取成功**：正常顯示數據時顯示
- **數據獲取失敗**：API 調用失敗時顯示

### 圖表功能
- 支援切換不同數據類型（功率、電壓、電流、用電量、頻率、功率因子、碳排放量）
- 使用 Chart.js 繪製即時折線圖
- 顯示最近 10 筆數據的趨勢

## 技術架構

- **前端框架**：Vue 3 + Composition API
- **UI 框架**：Element Plus
- **圖表庫**：Chart.js
- **構建工具**：Vite
- **數據來源**：ThingSpeak API

## 檔案結構

```
src/
├── App.vue                 # 主應用程式
├── components/
│   ├── LineChart.vue       # 折線圖組件
│   ├── SinglePhaseMonitor.vue  # 單相監測組件
│   └── ThreePhaseMonitor.vue   # 三相監測組件
└── services/
    └── dataService.js      # 數據服務
```
