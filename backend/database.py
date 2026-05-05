"""
Base de Dados Supabase (PostgreSQL) — ATS-UMN Presence System
Instituto Politécnico da Huíla (IPH) | Universidade Mandume ya Ndemufayo

Persistência em nuvem: todas as leituras dos sensores, actuadores,
alertas e incidentes são gravados no Supabase (PostgreSQL).

Os dados sobrevivem a reinicios e são acessíveis remotamente.

Projeto Supabase: cantina-previsao
URL: https://pidxcusgbdkgbfmsggww.supabase.co

Unidade 3 — Armazenamento Persistente de Dados IoT em Nuvem
"""

import os
import httpx
from datetime import datetime, timezone
from typing import Optional, Union, List

# ── Configuração Supabase ────────────────────────────────────────────────
SUPABASE_URL     = os.getenv("SUPABASE_URL",     "https://pidxcusgbdkgbfmsggww.supabase.co")
SUPABASE_API_KEY = os.getenv("SUPABASE_API_KEY", "")   # preenchido via .env

_HEADERS = lambda: {
    "apikey":        SUPABASE_API_KEY,
    "Authorization": f"Bearer {SUPABASE_API_KEY}",
    "Content-Type":  "application/json",
    "Prefer":        "return=minimal",
}

# ── Cliente síncrono leve (sem dependências pesadas) ─────────────────────

def _post(table: str, payload: Union[dict, list]) -> bool:
    """Insere um registo ou lista de registos numa tabela Supabase."""
    if not SUPABASE_API_KEY:
        return False          # BD não configurada — ignorar silenciosamente
    try:
        url = f"{SUPABASE_URL}/rest/v1/{table}"
        r   = httpx.post(url, json=payload, headers=_HEADERS(), timeout=4.0)
        return r.status_code in (200, 201)
    except Exception:
        return False


def _get(table: str, params: Optional[dict] = None) -> list:
    """Consulta registos de uma tabela Supabase."""
    if not SUPABASE_API_KEY:
        return []
    try:
        url = f"{SUPABASE_URL}/rest/v1/{table}"
        r   = httpx.get(url, params=params or {}, headers=_HEADERS(), timeout=5.0)
        return r.json() if r.status_code == 200 else []
    except Exception:
        return []


# ── API pública ───────────────────────────────────────────────────────────

def save_reading(zone_id: str, count: int, occupancy_pct: float,
                 env: Optional[dict] = None) -> bool:
    env = env or {}
    return _post("readings", {
        "zone_id":       zone_id,
        "count":         count,
        "occupancy_pct": round(occupancy_pct, 1),
        "temperature":   env.get("temperature"),
        "humidity":      env.get("humidity"),
        "co2_ppm":       env.get("co2_ppm"),
        "noise_db":      env.get("noise_db"),
        "recorded_at":   datetime.now(timezone.utc).isoformat(),
    })


def save_alert(alert: dict) -> bool:
    return _post("alerts", {
        "id":        alert["id"],
        "zone_id":   alert["zone_id"],
        "zone_name": alert.get("zone_name", ""),
        "message":   alert["message"],
        "severity":  alert["severity"],
        "created_at":alert["timestamp"],
    })


def save_incident(incident: dict) -> bool:
    return _post("incidents", {
        "id":            incident["id"],
        "zone_id":       incident["zone_id"],
        "zone_name":     incident.get("zone_name", ""),
        "incident_type": incident.get("incident_type", ""),
        "message":       incident.get("message", ""),
        "severity":      incident.get("severity", "info"),
        "created_at":    incident["timestamp"],
    })


def save_actuator_command(cmd: dict) -> bool:
    return _post("actuator_log", {
        "zone_id":    cmd["zone_id"],
        "actuator":   cmd["actuator"],
        "command":    cmd["command"],
        "reason":     cmd.get("reason", ""),
        "mqtt_topic": cmd.get("topic", ""),
        "sent_at":    cmd["timestamp"],
    })


def get_zone_history(zone_id: str, limit: int = 100) -> list:
    return _get("readings", {
        "zone_id": f"eq.{zone_id}",
        "order":   "recorded_at.desc",
        "limit":   limit,
        "select":  "zone_id,count,occupancy_pct,temperature,co2_ppm,noise_db,recorded_at",
    })


def get_hourly_patterns(zone_id: str) -> list:
    """Padrões horários — útil para gráfico de tendências por hora do dia."""
    return _get("hourly_patterns", {
        "zone_id": f"eq.{zone_id}",
        "order":   "hour.asc",
    })


def get_recent_alerts(limit: int = 20) -> list:
    return _get("alerts", {
        "order": "created_at.desc",
        "limit": limit,
    })


def get_actuator_history(zone_id: Optional[str] = None, limit: int = 30) -> list:
    params: dict = {"order": "sent_at.desc", "limit": limit}
    if zone_id:
        params["zone_id"] = f"eq.{zone_id}"
    return _get("actuator_log", params)


def db_summary() -> dict:
    """Resumo rápido do estado da base de dados."""
    total_readings = _get("readings", {"select": "count", "limit": 1})
    return {
        "backend":      "Supabase PostgreSQL",
        "project":      "cantina-previsao",
        "url":          SUPABASE_URL,
        "configured":   bool(SUPABASE_API_KEY),
    }


def is_configured() -> bool:
    return bool(SUPABASE_API_KEY)
