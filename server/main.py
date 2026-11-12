"""Power API Server：讀取 power_monitoring_mqtt，提供前端電力監控所需資料。

資料流：裝置 → MQTT → get_data/mqtt_to_db.py → MySQL → 本服務 → Vue 前端

API 契約重點：
- 所有時間一律回傳 ISO 8601 並帶時區（UTC，結尾 Z）。DB 的 measured_at 是 UTC。
- 「日」「時」「月」的分界一律以 Asia/Taipei 為準，後端換算成 UTC 範圍再查詢。
- energy_kwh 在 DB 是累積值；區間用電量以「逐筆掃描」計算：
    * 正常的正向增量才累加
    * 超過物理上限（MAX_KW × 經過時數）的跳升視為異常讀值（例如 dev3 的 1334.49 鬼值），忽略
    * 往下掉視為電表重置，從新值重新起算、該筆增量為 0
- co2e 一律以 energy_kwh × CO2E_FACTOR 計算，不使用 DB 內的 co2e_kg（dev3 的係數有誤）。
"""
from __future__ import annotations

import os
from contextlib import contextmanager
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from threading import Lock
from zoneinfo import ZoneInfo

import pymysql
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

load_dotenv(Path(__file__).with_name(".env"))

DB_CONFIG = dict(
    host=os.getenv("DB_HOST", "127.0.0.1"),
    port=int(os.getenv("DB_PORT", "3306")),
    user=os.getenv("DB_USER", ""),
    password=os.getenv("DB_PASSWORD", ""),
    database=os.getenv("DB_NAME", "power_monitoring_mqtt"),
    charset="utf8mb4",
    cursorclass=pymysql.cursors.DictCursor,
    connect_timeout=5,
)
CO2E_FACTOR = float(os.getenv("CO2E_FACTOR", "0.474"))  # kgCO2e / kWh（台灣電力排碳係數）
MAX_KW = float(os.getenv("MAX_KW", "50"))  # 單一裝置合理的最大功率，用來判斷異常跳升
LOCAL_TZ = ZoneInfo(os.getenv("LOCAL_TZ", "Asia/Taipei"))
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]

FIELDS = ("voltage_v", "current_a", "power_w", "frequency_hz", "power_factor")
ROW_COLUMNS = "measured_at, " + ", ".join(FIELDS) + ", energy_kwh"
MAX_RANGE_DAYS = 400

app = FastAPI(title="Power API Server")
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_methods=["GET"], allow_headers=["*"])


# ---------- 工具 ----------

@contextmanager
def db():
    conn = pymysql.connect(**DB_CONFIG)
    try:
        yield conn
    finally:
        conn.close()


def query(conn, sql: str, args=()) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(sql, args)
        return list(cur.fetchall())


def iso_utc(dt: datetime | None) -> str | None:
    """DB 的 naive UTC datetime → ISO 8601（帶 Z）"""
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")


def local_to_utc_naive(dt_local: datetime) -> datetime:
    return dt_local.replace(tzinfo=LOCAL_TZ).astimezone(timezone.utc).replace(tzinfo=None)


def day_bounds_utc(d: date) -> tuple[datetime, datetime]:
    """台灣時間某日 00:00 ~ 隔日 00:00，換算成 naive UTC"""
    start = local_to_utc_naive(datetime.combine(d, time.min))
    end = local_to_utc_naive(datetime.combine(d + timedelta(days=1), time.min))
    return start, end


def today_local() -> date:
    return datetime.now(LOCAL_TZ).date()


def parse_date(s: str | None, default: date) -> date:
    if not s:
        return default
    try:
        return date.fromisoformat(s[:10])
    except ValueError:
        raise HTTPException(400, f"日期格式錯誤：{s}（應為 YYYY-MM-DD）")


def parse_datetime_utc(s: str | None) -> datetime | None:
    """接受 ISO 8601；未帶時區者視為台灣時間。回傳 naive UTC。"""
    if not s:
        return None
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00").replace(" ", "T"))
    except ValueError:
        raise HTTPException(400, f"時間格式錯誤：{s}")
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=LOCAL_TZ)
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


def r2(v: float | None, n: int = 4) -> float | None:
    return None if v is None else round(v, n)


