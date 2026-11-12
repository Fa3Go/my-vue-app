# AI電力監測系統 - 設置指南

## 架構

```
裝置 → MQTT → get_data/mqtt_to_db.py → MySQL(power_monitoring_mqtt) → server/（Power API, FastAPI） → Vue 前端
```

前端只向 Power API 取資料，不再直接連 ThingSpeak，也不需要任何 API Key。

## 1. 啟動 Power API Server

```bash
cd server
python3 -m venv .venv            # 若缺 ensurepip，可用 --without-pip 後以其他 pip 的 --python 安裝
.venv/bin/pip install -r requirements.txt
cp .env.example .env             # 填入 DB 帳密
.venv/bin/uvicorn main:app --port 8000
```

檢查：`curl localhost:8000/api/test` → `{"status":"ok",...}`；互動式文件：http://localhost:8000/docs

## 2. 啟動前端

```bash
npm install
npm run dev
```

Vite 會把 `/api` proxy 到 `http://127.0.0.1:8000`（可用環境變數 `POWER_API_PROXY` 改）。
部署時若 API 不在同一網域，於建置時設定 `VITE_POWER_API_URL`。

## 前端環境變數（皆可省略）

| 變數 | 預設 | 說明 |
|---|---|---|
| `VITE_POWER_API_URL` | 空（同源 `/api`） | Power API 位址 |
| `VITE_POWER_API_DEVICE_SINGLE` | 1 | 單相 110V 裝置 ID |
| `VITE_POWER_API_DEVICE_SINGLE220` | 2 | 單相 220V 裝置 ID |
| `VITE_POWER_API_DEVICE_THREE` | 3 | 三相 220V 裝置 ID |
| `VITE_POWER_API_SPACE_ID` | 1 | 空間（H707） |
| `VITE_DATA_UPDATE_INTERVAL` | 10000 | 即時資料輪詢間隔（毫秒） |

## API 契約

- 時間一律為 ISO 8601（UTC，結尾 `Z`）；「日／時／月」以 Asia/Taipei 為界。
- `energy_kwh` 為累積電表值；區間用電量由後端逐筆掃描計算（忽略異常跳升、往下掉視為重置）。
- 碳排放 = 用電量 × `CO2E_FACTOR`（預設 0.474 kgCO₂e/kWh），不使用 DB 內的 `co2e_kg`。

| 端點 | 說明 |
|---|---|
| `GET /api/test` | 健康檢查（含 DB） |
| `GET /api/devices` | 裝置清單 |
| `GET /api/latest` | 所有裝置最新有效讀值 ＋ `today_energy_kwh`、`today_co2e_kg` |
| `GET /api/devices/{id}/latest` | 單一裝置同上 |
| `GET /api/devices/{id}/today-energy` / `today-co2e` | 今日用電／碳排 |
| `GET /api/devices/{id}/hourly?date=YYYY-MM-DD` | 該日 24 小時：平均值、每小時增量、`cum_*` 當日累計 |
| `GET /api/devices/{id}/daily-summary?start=&end=` | 每日彙整（含首尾，預設最近 7 天，最多 400 天） |
| `GET /api/devices/{id}/monthly?months=12` | 每月彙整 |
| `GET /api/devices/{id}/measurements?start=&end=&limit=` | 原始量測 |
| `GET /api/spaces/{id}/overview` | 空間內所有裝置最新值與今日合計 |
