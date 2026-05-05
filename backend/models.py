"""
Modelos de Dados — ATS-UMN Presence System
Instituto Politécnico da Huíla (IPH) | Universidade Mandume ya Ndemufayo

UC: Sistemas Embebidos e IoT
Unidade 2-3: Aquisição e Processamento de Dados em Tempo Real
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum


class OccupancyStatus(str, Enum):
    LOW = "low"       # < 40 % — Verde
    MEDIUM = "medium" # 40-75 % — Amarelo
    HIGH = "high"     # 75-99 % — Vermelho
    FULL = "full"     # >= 100 % — Crítico


class ZoneType(str, Enum):
    CLASSROOM = "classroom"
    LABORATORY = "laboratory"
    CAFETERIA = "cafeteria"
    LIBRARY = "library"
    AUDITORIUM = "auditorium"
    OFFICE = "office"


class ZoneReading(BaseModel):
    """Payload enviado pelo simulador (ou futuramente por ESP32/Arduino via HTTP)."""
    zone_id: str
    count: int = Field(ge=0)
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    sensor_id: Optional[str] = None   # ex: "ESP32-A1", "PIR-001"
    temperature: Optional[float] = None  # dado extra de sensor ambiental


class ZoneData(BaseModel):
    """Estado completo de uma zona do campus."""
    id: str
    name: str
    name_short: str
    capacity: int
    zone_type: ZoneType
    building: str
    floor: int = 0
    current_count: int = 0
    status: OccupancyStatus = OccupancyStatus.LOW
    occupancy_percent: float = 0.0
    last_updated: Optional[str] = None


class HistoryEntry(BaseModel):
    """Leitura histórica armazenada em buffer circular (Unidade 3 — Monitorização em Tempo Real)."""
    zone_id: str
    count: int
    occupancy_percent: float
    timestamp: str


class AlertMessage(BaseModel):
    """Alerta gerado automaticamente quando ocupação ultrapassa limiares críticos."""
    id: str
    zone_id: str
    zone_name: str
    message: str
    severity: str   # "info" | "warning" | "danger"
    timestamp: str


class SystemStats(BaseModel):
    total_people: int
    total_capacity: int
    overall_occupancy: float
    full_zones: int
    high_zones: int
    total_zones: int
    active_alerts: int
