"""
Armazenamento em Memória — ATS-UMN Presence System v2.0
Instituto Politécnico da Huíla (IPH) | Universidade Mandume ya Ndemufayo

Monitorizamos agora múltiplas entidades:
  • Pessoas     — salas, laboratórios, biblioteca, refeitório, secretaria
  • Veículos    — parques de estacionamento
  • Animais     — exterior do campus (cães/gatos vadios — realidade dos campus angolanos)
  • Equipamentos— computadores activos nos laboratórios (proxy de utilização)
"""

import uuid, threading
from dataclasses import dataclass, field
from typing import Dict, Optional, List, Union
from collections import deque, defaultdict
from datetime import datetime


# ---------------------------------------------------------------------------
# Modelos
# ---------------------------------------------------------------------------

@dataclass
class Zone:
    id: str
    name: str
    name_short: str
    capacity: int
    zone_type: str
    building: str
    floor: int         = 0
    entity_type: str   = "person"    # person | vehicle | animal | equipment
    entity_label: str  = "pessoas"   # label plural para a UI
    current_count: int = 0
    status: str        = "low"
    occupancy_percent: float = 0.0
    last_updated: Optional[str] = None
    # Ambiente (preenchido pelo simulador / sensor real)
    temperature:  Optional[float] = None
    humidity:     Optional[float] = None
    co2_ppm:      Optional[int]   = None
    noise_db:     Optional[float] = None
    aqi_label:    Optional[str]   = None
    aqi_color:    Optional[str]   = None
    env_alerts:   List[str]       = field(default_factory=list)


def zone_to_dict(z: Zone) -> dict:
    return {
        "id": z.id, "name": z.name, "name_short": z.name_short,
        "capacity": z.capacity, "zone_type": z.zone_type, "building": z.building,
        "floor": z.floor, "entity_type": z.entity_type, "entity_label": z.entity_label,
        "current_count": z.current_count, "status": z.status,
        "occupancy_percent": z.occupancy_percent, "last_updated": z.last_updated,
        "temperature": z.temperature, "humidity": z.humidity,
        "co2_ppm": z.co2_ppm, "noise_db": z.noise_db,
        "aqi_label": z.aqi_label, "aqi_color": z.aqi_color,
        "env_alerts": z.env_alerts,
    }


# ---------------------------------------------------------------------------
# Zonas do campus IPH — todas as entidades monitorizadas
# ---------------------------------------------------------------------------

ZONES: Dict[str, Zone] = {
    # ── Pessoas ──────────────────────────────────────────────────────────
    "cafeteria":   Zone(id="cafeteria",   name="Refeitório Central",       name_short="Refeitório",
                        capacity=180,  zone_type="cafeteria",   building="Edifício de Apoio"),
    "sala_14":     Zone(id="sala_14",     name="Sala 1.4 — Eng. Informática", name_short="Sala 1.4",
                        capacity=40,   zone_type="classroom",   building="Bloco A", floor=1),
    "sala_15":     Zone(id="sala_15",     name="Sala 1.5 — Computação",    name_short="Sala 1.5",
                        capacity=40,   zone_type="classroom",   building="Bloco A", floor=1),
    "sala_21":     Zone(id="sala_21",     name="Sala 2.1 — Eng. Civil",    name_short="Sala 2.1",
                        capacity=45,   zone_type="classroom",   building="Bloco A", floor=2),
    "sala_23":     Zone(id="sala_23",     name="Sala 2.3 — Eng. Mecânica", name_short="Sala 2.3",
                        capacity=35,   zone_type="classroom",   building="Bloco B", floor=2),
    "lab_info_1":  Zone(id="lab_info_1",  name="Lab. Informática I",       name_short="Lab. Info I",
                        capacity=30,   zone_type="laboratory",  building="Bloco C", floor=1),
    "lab_info_2":  Zone(id="lab_info_2",  name="Lab. Informática II",      name_short="Lab. Info II",
                        capacity=30,   zone_type="laboratory",  building="Bloco C", floor=1),
    "biblioteca":  Zone(id="biblioteca",  name="Biblioteca Central",        name_short="Biblioteca",
                        capacity=100,  zone_type="library",     building="Edifício da Biblioteca"),
    "auditorio":   Zone(id="auditorio",   name="Auditório Principal",       name_short="Auditório",
                        capacity=300,  zone_type="auditorium",  building="Edifício Central"),
    "secretaria":  Zone(id="secretaria",  name="Secretaria Académica",      name_short="Secretaria",
                        capacity=15,   zone_type="office",      building="Edifício Administrativo"),

    # ── Veículos — Estacionamento ─────────────────────────────────────
    "parque_a":    Zone(id="parque_a",    name="Parque de Estacionamento A", name_short="Parque A",
                        capacity=50,   zone_type="parking",     building="Entrada Principal",
                        entity_type="vehicle", entity_label="veículos"),
    "parque_b":    Zone(id="parque_b",    name="Parque de Estacionamento B", name_short="Parque B",
                        capacity=30,   zone_type="parking",     building="Bloco C / Labs",
                        entity_type="vehicle", entity_label="veículos"),

    # ── Animais — Exterior do Campus ──────────────────────────────────
    "campus_norte":Zone(id="campus_norte",name="Exterior Norte do Campus",  name_short="Exterior Norte",
                        capacity=20,   zone_type="outdoor",     building="Campus Exterior",
                        entity_type="animal", entity_label="animais detectados"),
    "campus_sul":  Zone(id="campus_sul",  name="Área Verde Sul",            name_short="Área Verde Sul",
                        capacity=15,   zone_type="outdoor",     building="Campus Exterior",
                        entity_type="animal", entity_label="animais detectados"),

    # ── Equipamentos — Computadores activos nos Labs ──────────────────
    "lab_equip_1": Zone(id="lab_equip_1", name="Computadores Activos — Lab I",  name_short="PC Lab I",
                        capacity=30,   zone_type="equipment",   building="Bloco C", floor=1,
                        entity_type="equipment", entity_label="PCs ligados"),
    "lab_equip_2": Zone(id="lab_equip_2", name="Computadores Activos — Lab II", name_short="PC Lab II",
                        capacity=30,   zone_type="equipment",   building="Bloco C", floor=1,
                        entity_type="equipment", entity_label="PCs ligados"),
}