# ---------- 累積電量掃描 ----------

class EnergyScanner:
    """逐筆掃描累積 energy_kwh，算出每筆的「有效增量」並標記異常讀值。"""

    def __init__(self):
        self.last_e: float | None = None
        self.last_t: datetime | None = None

    def feed(self, row: dict) -> tuple[float, bool]:
        """回傳 (此筆增量 kWh, 此筆是否為有效讀值)"""
        e, t = row["energy_kwh"], row["measured_at"]
        if e is None:
            return 0.0, False
        if self.last_e is None:
            self.last_e, self.last_t = e, t
            return 0.0, True
        delta = e - self.last_e
        hours = max((t - self.last_t).total_seconds() / 3600, 1 / 60)
        if delta < 0:
            # 電表重置（或前一個基準是異常值）：從新值重新起算
            self.last_e, self.last_t = e, t
            return 0.0, True
        if delta > MAX_KW * hours + 0.5:
            # 不可能的跳升 → 異常讀值，忽略且不更新基準
            return 0.0, False
        self.last_e, self.last_t = e, t
        return delta, True


def rows_between(conn, device_id: int, start: datetime, end: datetime) -> list[dict]:
    return query(
        conn,
        f"SELECT {ROW_COLUMNS} FROM measurements WHERE device_id=%s AND measured_at>=%s AND measured_at<%s ORDER BY measured_at",
        (device_id, start, end),
    )


def scanner_before(conn, device_id: int, start: datetime) -> EnergyScanner:
    """用區間開始前的最後幾筆建立基準，讓跨日的增量歸到正確的那天"""
    prev = query(
        conn,
        f"SELECT {ROW_COLUMNS} FROM measurements WHERE device_id=%s AND measured_at<%s ORDER BY measured_at DESC LIMIT 20",
        (device_id, start),
    )
    sc = EnergyScanner()
    for row in reversed(prev):
        sc.feed(row)
    return sc


class Bucket:
    def __init__(self):
        self.samples = 0
        self.sums = dict.fromkeys(FIELDS, 0.0)
        self.counts = dict.fromkeys(FIELDS, 0)
        self.energy = 0.0
        self.first_at: datetime | None = None
        self.last_at: datetime | None = None

    def add(self, row: dict, inc: float, valid: bool):
        self.energy += inc
        if not valid:
            return
        self.samples += 1
        for f in FIELDS:
            if row[f] is not None:
                self.sums[f] += row[f]
                self.counts[f] += 1
        t = row["measured_at"]
        self.first_at = self.first_at or t
        self.last_at = t

    def merge(self, other: "Bucket"):
        self.samples += other.samples
        self.energy += other.energy
        for f in FIELDS:
            self.sums[f] += other.sums[f]
            self.counts[f] += other.counts[f]
        if other.first_at and (not self.first_at or other.first_at < self.first_at):
            self.first_at = other.first_at
        if other.last_at and (not self.last_at or other.last_at > self.last_at):
            self.last_at = other.last_at

    def to_dict(self) -> dict:
        out = {"samples": self.samples}
        for f in FIELDS:
            out[f"avg_{f}"] = r2(self.sums[f] / self.counts[f]) if self.counts[f] else None
        out["energy_kwh"] = r2(self.energy)
        out["co2e_kg"] = r2(self.energy * CO2E_FACTOR)
        out["first_measured_at"] = iso_utc(self.first_at)
        out["last_measured_at"] = iso_utc(self.last_at)
        return out


# 已結束的日子結果不會再變，快取起來（key: (device_id, date)）
_day_cache: dict[tuple[int, date], Bucket] = {}
_cache_lock = Lock()


def day_bucket(conn, device_id: int, d: date) -> Bucket:
    cacheable = d < today_local()
    if cacheable:
        with _cache_lock:
            if (device_id, d) in _day_cache:
                return _day_cache[(device_id, d)]
    start, end = day_bounds_utc(d)
    sc = scanner_before(conn, device_id, start)
    b = Bucket()
    for row in rows_between(conn, device_id, start, end):
        b.add(row, *sc.feed(row))
    if cacheable:
        with _cache_lock:
            _day_cache[(device_id, d)] = b
    return b


