# ThingSpeak API 集成设置指南

## 概述

本项目已集成 ThingSpeak API 支持，可以从 ThingSpeak 平台获取实时电力监测数据。当 ThingSpeak 不可用时，系统会自动回退到模拟数据。

## 前置要求

1. 拥有 ThingSpeak 账户
2. 已创建数据收集通道
3. 获取 API 读取密钥

## 配置步骤

### 1. 创建环境配置文件

在项目根目录创建 `.env.local` 文件：

```bash
# ThingSpeak API 配置
VITE_THINGSPEAK_API_KEY=your_api_key_here
VITE_THINGSPEAK_CHANNEL_ID=your_channel_id_here

# 数据更新间隔（毫秒）
VITE_DATA_UPDATE_INTERVAL=5000

# 是否启用 ThingSpeak 数据源
VITE_ENABLE_THINGSPEAK=true

# 是否启用模拟数据作为备用
VITE_ENABLE_MOCK_DATA=true
```

### 2. 获取 ThingSpeak 配置信息

#### 获取 API 密钥：
1. 登录 [ThingSpeak](https://thingspeak.com/)
2. 进入您的通道
3. 点击 "API Keys" 标签
4. 复制 "Read API Key"

#### 获取通道 ID：
1. 在通道页面查看 URL
2. 格式：`https://thingspeak.com/channels/CHANNEL_ID`
3. 复制 `CHANNEL_ID` 部分

### 3. 配置通道字段映射

根据您的 ThingSpeak 通道字段设置，修改 `src/config/thingspeak.config.js` 中的字段映射：

```javascript
fieldMapping: {
  // 单向电力数据字段映射
  singlePhase: {
    voltage: 'field1',      // 电压 (V)
    current: 'field2',      // 电流 (A)
    power: 'field3',        // 功率 (W)
    powerFactor: 'field4',  // 功率因数
    energy: 'field5',       // 能量 (Wh)
    frequency: 'field6'     // 频率 (Hz)
  },
  
  // 三相电力数据字段映射
  threePhase: {
    // Phase A
    phaseAVoltage: 'field7',
    phaseACurrent: 'field8',
    phaseAPower: 'field9',
    
    // Phase B
    phaseBVoltage: 'field10',
    phaseBCurrent: 'field11',
    phaseBPower: 'field12',
    
    // Phase C
    phaseCVoltage: 'field13',
    phaseCCurrent: 'field14',
    phaseCPower: 'field15',
    
    // 总功率和功率因数
    totalPower: 'field16',
    powerFactor: 'field17'
  }
}
```

## 数据字段建议

### 单向电力监测（推荐字段 1-7）
- **Field 1**: 电压 (V)
- **Field 2**: 电流 (A)
- **Field 3**: 功率 (W)
- **Field 4**: 用電量 (kWh)
- **Field 5**: 频率 (Hz)
- **Field 6**: 功率因子 (pf)
- **Field 7**: 碳排放量 (kgCO2e)

### 三相电力监测（推荐字段 8-14） - 合併數據
- **Field 8**: 三相電壓 (V)
- **Field 9**: 三相電流 (A)
- **Field 10**: 三相功率 (W)
- **Field 11**: 三相用電量 (kWh)
- **Field 12**: 三相頻率 (Hz)
- **Field 13**: 三相功率因子 (pf)
- **Field 14**: 三相碳排放量 (kgCO2e)

**注意**: 三相電流感測器已在內部處理三相合併或平均，因此只需要7個字段來存儲三相合併數據。

## 功能特性

### 自动回退机制
- 当 ThingSpeak API 不可用时，自动切换到模拟数据
- 支持手动刷新和自动定时更新
- 数据缓存机制，减少 API 调用

### 数据验证
- 自动验证数据范围
- 支持自定义验证规则
- 错误处理和重试机制

### 实时监控
- 连接状态监控
- 数据更新时间显示
- 支持多种数据源切换

## 使用方法

### 在组件中使用

```javascript
import dataManager from '@/services/dataManager.js'

// 获取单向数据
const singlePhaseData = dataManager.getSinglePhaseData()

// 获取三相数据
const threePhaseData = dataManager.getThreePhaseData()

// 获取系统状态
const systemStatus = dataManager.getSystemStatus()

// 获取历史数据
const historyData = await dataManager.getHistoricalData('single', 'voltage', 100)

// 手动刷新数据
await dataManager.refreshData()

// 获取连接状态
const status = dataManager.getConnectionStatus()
```

### 监听数据变化

```javascript
import { watch } from 'vue'
import dataManager from '@/services/dataManager.js'

// 监听数据变化
watch(() => dataManager.getSinglePhaseData(), (newData) => {
  if (newData) {
    console.log('单向数据已更新:', newData)
  }
})
```

## 故障排除

### 常见问题

1. **API 密钥无效**
   - 检查 `.env.local` 文件中的 API 密钥
   - 确认密钥具有读取权限

2. **通道 ID 错误**
   - 验证通道 ID 是否正确
   - 确认通道是公开的或您的账户有访问权限

3. **数据字段不匹配**
   - 检查 `thingspeak.config.js` 中的字段映射
   - 确认 ThingSpeak 通道中的字段编号

4. **连接超时**
   - 检查网络连接
   - 调整 `VITE_DATA_UPDATE_INTERVAL` 值

### 调试模式

在浏览器控制台中查看详细日志：

```javascript
// 检查配置
console.log('ThingSpeak 配置:', import.meta.env)

// 检查连接状态
console.log('连接状态:', dataManager.getConnectionStatus())

// 检查缓存数据
console.log('缓存数据:', dataManager.cache)
```

## 性能优化

### 缓存策略
- 数据缓存 TTL: 30秒
- 最大缓存条目: 100
- 支持自定义缓存配置

### API 调用优化
- 批量获取字段数据
- 智能重试机制
- 错误回退策略

## 安全注意事项

1. **API 密钥保护**
   - 不要将 `.env.local` 文件提交到版本控制
   - 在生产环境中使用环境变量

2. **访问控制**
   - 使用只读 API 密钥
   - 定期轮换 API 密钥

3. **数据验证**
   - 验证所有输入数据
   - 实施适当的错误处理

## 更新日志

- **v1.0.0**: 初始 ThingSpeak API 集成
- 支持单向和三相电力数据
- 自动回退到模拟数据
- 数据缓存和验证机制

## 技术支持

如果遇到问题，请检查：
1. 网络连接状态
2. ThingSpeak 服务状态
3. 配置参数正确性
4. 浏览器控制台错误信息

更多信息请参考 [ThingSpeak API 文档](https://www.mathworks.com/help/thingspeak/rest-api.html)。
