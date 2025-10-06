<template>
  <div class="ai-assistant">
    <!-- AI 助手按鈕 -->
    <el-button
      v-if="!isOpen"
      class="ai-button"
      type="primary"
      circle
      size="large"
      @click="toggleChat"
    >
      <el-icon :size="24"><ChatDotRound /></el-icon>
    </el-button>

    <!-- AI 聊天視窗 -->
    <el-card v-if="isOpen" class="ai-chat-window" shadow="always">
      <template #header>
        <div class="chat-header">
          <div class="header-title">
            <el-icon><ChatDotRound /></el-icon>
            <span>AI 電力監測助手</span>
          </div>
          <el-button
            type="text"
            @click="toggleChat"
            class="close-button"
          >
            <el-icon><Close /></el-icon>
          </el-button>
        </div>
      </template>

      <!-- 聊天訊息區域 -->
      <div class="chat-messages" ref="messagesContainer">
        <div
          v-for="(message, index) in messages"
          :key="index"
          :class="['message', message.role]"
        >
          <div class="message-avatar">
            <el-icon v-if="message.role === 'user'"><User /></el-icon>
            <el-icon v-else><ChatDotRound /></el-icon>
          </div>
          <div class="message-content">
            <div class="message-text">{{ message.content }}</div>
            <div class="message-time">{{ message.time }}</div>
          </div>
        </div>

        <!-- 載入中提示 -->
        <div v-if="isLoading" class="message assistant">
          <div class="message-avatar">
            <el-icon><ChatDotRound /></el-icon>
          </div>
          <div class="message-content">
            <div class="loading-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      </div>

      <!-- 輸入區域 -->
      <div class="chat-input">
        <el-input
          v-model="inputMessage"
          placeholder="詢問關於電力數據的問題..."
          @keyup.enter="sendMessage"
          :disabled="isLoading"
        >
          <template #append>
            <el-button
              type="primary"
              @click="sendMessage"
              :disabled="!inputMessage.trim() || isLoading"
            >
              <el-icon><Promotion /></el-icon>
            </el-button>
          </template>
        </el-input>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, nextTick, watch } from 'vue'
import { ChatDotRound, Close, User, Promotion } from '@element-plus/icons-vue'

const props = defineProps({
  currentData: {
    type: Object,
    default: () => ({})
  }
})

const isOpen = ref(false)
const inputMessage = ref('')
const messages = ref([
  {
    role: 'assistant',
    content: '您好！我是 AI 電力監測助手。我可以幫您分析電力數據、解答用電問題。請問有什麼可以幫您的嗎？',
    time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
  }
])
const isLoading = ref(false)
const messagesContainer = ref(null)

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || 'AIzaSyC5hAzaziS3M3ebl03PcoMN72gcCl4ULu0'

// 可嘗試的模型列表（按優先級排序）
const MODELS_TO_TRY = [
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash',
  'gemini-1.5-pro-latest',
  'gemini-1.5-pro',
  'gemini-pro',
  'gemini-1.0-pro'
]

let currentModelIndex = 0
const getCurrentModelUrl = () => {
  const model = MODELS_TO_TRY[currentModelIndex]
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
}

const toggleChat = () => {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    nextTick(() => {
      scrollToBottom()
    })
  }
}

const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