# Buffer circular: últimas 120 leituras por zona (cache rápida em memória)
HISTORY: Dict[str, deque] = defaultdict(lambda: deque(maxlen=120))
ALERTS:  deque = deque(maxlen=50)
INCIDENTS: deque = deque(maxlen=30)

# Importar módulos de persistência e actuadores (lazy para evitar ciclos)
def _get_db():
    import database
    return database

def _get_actuators():
    import actuators
    return actuators

# Thread pool para operações de BD em background (não bloquear a API)
_db_executor = None
def _save_async(fn, *args):
    """Grava na BD em thread separada para não bloquear o endpoint."""
    import threading
    threading.Thread(target=fn, args=args, daemon=True).start()


# ---------------------------------------------------------------------------
# Classificação de estado (funciona para qualquer entidade)
# ---------------------------------------------------------------------------

def _compute_status(count: int, capacity: int) -> tuple:
    pct = (count / capacity * 100) if capacity > 0 else 0.0
    if   pct >= 100: return "full",   min(pct, 100.0)
    elif pct >= 75:  return "high",   pct
    elif pct >= 40:  return "medium", pct
    return "low", pct


# ---------------------------------------------------------------------------
# Qualidade do ar — AQI simplificado baseado em CO₂
# ---------------------------------------------------------------------------

def _aqi_from_co2(co2: int) -> tuple:
    if   co2 < 600:  return "Excelente",  "emerald"
    elif co2 < 800:  return "Boa",        "green"
    elif co2 < 1000: return "Moderada",   "yellow"
    elif co2 < 1500: return "Má",         "orange"
    return "Crítica", "red"


# ---------------------------------------------------------------------------
# Actualizar zona com leitura de sensor
# ---------------------------------------------------------------------------

