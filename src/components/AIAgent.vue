<template>
  <!-- AI 助手浮動按鈕 -->
  <Teleport to="body">
    <div class="ai-agent-wrapper">
      <!-- 浮動按鈕 -->
      <Transition name="scale">
        <button
          v-if="!isOpen"
          class="ai-float-btn"
          @click="toggleChat"
          aria-label="開啟 AI 助手"
        >
          <svg class="ai-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.48 2 2 6.48 2 12C2 13.89 2.52 15.66 3.42 17.17L2.5 21.5L6.83 20.58C8.34 21.48 10.11 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2Z" fill="currentColor"/>
            <circle cx="8" cy="12" r="1.5" fill="white"/>
            <circle cx="12" cy="12" r="1.5" fill="white"/>
            <circle cx="16" cy="12" r="1.5" fill="white"/>
          </svg>
          <span v-if="hasUnread" class="unread-badge"></span>
        </button>
      </Transition>

      <!-- 聊天視窗 -->
      <Transition name="slide-fade">
        <div v-if="isOpen" class="ai-chat-panel">
          <!-- 頂部導航欄 -->
          <div class="chat-header">
            <div class="header-left">
              <div class="ai-avatar">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor" opacity="0.6"/>
                  <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </div>
              <div class="header-info">
                <h3 class="header-title">AI 電力監測助手</h3>
                <div class="header-status">
                  <span class="status-indicator" :class="{ active: isApiReady }"></span>
                  <span class="status-text">{{ USE_MOCK_RESPONSE ? '離線模式' : '在線' }}</span>
                </div>
              </div>
            </div>
            <div class="header-actions">
              <button class="icon-btn" @click="clearMessages" title="清除對話">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </button>
              <button class="icon-btn" @click="toggleChat" title="關閉">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- 訊息區域 -->
          <div class="chat-messages" ref="messagesContainer">
            <!-- 快速問題按鈕 -->
            <div v-if="messages.length === 0" class="quick-questions">
              <p class="quick-title">常見問題</p>
              <div class="quick-buttons">
                <button
                  v-for="q in quickQuestions"
                  :key="q"
                  class="quick-btn"
                  @click="sendQuickQuestion(q)"
                >
                  {{ q }}
                </button>
              </div>
            </div>

            <!-- 訊息列表 -->
            <div
              v-for="(msg, idx) in messages"
              :key="idx"
              :class="['message', msg.role]"
            >
              <div class="message-avatar">
                <svg v-if="msg.role === 'assistant'" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.2"/>
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor"/>
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.2"/>
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zM12 14c-4 0-8 2-8 4v2h16v-2c0-2-4-4-8-4z" fill="currentColor"/>
                </svg>
              </div>
              <div class="message-bubble">
                <div class="message-text" v-html="formatText(msg.content)"></div>
                <div class="message-time">{{ msg.time }}</div>
              </div>
            </div>

            <!-- 載入中指示器 -->
            <div v-if="isLoading" class="message assistant">
              <div class="message-avatar">
                <svg viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.2"/>
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor"/>
                </svg>
              </div>
              <div class="message-bubble">
                <div class="typing-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          </div>

          <!-- 輸入區域 -->
          <div class="chat-input-area">
            <div class="input-wrapper">
              <input
                v-model="userInput"
                type="text"
                class="chat-input"
                placeholder="輸入問題..."
                @keyup.enter="sendMessage"
                :disabled="isLoading"
              />
              <button
                class="send-btn"
                @click="sendMessage"
                :disabled="!userInput.trim() || isLoading"
              >
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, nextTick, onMounted } from 'vue'

const props = defineProps({
  currentData: {
    type: Object,
    default: () => ({})
  }
})

// State
const isOpen = ref(false)
const isLoading = ref(false)
const userInput = ref('')
const messages = ref([])
const messagesContainer = ref(null)
const hasUnread = ref(false)

// API Configuration
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''
const USE_MOCK_RESPONSE = ref(false)
const isApiReady = ref(true)

const quickQuestions = [
  '三項電力電壓是否正常？',
  '三項電力功率因子如何改善？',
  '三項電力如何節能？',
  '三項電力碳排放分析',
  '三項電力如何降低電費？',
]

// Functions
const toggleChat = () => {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    hasUnread.value = false
    scrollToBottom()
  }
}

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

const formatText = (text) => {
  return text
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/•/g, '<span style="color: #667eea;">•</span>')
}

const clearMessages = () => {
  messages.value = []
  userInput.value = ''
}

const sendQuickQuestion = (question) => {
  userInput.value = question
  sendMessage()
}