// API 調用函數（可以重試不同模型）
const callGeminiAPI = async (userMessage) => {
  try {
    // 準備上下文資訊（包含當前電力數據）
    const contextInfo = `你是一位專業的電力監測助手。請根據以下電力監測數據回答用戶的問題：

當前電力監測數據：
- 電壓: ${props.currentData.voltage || 'N/A'} V
- 電流: ${props.currentData.current || 'N/A'} A
- 功率: ${props.currentData.power || 'N/A'} W
- 用電量: ${props.currentData.totalEnergy || props.currentData.energy || 'N/A'} kWh
- 頻率: ${props.currentData.frequency || 'N/A'} Hz
- 功率因子: ${props.currentData.powerFactor || 'N/A'} pf
- 碳排放量: ${props.currentData.carbonEmission || 'N/A'} kgCO₂e

用戶問題: ${userMessage}

請用繁體中文回答，語氣要專業且友善。`

    console.log('🤖 發送請求到 Gemini API...')
    console.log('API Key:', GEMINI_API_KEY ? '已設置' : '未設置')
    console.log('嘗試模型:', MODELS_TO_TRY[currentModelIndex])
    console.log('上下文:', contextInfo)

    // 呼叫 Gemini API（使用動態模型選擇）
    const apiUrl = getCurrentModelUrl()
    const response = await fetch(`${apiUrl}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: contextInfo
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        }
      })
    })

    console.log('📡 API 回應狀態:', response.status, response.statusText)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ API 錯誤詳情:', errorText)

      // 如果是 404 錯誤且還有其他模型可以嘗試
      if (response.status === 404 && currentModelIndex < MODELS_TO_TRY.length - 1) {
        console.log(`⚠️ 模型 ${MODELS_TO_TRY[currentModelIndex]} 不可用，嘗試下一個...`)
        currentModelIndex++
        // 遞迴調用自己（使用下一個模型）
        return await callGeminiAPI(userMessage)
      }

      throw new Error(`API 請求失敗: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log('📦 API 回應數據:', data)

    // 提取 AI 回應
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '抱歉，我無法理解您的問題。請換個方式詢問。'

    console.log('✅ AI 回應:', aiResponse)
    console.log(`✅ 成功使用模型: ${MODELS_TO_TRY[currentModelIndex]}`)

    // 返回 AI 回應
    return aiResponse

  } catch (error) {
    console.error('❌ AI 助手錯誤:', error)
    console.error('錯誤詳情:', error.message)
    throw error
  }
}

// 主要的發送訊息函數
const sendMessage = async () => {
  if (!inputMessage.value.trim() || isLoading.value) return

  const userMessage = inputMessage.value.trim()

  // 添加用戶訊息
  messages.value.push({
    role: 'user',
    content: userMessage,
    time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
  })

  inputMessage.value = ''
  isLoading.value = true

  nextTick(() => {
    scrollToBottom()
  })

  try {
    const aiResponse = await callGeminiAPI(userMessage)

    // 添加 AI 回應
    messages.value.push({
      role: 'assistant',
      content: aiResponse,
      time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
    })
  } catch (error) {
    // 添加友好的錯誤訊息，提供解決方案
    const errorMessage = `😔 AI 助手暫時無法使用

可能的原因：
• API 金鑰無效或過期
• API 配額已用盡
• 網路連接問題

💡 解決方案：
1. 前往 Google AI Studio 獲取新的 API 金鑰
   https://aistudio.google.com/app/apikey
2. 更新 .env.local 文件中的 VITE_GEMINI_API_KEY
3. 重新啟動開發伺服器

如有其他問題，歡迎隨時詢問！`

    messages.value.push({
      role: 'assistant',
      content: errorMessage,
      time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
    })
  } finally {
    isLoading.value = false
    nextTick(() => {
      scrollToBottom()
    })
  }
}

// 監聽訊息變化，自動滾動到底部
watch(() => messages.value.length, () => {
  nextTick(() => {
    scrollToBottom()
  })
})
</script>

<style scoped>
.ai-assistant {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 9999;
}

.ai-button {
  width: 60px;
  height: 60px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  transition: all 0.3s ease;
}

.ai-button:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
}

.ai-chat-window {
  width: 400px;
  height: 600px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  border-radius: 12px;
  overflow: hidden;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #667eea;
}

.close-button {
  padding: 4px;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: #f5f7fa;
  max-height: 450px;
}

.message {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  animation: fadeIn 0.3s ease;
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

.message-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 20px;
}

.message.user .message-avatar {
  background: #667eea;
  color: white;
}

.message.assistant .message-avatar {
  background: #e0e7ff;
  color: #667eea;
}

.message-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.message-text {
  padding: 12px 16px;
  border-radius: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.message.user .message-text {
  background: #667eea;
  color: white;
  border-bottom-right-radius: 4px;
}

.message.assistant .message-text {
  background: white;
  color: #333;
  border-bottom-left-radius: 4px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.message-time {
  font-size: 11px;
  color: #999;
  padding: 0 8px;
}

.loading-dots {
  display: flex;
  gap: 4px;
  padding: 12px 16px;
  background: white;
  border-radius: 12px;
  width: fit-content;
}

.loading-dots span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #667eea;
  animation: bounce 1.4s infinite ease-in-out both;
}

.loading-dots span:nth-child(1) {
  animation-delay: -0.32s;
}

.loading-dots span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes bounce {
  0%, 80%, 100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

.chat-input {
  padding: 16px;
  background: white;
  border-top: 1px solid #e5e7eb;
}

:deep(.el-card__header) {
  padding: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

:deep(.el-card__body) {
  padding: 0;
  display: flex;
  flex-direction: column;
  height: calc(600px - 73px);
}
</style>