def update_zone(zone_id: str, count: int, env: Optional[dict] = None):
    zone = ZONES.get(zone_id)
    if not zone:
        return None

    safe_count  = max(0, min(count, zone.capacity))
    prev_status = zone.status
    new_status, pct = _compute_status(safe_count, zone.capacity)
    ts = datetime.utcnow().isoformat()

    zone.current_count     = safe_count
    zone.status            = new_status
    zone.occupancy_percent = round(pct, 1)
    zone.last_updated      = ts

    # Dados ambientais opcionais
    zone.env_alerts = []
    if env:
        zone.temperature = env.get("temperature")
        zone.humidity    = env.get("humidity")
        zone.co2_ppm     = env.get("co2_ppm")
        zone.noise_db    = env.get("noise_db")

        if zone.co2_ppm:
            zone.aqi_label, zone.aqi_color = _aqi_from_co2(zone.co2_ppm)
            if zone.co2_ppm > 1200:
                zone.env_alerts.append(f"CO₂ elevado ({zone.co2_ppm} ppm) — ventilação necessária")
        if zone.temperature and zone.temperature > 30:
            zone.env_alerts.append(f"Temperatura elevada ({zone.temperature:.1f}°C)")
        if zone.noise_db and zone.zone_type == "library" and zone.noise_db > 52:
            zone.env_alerts.append(f"Ruído elevado na Biblioteca ({zone.noise_db:.0f} dB)")

    HISTORY[zone_id].append({
        "zone_id": zone_id, "count": safe_count,
        "occupancy_percent": round(pct, 1), "timestamp": ts,
        "temperature": zone.temperature, "co2_ppm": zone.co2_ppm, "noise_db": zone.noise_db,
    })

    # ── Persistir leitura no Supabase (background) ───────────────────────
    _save_async(_get_db().save_reading, zone_id, safe_count, round(pct, 1), env)

    # ── Decidir actuadores ────────────────────────────────────────────────
    actuator_cmds = _get_actuators().decide(
        zone_id, zone.zone_type, zone.entity_type,
        new_status, round(pct, 1), safe_count, zone.capacity, env,
    )
    for cmd in actuator_cmds:
        _save_async(_get_db().save_actuator_command, cmd)

    # ── Alertas de presença ──────────────────────────────────────────────
    alert = None

    if new_status == "full" and prev_status != "full":
        msg = (f"🔴 {zone.name} atingiu capacidade máxima! ({safe_count}/{zone.capacity} {zone.entity_label})"
               if zone.entity_type == "person"
               else f"🔴 Parque {zone.name_short} lotado! ({safe_count}/{zone.capacity} vagas)")
        alert = _make_alert(zone_id, zone.name, msg, "danger")
        ALERTS.appendleft(alert)

    elif new_status == "high" and prev_status in ("low", "medium"):
        msg = f"🟡 Alta ocupação em {zone.name}: {int(pct)}% ({zone.entity_label})"
        alert = _make_alert(zone_id, zone.name, msg, "warning")
        ALERTS.appendleft(alert)

    # ── Alertas de segurança — animais ──────────────────────────────────
    if zone.entity_type == "animal" and safe_count > 0:
        now_h = datetime.utcnow().hour
        # Animal detection: always noteworthy; critical if near food/lab
        severity = "warning" if safe_count >= 3 else "info"
        animal_alert = _make_alert(
            zone_id, zone.name,
            f"🐕 {safe_count} animal(ais) detectado(s) em {zone.name}. "
            + ("Evite a área se tiver medo de animais." if safe_count < 3 else "Área com presença significativa de animais — atenção redobrada."),
            severity,
        )
        INCIDENTS.appendleft({**animal_alert, "incident_type": "animal_detection"})
        if safe_count >= 3 and alert is None:
            alert = animal_alert
            ALERTS.appendleft(alert)

    # ── Alertas fora de horas — pessoas ─────────────────────────────────
    now_h = datetime.utcnow().hour
    is_after_hours = now_h >= 22 or now_h < 6
    if is_after_hours and zone.entity_type == "person" and safe_count > 0:
        incident = _make_alert(
            zone_id, zone.name,
            f"🔒 Presença detectada fora de horas em {zone.name} ({safe_count} {zone.entity_label}) às {datetime.utcnow().strftime('%H:%M')}",
            "danger",
        )
        INCIDENTS.appendleft({**incident, "incident_type": "after_hours"})
        _save_async(_get_db().save_incident, {**incident, "incident_type": "after_hours"})

    # ── Alerta de equipamento ligado com sala vazia ──────────────────────
    if zone.entity_type == "equipment" and safe_count > 0:
        # Encontrar a zona de pessoas correspondente
        people_zone_id = zone_id.replace("lab_equip_", "lab_info_")
        people_zone = ZONES.get(people_zone_id)
        if people_zone and people_zone.current_count == 0 and safe_count > 3:
            energy_alert = _make_alert(
                zone_id, zone.name,
                f"💡 {safe_count} computador(es) ligado(s) em {people_zone.name_short} sem estudantes presentes — desperdício de energia",
                "warning",
            )
            if alert is None:
                alert = energy_alert
                ALERTS.appendleft(alert)

    return zone, alert