def get_devices(conn) -> list[dict]:
    return query(
        conn,
        "SELECT device_id, space_id, device_name, phase_type, mqtt_topic, is_active FROM devices ORDER BY device_id",
    )


def require_device(conn, device_id: int) -> dict:
    rows = query(conn, "SELECT device_id, space_id, device_name, phase_type FROM devices WHERE device_id=%s", (device_id,))
    if not rows:
        raise HTTPException(404, f"找不到裝置 {device_id}")
    return rows[0]


def latest_item(conn, device_id: int) -> dict | None:
    """最近一筆「有效」讀值（略過異常鬼值），附上今日用電與碳排"""
    recent = query(
        conn,
        f"SELECT {ROW_COLUMNS} FROM measurements WHERE device_id=%s ORDER BY measured_at DESC LIMIT 30",
        (device_id,),
    )
    if not recent:
        return None
    sc = EnergyScanner()
    last_valid = None
    for row in reversed(recent):
        _, valid = sc.feed(row)
        if valid:
            last_valid = row
    row = last_valid or recent[0]
    today = day_bucket(conn, device_id, today_local())
    item = {"device_id": device_id}
    item.update({f: row[f] for f in FIELDS})
    item["energy_kwh"] = row["energy_kwh"]
    item["co2e_kg"] = r2((row["energy_kwh"] or 0) * CO2E_FACTOR)
    item["measured_at"] = iso_utc(row["measured_at"])
    item["today_energy_kwh"] = r2(today.energy)
    item["today_co2e_kg"] = r2(today.energy * CO2E_FACTOR)
    return item


# ---------- 端點 ----------

@app.get("/api/test")
def api_test():
    try:
        with db() as conn:
            query(conn, "SELECT 1")
        return {"status": "ok", "db": DB_CONFIG["database"], "server_time": iso_utc(datetime.utcnow())}
    except pymysql.MySQLError as e:
        raise HTTPException(503, f"資料庫連線失敗：{e}")


@app.get("/api/devices")
def api_devices():
    with db() as conn:
        return {"status": "ok", "items": get_devices(conn)}


@app.get("/api/latest")
def api_latest_all():
    with db() as conn:
        items = [latest_item(conn, d["device_id"]) for d in get_devices(conn) if d["is_active"]]
    return {"status": "ok", "items": [i for i in items if i]}


@app.get("/api/devices/{device_id}/latest")
def api_latest(device_id: int):
    with db() as conn:
        require_device(conn, device_id)
        item = latest_item(conn, device_id)
    if not item:
        return {"status": "no_data", "item": None}
    return {"status": "ok", "item": item}


@app.get("/api/devices/{device_id}/today-energy")
def api_today_energy(device_id: int):
    with db() as conn:
        require_device(conn, device_id)
        b = day_bucket(conn, device_id, today_local())
    return {"status": "ok", "date": today_local().isoformat(), "today_energy_kwh": r2(b.energy)}


@app.get("/api/devices/{device_id}/today-co2e")
def api_today_co2e(device_id: int):
    with db() as conn:
        require_device(conn, device_id)
        b = day_bucket(conn, device_id, today_local())
    return {
        "status": "ok",
        "date": today_local().isoformat(),
        "today_co2e_kg": r2(b.energy * CO2E_FACTOR),
        "co2e_factor": CO2E_FACTOR,
    }


@app.get("/api/devices/{device_id}/hourly")
def api_hourly(device_id: int, date_: str | None = Query(None, alias="date")):
    """台灣時間某日的 24 小時彙整。energy/co2e 為該小時增量；cum_* 為當日 00:00 起累計。"""
    d = parse_date(date_, today_local())
    with db() as conn:
        require_device(conn, device_id)
        start, end = day_bounds_utc(d)
        sc = scanner_before(conn, device_id, start)
        buckets = [Bucket() for _ in range(24)]
        for row in rows_between(conn, device_id, start, end):
            hour = row["measured_at"].replace(tzinfo=timezone.utc).astimezone(LOCAL_TZ).hour
            buckets[hour].add(row, *sc.feed(row))

    now_utc = datetime.utcnow()
    items, cum = [], 0.0
    for h, b in enumerate(buckets):
        hour_start = local_to_utc_naive(datetime.combine(d, time(h)))
        cum += b.energy
        future = hour_start > now_utc
        item = {"hour": f"{h:02d}:00", "start": iso_utc(hour_start), **b.to_dict()}
        item["cum_energy_kwh"] = None if future else r2(cum)
        item["cum_co2e_kg"] = None if future else r2(cum * CO2E_FACTOR)
        items.append(item)
    return {"status": "ok", "date": d.isoformat(), "items": items}