const callGeminiAPI = async (question) => {
  if (!GEMINI_API_KEY) {
    throw new Error('API key not found')
  }

  const data = props.currentData
  const contextInfo = `你是一位專業的電力監測 AI 助手。

⚠️ 重要規則：
1. 你只能回答與電力、用電、能源相關的問題
2. 如果用戶問的問題與電力無關，回覆：「抱歉，我只能回答電力相關問題。」
3. 回答必須精確、簡短、直接，控制在 3-5 句話以內
4. 優先提供具體數值和判斷結果，少用冗長解釋
5. 使用簡潔的項目符號，不要過度展開

📊 當前電力監測數據：

**系統總覽：**
• 總功率: ${data.totalPower || 'N/A'} W
• 總用電量: ${data.totalEnergy || 'N/A'} kWh
• 總碳排放: ${data.carbonEmission || 'N/A'} kgCO₂e

**單相電力數據：**
• 電壓: ${data.singlePhase?.voltage || 'N/A'} V
• 電流: ${data.singlePhase?.current || 'N/A'} A
• 功率: ${data.singlePhase?.power || 'N/A'} W
• 用電量: ${data.singlePhase?.energy || 'N/A'} kWh
• 頻率: ${data.singlePhase?.frequency || 'N/A'} Hz
• 功率因子: ${data.singlePhase?.powerFactor ? data.singlePhase.powerFactor.toFixed(2) : 'N/A'}

**三相電力數據：**
• 電壓: ${data.threePhase?.voltage || 'N/A'} V
• 電流: ${data.threePhase?.current || 'N/A'} A
• 功率: ${data.threePhase?.power || 'N/A'} W
• 用電量: ${data.threePhase?.energy || 'N/A'} kWh
• 頻率: ${data.threePhase?.frequency || 'N/A'} Hz
• 功率因子: ${data.threePhase?.powerFactor ? data.threePhase.powerFactor.toFixed(2) : 'N/A'}

用戶問題: ${question}

回答格式要求：
- 第一句直接給出結論或判斷（正常/異常/數值）
- 如果異常，用 2-3 個項目符號列出關鍵建議
- 避免冗長說明和背景知識
- 總字數控制在 100 字以內
- 使用表情符號標記狀態（✅ 正常 / ⚠️ 注意 / ❌ 異常）`

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: contextInfo }] }],
        generationConfig: {
          temperature: 0.7,
          topP: 0.95,
          maxOutputTokens: 256
        }
      })
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    console.error('API Error:', response.status, errorText)
    throw new Error(`API request failed: ${response.status}`)
  }

  const result = await response.json()
  console.log('API Response:', result)

  const aiText = result.candidates?.[0]?.content?.parts?.[0]?.text
  if (!aiText) {
    console.error('No text in response:', JSON.stringify(result))
    throw new Error('無法取得 AI 回應')
  }

  return aiText
}

