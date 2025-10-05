// 配置示例文件
// 请复制此文件内容到项目根目录的 .env.local 文件中

/*
# ThingSpeak API 配置示例
# 复制以下内容到 .env.local 文件并填入您的实际值

# ThingSpeak API 读取密钥
VITE_THINGSPEAK_API_KEY=your_api_key_here

# ThingSpeak 通道 ID
VITE_THINGSPEAK_CHANNEL_ID=your_channel_id_here

# 数据更新间隔（毫秒）
VITE_DATA_UPDATE_INTERVAL=5000

# 是否启用 ThingSpeak 数据源（true/false）
VITE_ENABLE_THINGSPEAK=true

# 是否启用模拟数据作为备用（true/false）
VITE_ENABLE_MOCK_DATA=true
*/

// 配置说明：
// 1. 在项目根目录创建 .env.local 文件
// 2. 将上述配置复制到文件中
// 3. 替换 your_api_key_here 和 your_channel_id_here 为实际值
// 4. 重启开发服务器

// 获取 API 密钥的步骤：
// 1. 登录 https://thingspeak.com/
// 2. 进入您的通道
// 3. 点击 "API Keys" 标签
// 4. 复制 "Read API Key"

// 获取通道 ID 的步骤：
// 1. 在通道页面查看 URL
// 2. 格式：https://thingspeak.com/channels/CHANNEL_ID
// 3. 复制 CHANNEL_ID 部分
