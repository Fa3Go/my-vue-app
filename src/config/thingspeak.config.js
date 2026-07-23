// ThingSpeak 配置檔案
export const thingSpeakConfig = {
  // API 配置
  api: {
    baseUrl: 'https://api.thingspeak.com',
    // 這些值應該從環境變數獲取
    apiKey: import.meta.env.VITE_THINGSPEAK_API_KEY || '',
    channelId: import.meta.env.VITE_THINGSPEAK_CHANNEL_ID || '',
    updateInterval: parseInt(import.meta.env.VITE_DATA_UPDATE_INTERVAL) || 5000,
    enableThingSpeak: import.meta.env.VITE_ENABLE_THINGSPEAK === 'true',
    enableMockData: import.meta.env.VITE_ENABLE_MOCK_DATA !== 'false'
  },

  // 資料欄位映射配置
  // 根據您的 ThingSpeak 通道欄位設定進行配置
  fieldMapping: {
    // 單向電力資料欄位映射
    singlePhase: {
      voltage: 'field1',      // 電壓 (V)
      current: 'field2',      // 電流 (A)
      power: 'field3',        // 功率 (W)
      energy: 'field4',       // 用電量 (kWh)
      frequency: 'field5',    // 頻率 (Hz)
      powerFactor: 'field6',  // 功率因子 (pf)
      carbonEmission: 'field7' // 碳排放量 (kgCO2e)
    },

    // 三相電力資料欄位映射（合併資料）
    threePhase: {
      voltage: 'field8',          // 三相電壓 (V)
      current: 'field9',          // 三相電流 (A)
      power: 'field10',           // 三相功率 (W)
      energy: 'field11',          // 三相用電量 (kWh)
      frequency: 'field12',       // 三相頻率 (Hz)
      powerFactor: 'field13',     // 三相功率因子 (pf)
      carbonEmission: 'field14'   // 三相碳排放量 (kgCO2e)
    },

    // 單相 220V 資料欄位映射（獨立頻道，欄位順序與單相110V相同）
    single220: {
      voltage: 'field1',      // 電壓 (V)
      current: 'field2',      // 電流 (A)
      power: 'field3',        // 功率 (W)
      energy: 'field4',       // 用電量 (kWh)
      frequency: 'field5',    // 頻率 (Hz)
      powerFactor: 'field6',  // 功率因子 (pf)
      carbonEmission: 'field7' // 碳排放量 (kgCO2e)
    },

    // 系統狀態欄位映射
    systemStatus: {
      totalPower: 'field33',      // 系統總功率 (W)
      averageVoltage: 'field34',  // 平均電壓 (V)
      averageCurrent: 'field35',  // 平均電流 (A)
      frequency: 'field36',       // 系統頻率 (Hz)
      totalEnergy: 'field37',     // 系統總用電量 (kWh)
      powerFactor: 'field38',     // 系統功率因子 (pf)
      carbonEmission: 'field39'   // 系統碳排放量 (kgCO2e)
    }
  },

  // 資料驗證規則
  validation: {
    voltage: {
      min: 0,
      max: 500,
      unit: 'V'
    },
    current: {
      min: 0,
      max: 100,
      unit: 'A'
    },
    power: {
      min: 0,
      max: 50000,
      unit: 'W'
    },
    energy: {
      min: 0,
      max: 1000000,
      unit: 'kWh'
    },
    frequency: {
      min: 45,
      max: 65,
      unit: 'Hz'
    },
    powerFactor: {
      min: 0,
      max: 1,
      unit: 'pf'
    },
    carbonEmission: {
      min: 0,
      max: 1000,
      unit: 'kgCO2e'
    }
  },

  // 錯誤處理和重試配置
  errorHandling: {
    maxRetries: 3,
    retryDelay: 1000,
    timeout: 10000,
    fallbackToMock: true
  },

  // 資料快取配置
  cache: {
    enabled: true,
    ttl: 30000, // 30秒
    maxSize: 100
  }
}

// 獲取配置值的輔助函數
export const getConfig = (key) => {
  const keys = key.split('.')
  let value = thingSpeakConfig
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k]
    } else {
      return undefined
    }
  }
  
  return value
}

// 檢查配置是否完整
export const validateConfig = () => {
  const requiredFields = [
    'api.apiKey',
    'api.channelId'
  ]

  const missingFields = requiredFields.filter(field => !getConfig(field))

  if (missingFields.length > 0) {
    console.warn('ThingSpeak 配置不完整，缺少以下欄位:', missingFields)
    return false
  }

  return true
}

// 獲取欄位映射
export const getFieldMapping = (type) => {
  return thingSpeakConfig.fieldMapping[type] || {}
}

// 獲取驗證規則
export const getValidationRule = (field) => {
  return thingSpeakConfig.validation[field] || null
}