const getMockResponse = (question) => {
  const data = props.currentData
  const q = question.toLowerCase()

  // 檢查是否為電力相關問題
  const powerKeywords = ['電壓', '電流', '功率', '用電', '電費', '節能', '省電', '碳排', '能源', '功率因子', 'pf', 'voltage', 'current', 'power', 'energy', 'kwh']
  const isPowerRelated = powerKeywords.some(keyword => q.includes(keyword))

  if (!isPowerRelated) {
    return `抱歉，我只能回答電力相關問題。`
  }

  if (q.includes('電壓') || q.includes('voltage')) {
    // 判斷是否詢問三相電壓
    const isThreePhase = q.includes('三相') || q.includes('三項')

    if (isThreePhase && data.threePhase) {
      const v = data.threePhase.voltage || 0
      if (v === 0 || !v) {
        return `⚠️ 三相電壓資訊不足，無法判斷是否正常。請提供各相電壓數據。`
      }
      if (v >= 200 && v <= 240) {
        return `✅ 三相電壓正常：**${v} V**（標準範圍 200-240V）`
      } else if (v > 240) {
        return `⚠️ 三相電壓偏高：**${v} V**\n• 建議使用穩壓器\n• 避免使用精密設備`
      } else {
        return `❌ 三相電壓偏低：**${v} V**\n• 聯繫電力公司檢查\n• 可能影響設備啟動`
      }
    }

    // 單相電壓判斷
    const v = data.singlePhase?.voltage || data.voltage || 0
    if (v === 0 || !v) {
      return `⚠️ 電壓資訊不足，無法判斷是否正常。當前讀數：${v} V`
    }
    if (v >= 200 && v <= 240) {
      return `✅ 電壓正常：**${v} V**（標準範圍 200-240V）`
    } else if (v > 240) {
      return `⚠️ 電壓偏高：**${v} V**\n• 建議使用穩壓器\n• 避免使用精密設備`
    } else {
      return `❌ 電壓偏低：**${v} V**\n• 聯繫電力公司檢查\n• 可能影響設備啟動`
    }
  }

  if (q.includes('功率因子') || q.includes('pf')) {
    const isThreePhase = q.includes('三相') || q.includes('三項')
    const pf = isThreePhase
      ? (data.threePhase?.powerFactor || 0)
      : (data.singlePhase?.powerFactor || data.powerFactor || 0)

    if (pf === 0) {
      return `⚠️ 功率因子資訊不足，無法判斷。`
    }

    const status = pf >= 0.9 ? '✅ 優秀' : pf >= 0.8 ? '⚠️ 尚可' : '❌ 偏低'
    const phaseText = isThreePhase ? '三相' : '單相'
    return `${phaseText}${status}：**${pf.toFixed(2)}**\n建議：${pf < 0.9 ? '使用功率因子校正器、減少電感性負載' : '維持現狀即可'}`
  }

  if (q.includes('節能') || q.includes('降低') || q.includes('省電')) {
    const pf = data.powerFactor || 0
    return `💡 節能建議（當前 ${(data.totalEnergy || data.energy || 0)} kWh）：\n• 提升功率因子至 0.9+（現 ${pf.toFixed(2)}）\n• 關閉閒置設備\n• 避開尖峰時段`
  }

  if (q.includes('碳排')) {
    const carbon = data.carbonEmission || 0
    return `🌍 碳排放：**${carbon} kgCO₂e**\n相當於需種 ${(carbon / 21).toFixed(1)} 棵樹抵消。\n建議提高用電效率、考慮再生能源。`
  }

  if (q.includes('電流') || q.includes('current')) {
    const current = data.current || 0
    if (current < 1) {
      return `⚠️ 電流偏低：**${current} A**\n可能是負載過小或設備未啟動。`
    } else if (current > 15) {
      return `⚠️ 電流偏高：**${current} A**\n注意避免過載，檢查線路容量。`
    } else {
      return `✅ 電流正常：**${current} A**`
    }
  }

  // 電力相關的預設回應
  return `📊 即時數據：

**單相：** 電壓 ${data.singlePhase?.voltage || 'N/A'} V、電流 ${data.singlePhase?.current || 'N/A'} A、功率 ${data.singlePhase?.power || 'N/A'} W

**三相：** 電壓 ${data.threePhase?.voltage || 'N/A'} V、電流 ${data.threePhase?.current || 'N/A'} A、功率 ${data.threePhase?.power || 'N/A'} W

請問需要分析哪項？`
}

const sendMessage = async () => {
  if (!userInput.value.trim() || isLoading.value) return

  const question = userInput.value.trim()

  messages.value.push({
    role: 'user',
    content: question,
    time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
  })

  userInput.value = ''
  isLoading.value = true
  scrollToBottom()

  try {
    let response
    if (USE_MOCK_RESPONSE.value) {
      // 使用離線模式
      console.log('📴 使用離線模式')
      await new Promise(resolve => setTimeout(resolve, 600))
      response = getMockResponse(question)
    } else {
      // 使用真實 Gemini API
      console.log('🌐 呼叫 Gemini API...')
      response = await callGeminiAPI(question)
    }

    messages.value.push({
      role: 'assistant',
      content: response,
      time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
    })

    if (!isOpen.value) {
      hasUnread.value = true
    }

    scrollToBottom()
  } catch (error) {
    console.error('AI Error:', error)

    // 錯誤時使用離線回應
    messages.value.push({
      role: 'assistant',
      content: '抱歉，連接 AI 服務時發生錯誤。讓我用離線模式回答：\n\n' + getMockResponse(question),
      time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
    })
  } finally {
    isLoading.value = false
  }
}

// Check API on mount
onMounted(async () => {
  if (!GEMINI_API_KEY) {
    console.log('🔌 未設置 API 金鑰，使用離線模式')
    USE_MOCK_RESPONSE.value = true
    return
  }

  try {
    console.log('🔍 檢查 Gemini API 連接...')
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'hi' }] }],
          generationConfig: { maxOutputTokens: 10 }
        })
      }
    )

    if (response.ok) {
      console.log('✅ Gemini API 連接成功，使用在線模式')
      USE_MOCK_RESPONSE.value = false
    } else {
      console.warn('⚠️ API 回應異常，使用離線模式')
      USE_MOCK_RESPONSE.value = true
    }
  } catch (error) {
    console.warn('⚠️ 無法連接 API，使用離線模式', error)
    USE_MOCK_RESPONSE.value = true
  }
})
</script>