def _make_alert(zone_id, zone_name, message, severity) -> dict:
    return {
        "id": str(uuid.uuid4()), "zone_id": zone_id, "zone_name": zone_name,
        "message": message, "severity": severity,
        "timestamp": datetime.utcnow().isoformat(),
    }


# ---------------------------------------------------------------------------
# Estatísticas e analytics
# ---------------------------------------------------------------------------

def get_stats() -> dict:
    people_zones = [z for z in ZONES.values() if z.entity_type == "person"]
    all_zones    = list(ZONES.values())
    total_people   = sum(z.current_count for z in people_zones)
    total_capacity = sum(z.capacity      for z in people_zones)
    vehicles       = sum(z.current_count for z in ZONES.values() if z.entity_type == "vehicle")
    animals        = sum(z.current_count for z in ZONES.values() if z.entity_type == "animal")
    return {
        "total_people":      total_people,
        "total_capacity":    total_capacity,
        "overall_occupancy": round(total_people / total_capacity * 100, 1) if total_capacity else 0,
        "full_zones":        sum(1 for z in people_zones if z.status == "full"),
        "high_zones":        sum(1 for z in people_zones if z.status == "high"),
        "total_zones":       len(people_zones),
        "vehicles_on_campus":vehicles,
        "animals_detected":  animals,
        "active_alerts":     sum(1 for z in people_zones if z.status in ("full", "high")),
    }


def get_utilization_analytics() -> list:
    """Taxa de utilização por zona (baseada no histórico)."""
    results = []
    for zone_id, zone in ZONES.items():
        if zone.entity_type != "person":
            continue
        history = list(HISTORY[zone_id])
        if not history:
            readings_above_40  = 0
            avg_occupancy      = 0.0
            peak_occupancy     = 0.0
        else:
            readings_above_40  = sum(1 for h in history if h["occupancy_percent"] >= 40)
            avg_occupancy      = sum(h["occupancy_percent"] for h in history) / len(history)
            peak_occupancy     = max(h["occupancy_percent"] for h in history)
        utilization_rate = (readings_above_40 / len(history) * 100) if history else 0
        results.append({
            "zone_id":       zone_id,
            "zone_name":     zone.name,
            "name_short":    zone.name_short,
            "zone_type":     zone.zone_type,
            "capacity":      zone.capacity,
            "avg_occupancy": round(avg_occupancy, 1),
            "peak_occupancy":round(peak_occupancy, 1),
            "utilization_rate": round(utilization_rate, 1),
            "efficiency_grade": (
                "A" if utilization_rate >= 70 else
                "B" if utilization_rate >= 50 else
                "C" if utilization_rate >= 30 else
                "D"
            ),
            "readings": len(history),
        })
    results.sort(key=lambda x: x["utilization_rate"], reverse=True)
    return results


def get_energy_analytics() -> dict:
    """
    Estima desperdício energético por zonas vazias com equipamentos ligados.
    Referência: sala de aula típica consome ~3 kWh/h (iluminação + AC + projetor).
    """
    POWER_KW = {"classroom": 3.0, "laboratory": 4.5, "library": 5.0,
                "cafeteria": 8.0, "auditorium": 6.0, "office": 2.0, "parking": 0.5}
    wasted, active = [], []
    for zone in ZONES.values():
        if zone.entity_type != "person":
            continue
        kw = POWER_KW.get(zone.zone_type, 2.0)
        if zone.occupancy_percent < 10 and zone.current_count == 0:
            wasted.append({"zone": zone.name_short, "kw": kw, "reason": "Vazia mas possivelmente com AC/luz ligados"})
        else:
            active.append({"zone": zone.name_short, "kw": kw, "occupancy": zone.occupancy_percent})
    total_wasted_kw = sum(w["kw"] for w in wasted)
    return {
        "wasted_zones":    wasted,
        "active_zones":    active,
        "total_wasted_kw": round(total_wasted_kw, 1),
        "daily_estimate_kwh": round(total_wasted_kw * 8, 1),  # 8h estimado
        "cost_estimate_aoa":  round(total_wasted_kw * 8 * 45, 0),  # ~45 AOA/kWh estimativa Angola
        "recommendation": (
            f"Desligue AC/iluminação em {len(wasted)} zona(s) vazia(s) para poupar ~{round(total_wasted_kw*8,1)} kWh/dia"
            if wasted else "Todas as zonas têm utilização adequada."
        ),
    }