@app.get("/api/devices/{device_id}/daily-summary")
def api_daily_summary(device_id: int, start: str | None = None, end: str | None = None):
    """台灣時間每日彙整（含首尾日）。預設最近 7 天。沒有資料的日子 samples=0。"""
    end_d = parse_date(end, today_local())
    start_d = parse_date(start, end_d - timedelta(days=6))
    if start_d > end_d:
        raise HTTPException(400, "start 不可晚於 end")
    if (end_d - start_d).days > MAX_RANGE_DAYS:
        raise HTTPException(400, f"查詢範圍最多 {MAX_RANGE_DAYS} 天")
    items = []
    with db() as conn:
        require_device(conn, device_id)
        d = start_d
        while d <= end_d:
            items.append({"date": d.isoformat(), **day_bucket(conn, device_id, d).to_dict()})
            d += timedelta(days=1)
    return {"status": "ok", "items": items}


@app.get("/api/devices/{device_id}/monthly")
def api_monthly(device_id: int, months: int = Query(12, ge=1, le=13)):
    """最近 N 個月（台灣時間，含本月）的每月彙整"""
    today = today_local()
    first = date(today.year, today.month, 1)
    month_starts = []
    for _ in range(months):
        month_starts.append(first)
        first = (first - timedelta(days=1)).replace(day=1)
    month_starts.reverse()

    items = []
    with db() as conn:
        require_device(conn, device_id)
        for ms in month_starts:
            nxt = (ms + timedelta(days=32)).replace(day=1)
            agg = Bucket()
            d = ms
            while d < nxt and d <= today:
                agg.merge(day_bucket(conn, device_id, d))
                d += timedelta(days=1)
            items.append({"month": ms.strftime("%Y-%m"), **agg.to_dict()})
    return {"status": "ok", "items": items}


@app.get("/api/devices/{device_id}/measurements")
def api_measurements(device_id: int, start: str | None = None, end: str | None = None, limit: int = Query(1440, ge=1, le=20000)):
    """原始量測資料。start/end 為 ISO 8601（未帶時區視為台灣時間）；預設最近 24 小時。"""
    end_utc = parse_datetime_utc(end) or datetime.utcnow()
    start_utc = parse_datetime_utc(start) or end_utc - timedelta(days=1)
    with db() as conn:
        require_device(conn, device_id)
        rows = query(
            conn,
            f"SELECT {ROW_COLUMNS} FROM measurements WHERE device_id=%s AND measured_at>=%s AND measured_at<%s ORDER BY measured_at LIMIT %s",
            (device_id, start_utc, end_utc, limit),
        )
    for r in rows:
        r["measured_at"] = iso_utc(r["measured_at"])
        r["co2e_kg"] = r2((r["energy_kwh"] or 0) * CO2E_FACTOR)
    return {"status": "ok", "items": rows}


@app.get("/api/spaces/{space_id}/overview")
def api_space_overview(space_id: int):
    with db() as conn:
        spaces = query(conn, "SELECT space_id, space_name FROM spaces WHERE space_id=%s", (space_id,))
        if not spaces:
            raise HTTPException(404, f"找不到空間 {space_id}")
        devices = [d for d in get_devices(conn) if d["space_id"] == space_id and d["is_active"]]
        for d in devices:
            d["latest"] = latest_item(conn, d["device_id"])
    latest = [d["latest"] for d in devices if d["latest"]]
    return {
        "status": "ok",
        "space": spaces[0],
        "devices": devices,
        "total_power_w": r2(sum(i["power_w"] or 0 for i in latest), 2),
        "today_energy_kwh": r2(sum(i["today_energy_kwh"] or 0 for i in latest)),
        "today_co2e_kg": r2(sum(i["today_co2e_kg"] or 0 for i in latest)),
    }
