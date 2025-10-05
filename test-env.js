// 測試環境變數是否被正確讀取
console.log('=== 環境變數測試 ===')
console.log('VITE_THINGSPEAK_API_KEY:', import.meta.env.VITE_THINGSPEAK_API_KEY)
console.log('VITE_THINGSPEAK_CHANNEL_ID:', import.meta.env.VITE_THINGSPEAK_CHANNEL_ID)
console.log('VITE_DATA_UPDATE_INTERVAL:', import.meta.env.VITE_DATA_UPDATE_INTERVAL)
console.log('VITE_ENABLE_THINGSPEAK:', import.meta.env.VITE_ENABLE_THINGSPEAK)
console.log('VITE_ENABLE_MOCK_DATA:', import.meta.env.VITE_ENABLE_MOCK_DATA)

// 檢查所有環境變數
console.log('\n=== 所有環境變數 ===')
console.log(import.meta.env)