<style scoped>
.ai-agent-wrapper {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 10000;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* 浮動按鈕 */
.ai-float-btn {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  position: relative;
  color: white;
}

.ai-float-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 30px rgba(102, 126, 234, 0.6);
}

.ai-icon {
  width: 32px;
  height: 32px;
}

.unread-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 12px;
  height: 12px;
  background: #ff4757;
  border-radius: 50%;
  border: 2px solid white;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.1); }
}

/* 聊天面板 */
.ai-chat-panel {
  width: 380px;
  height: 600px;
  max-height: calc(100vh - 100px);
  background: white;
  border-radius: 20px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 頂部欄 */
.chat-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ai-avatar {
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.ai-avatar svg {
  width: 24px;
  height: 24px;
}

.header-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.header-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}

.header-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  opacity: 0.9;
}

.status-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #95a5a6;
}

.status-indicator.active {
  background: #2ecc71;
  box-shadow: 0 0 8px #2ecc71;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.icon-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.icon-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.icon-btn svg {
  width: 18px;
  height: 18px;
}

/* 訊息區域 */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: #f5f7fa;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.chat-messages::-webkit-scrollbar {
  width: 6px;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: #ddd;
  border-radius: 3px;
}

/* 快速問題 */
.quick-questions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.quick-title {
  font-size: 13px;
  font-weight: 600;
  color: #667eea;
  margin: 0;
}

.quick-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.quick-btn {
  padding: 10px 16px;
  background: white;
  border: 1px solid #e1e8ed;
  border-radius: 12px;
  color: #667eea;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.quick-btn:hover {
  background: #f0f4ff;
  border-color: #667eea;
  transform: translateX(4px);
}

/* 訊息氣泡 */
.message {
  display: flex;
  gap: 10px;
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message.user {
  flex-direction: row-reverse;
}

.message-avatar {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.message.assistant .message-avatar {
  color: #667eea;
}

.message.user .message-avatar {
  color: #764ba2;
}

.message-avatar svg {
  width: 36px;
  height: 36px;
}

.message-bubble {
  max-width: 75%;
  padding: 12px 16px;
  border-radius: 16px;
  font-size: 14px;
  line-height: 1.5;
}

.message.assistant .message-bubble {
  background: white;
  color: #2c3e50;
  border-bottom-left-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.message.user .message-bubble {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-bottom-right-radius: 4px;
}

.message-text {
  margin: 0;
}

.message-text :deep(strong) {
  font-weight: 600;
}

.message-time {
  font-size: 11px;
  opacity: 0.6;
  margin-top: 6px;
}

/* 輸入中動畫 */
.typing-dots {
  display: flex;
  gap: 6px;
  padding: 4px 0;
}

.typing-dots span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #667eea;
  animation: bounce 1.4s infinite ease-in-out;
}

.typing-dots span:nth-child(1) { animation-delay: -0.32s; }
.typing-dots span:nth-child(2) { animation-delay: -0.16s; }

@keyframes bounce {
  0%, 80%, 100% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

/* 輸入區域 */
.chat-input-area {
  padding: 16px;
  background: white;
  border-top: 1px solid #e1e8ed;
}

.input-wrapper {
  display: flex;
  gap: 10px;
  align-items: center;
}

.chat-input {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid #e1e8ed;
  border-radius: 12px;
  font-size: 14px;
  outline: none;
  transition: all 0.2s;
}

.chat-input:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.chat-input:disabled {
  background: #f5f7fa;
  cursor: not-allowed;
}

.send-btn {
  width: 40px;
  height: 40px;
  border: none;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.send-btn:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.send-btn svg {
  width: 20px;
  height: 20px;
}

/* 動畫 */
.scale-enter-active, .scale-leave-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.scale-enter-from, .scale-leave-to {
  transform: scale(0);
  opacity: 0;
}

.slide-fade-enter-active {
  transition: all 0.3s ease;
}

.slide-fade-leave-active {
  transition: all 0.2s ease;
}

.slide-fade-enter-from {
  transform: translateY(20px) scale(0.95);
  opacity: 0;
}

.slide-fade-leave-to {
  transform: translateY(10px);
  opacity: 0;
}

/* 響應式 */
@media (max-width: 480px) {
  .ai-chat-panel {
    width: calc(100vw - 40px);
    height: calc(100vh - 120px);
  }
}
</style>
