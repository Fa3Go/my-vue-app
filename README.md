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
├── public/                 # 靜態資源
├── src/
│   ├── components/         # Vue組件
│   │   ├── SinglePhaseMonitor.vue    # 單相監測組件
│   │   ├── ThreePhaseMonitor.vue     # 三相監測組件
│   │   └── RealTimeChart.vue         # 實時圖表組件
│   ├── services/          # 服務層
│   │   ├── thingspeak.js             # ThingSpeak API 服務
│   │   └── dataManager.js            # 數據管理服務
│   ├── config/            # 配置文件
│   │   └── thingspeak.config.js      # ThingSpeak 配置
│   ├── assets/            # 資源文件
│   ├── App.vue            # 主應用組件
│   ├── main.js            # 應用入口
│   └── style.css          # 全局樣式
├── index.html             # HTML模板
├── package.json           # 項目配置
├── vite.config.js         # Vite配置
├── THINGSPEAK_SETUP.md    # ThingSpeak 設置指南
└── config.example.js      # 配置示例文件
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

### ThingSpeak API 集成
系統支持從 ThingSpeak 平台獲取實時電力監測數據：

- **自動數據同步**: 支持實時數據獲取
- **智能回退**: 當 API 不可用時自動切換到模擬數據
- **數據緩存**: 減少 API 調用，提升性能
- **字段映射**: 靈活配置數據字段對應關係

詳細設置請參考 [ThingSpeak 設置指南](./THINGSPEAK_SETUP.md)

### 模擬數據（開發模式）
當 ThingSpeak 未配置或不可用時，系統使用模擬數據：
- 每2秒自動更新數據
- 電壓範圍：200-240V
- 電流範圍：10-15A
- 功率範圍：2000-2500W
- 頻率：50-52Hz

## 自定義配置

### ThingSpeak 配置
1. 創建 `.env.local` 文件（參考 `config.example.js`）
2. 配置 API 密鑰和通道 ID
3. 調整數據更新頻率
4. 配置字段映射（在 `src/config/thingspeak.config.js` 中）

### 數據更新頻率
在環境變量中配置：
```bash
VITE_DATA_UPDATE_INTERVAL=5000  # 5秒更新一次
```

### 數據範圍調整
在 `src/config/thingspeak.config.js` 中配置驗證規則：
```javascript
validation: {
  voltage: { min: 0, max: 500, unit: 'V' },
  current: { min: 0, max: 100, unit: 'A' }
}
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
