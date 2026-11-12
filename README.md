# AI電力監測系統

一個基於Vue 3和Element Plus的現代化AI電力監測網頁應用，提供單相和三相電力系統的實時監測功能。專為教室H707設計的智能電力監控解決方案。

## 功能特色

### 🔌 單相電力監測
- 實時電壓、電流、功率監測
- 功率因數計算
- 累計用電量統計
- 運行狀態指示器
- 電壓波動警告

### ⚡ 三相電力監測
- 三相（A/B/C）獨立監測
- 總功率和功率因數計算
- 三相平衡狀態分析
- 相位角顯示
- 不平衡度計算

### 📊 實時數據圖表
- 動態折線圖顯示
- 支持功率、電壓、電流切換
- 平滑動畫效果
- 響應式設計

### 🎨 現代化界面
- 綠色環保主題設計
- 卡片式布局
- 響應式設計
- 動畫效果
- 狀態指示器
- 專為教室H707定制

## 技術棧

- **前端框架**: Vue 3 (Composition API)
- **UI組件庫**: Element Plus
- **圖表庫**: ECharts
- **構建工具**: Vite
- **樣式**: CSS3 + 漸變效果

## 安裝和運行

### 前置要求
- Node.js 16.0 或更高版本
- npm 或 yarn

### 安裝步驟

1. 克隆項目
```bash
git clone <repository-url>
cd my-vue-app
```

2. 安裝依賴
```bash
npm install
```

3. 啟動開發服務器
```bash
npm run dev
```

4. 構建生產版本
```bash
npm run build
```

## 項目結構

```
my-vue-app/
├── server/                # Power API Server（FastAPI，讀 power_monitoring_mqtt）
│   ├── main.py
│   ├── requirements.txt
│   └── .env.example
├── src/
│   ├── components/        # Vue組件
│   ├── services/
│   │   ├── powerApiService.js        # Power API 客戶端（唯一資料來源）
│   │   ├── dataManager.js            # 即時資料輪詢與快取
│   │   └── dataService.js            # 歷史資料
│   ├── App.vue
│   └── main.js
├── vite.config.js         # 含 /api → :8000 proxy
└── SETUP_GUIDE.md         # 設置指南與 API 契約
```

## 組件說明

### SinglePhaseMonitor.vue
單相電力監測組件，顯示：
- 電壓、電流、功率數值
- 功率因數百分比
- 累計用電量進度條
- 運行狀態指示

### ThreePhaseMonitor.vue
三相電力監測組件，包含：
- 三相獨立數據卡片
- 總功率和功率因數
- 三相平衡狀態分析
- 相位角顯示

### RealTimeChart.vue
實時圖表組件，功能：
- 基於ECharts的動態圖表
- 支持多種數據類型切換
- 平滑動畫效果
- 響應式設計

## 數據源配置

資料流：裝置 → MQTT → `get_data/mqtt_to_db.py` → MySQL → `server/`（Power API）→ 前端。
前端不直接連 ThingSpeak；今日增量、每日／每月彙整、碳排放都在後端計算。
詳見 [設置指南](./SETUP_GUIDE.md)。

## 自定義配置

### 數據更新頻率
在環境變量中配置：
```bash
VITE_DATA_UPDATE_INTERVAL=10000  # 10秒更新一次
```

### 添加新的監測參數
1. 在數據結構中添加新字段
2. 在對應組件中顯示
3. 在圖表組件中添加新的圖表類型

## 響應式設計

系統支持多種屏幕尺寸：
- 桌面端：完整功能展示
- 平板端：適配中等屏幕
- 手機端：簡化布局

## 瀏覽器支持

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## 開發指南

### 添加新功能
1. 創建新的Vue組件
2. 在 `App.vue` 中引入
3. 添加相應的路由或標籤頁
4. 更新樣式和數據處理

### 樣式自定義
- 全局樣式：修改 `src/style.css`
- 組件樣式：在組件內使用 `<style scoped>`
- Element Plus主題：參考官方文檔

## 部署

### 靜態部署
```bash
npm run build
# 將 dist/ 目錄部署到Web服務器
```

### Docker部署
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 80
CMD ["npm", "run", "preview"]
```

## 故障排除

### 常見問題

1. **npm install 失敗**
   - 檢查Node.js版本
   - 清除npm緩存：`npm cache clean --force`
   - 刪除 node_modules 重新安裝

2. **圖表不顯示**
   - 檢查ECharts是否正確安裝
   - 確認容器有固定高度
   - 檢查數據格式

3. **樣式問題**
   - 確認Element Plus CSS已引入
   - 檢查瀏覽器兼容性
   - 清除瀏覽器緩存

## 貢獻指南

1. Fork 項目
2. 創建功能分支
3. 提交更改
4. 發起 Pull Request

## 許可證

MIT License

## 聯繫方式

如有問題或建議，請提交 Issue 或聯繫開發團隊。

---

**注意**: 此系統僅用於演示目的，實際電力監測應使用專業的硬件設備和軟件系統。
