"""
Gestor de Actuadores — ATS-UMN Presence System
Instituto Politécnico da Huíla (IPH) | Universidade Mandume ya Ndemufayo

UC: Sistemas Embebidos e IoT — Unidade 2: Nós Sensores e Actuadores

Actuadores suportados (físicos no ESP32 / simulados no sistema):
  • LED RGB        — indicador visual de ocupação por zona
  • Buzzer         — alarme sonoro quando capacidade excedida
  • Display OLED   — exibição local da ocupação (I²C)
  • Relay (AC/Luz) — controlo de ar condicionado e iluminação
  • Porta electrónica — travar acesso quando zona lotada (auditório/labs)

Lógica:
  store.update_zone() detecta transições de estado →
  actuators.decide() determina o comando →
  publica via MQTT → ESP32 executa fisicamente

Em simulação: os comandos são registados no log e devolvidos via API.
"""

from datetime import datetime
from collections import deque
from typing import Optional, List

# Registo de comandos de actuadores enviados
ACTUATOR_LOG: deque = deque(maxlen=100)


def decide(zone_id: str, zone_type: str, entity_type: str,
           status: str, occupancy_percent: float, count: int,
           capacity: int, env: Optional[dict] = None) -> List[dict]:
    """
    Decide quais os actuadores a accionar com base no estado da zona.
    Retorna lista de comandos a publicar via MQTT.
    """
    commands = []
    ts = datetime.utcnow().isoformat()

    if entity_type != "person":
        return commands

    # ── LED RGB — cor indica nível de ocupação ───────────────────────────
    led_color = {
        "full":   "red",
        "high":   "yellow",
        "medium": "blue",
        "low":    "green",
    }.get(status, "off")

    commands.append({
        "zone_id":  zone_id,
        "actuator": "led",
        "command":  led_color,
        "topic":    f"campus/IPH/{zone_id}/actuator/led",
        "reason":   f"Ocupação {occupancy_percent:.0f}% → LED {led_color}",
        "timestamp": ts,
    })

    # ── Buzzer — alarme quando lotado ────────────────────────────────────
    if status == "full":
        commands.append({
            "zone_id":  zone_id,
            "actuator": "buzzer",
            "command":  "beep",
            "topic":    f"campus/IPH/{zone_id}/actuator/buzzer",
            "reason":   f"Capacidade máxima atingida ({count}/{capacity})",
            "timestamp": ts,
        })

    # ── Relay AC — desligar ar quando zona vazia ─────────────────────────
    if occupancy_percent < 5 and zone_type in ("classroom", "laboratory"):
        commands.append({
            "zone_id":  zone_id,
            "actuator": "relay_ac",
            "command":  "off",
            "topic":    f"campus/IPH/{zone_id}/actuator/relay_ac",
            "reason":   f"Zona vazia ({count} pessoas) — desligar AC para poupar energia",
            "timestamp": ts,
        })
    elif occupancy_percent >= 20 and zone_type in ("classroom", "laboratory"):
        commands.append({
            "zone_id":  zone_id,
            "actuator": "relay_ac",
            "command":  "on",
            "topic":    f"campus/IPH/{zone_id}/actuator/relay_ac",
            "reason":   f"Zona com {count} pessoas — ligar AC",
            "timestamp": ts,
        })

    # ── Relay Iluminação — desligar luzes quando vazio ──────────────────
    if occupancy_percent < 3:
        commands.append({
            "zone_id":  zone_id,
            "actuator": "relay_light",
            "command":  "off",
            "topic":    f"campus/IPH/{zone_id}/actuator/relay_light",
            "reason":   "Zona vazia — desligar iluminação",
            "timestamp": ts,
        })

    # ── Porta electrónica — bloquear acesso quando auditório lotado ──────
    if zone_type == "auditorium" and status == "full":
        commands.append({
            "zone_id":  zone_id,
            "actuator": "door_lock",
            "command":  "lock",
            "topic":    f"campus/IPH/{zone_id}/actuator/door",
            "reason":   f"Auditório lotado — bloquear entrada adicional",
            "timestamp": ts,
        })
    elif zone_type == "auditorium" and status != "full":
        commands.append({
            "zone_id":  zone_id,
            "actuator": "door_lock",
            "command":  "unlock",
            "topic":    f"campus/IPH/{zone_id}/actuator/door",
            "reason":   "Auditório com capacidade disponível",
            "timestamp": ts,
        })

    # ── Alerta de qualidade do ar ─────────────────────────────────────────
    if env and env.get("co2_ppm") and env["co2_ppm"] > 1200:
        commands.append({
            "zone_id":  zone_id,
            "actuator": "ventilation",
            "command":  "on",
            "topic":    f"campus/IPH/{zone_id}/actuator/ventilation",
            "reason":   f"CO₂ elevado ({env['co2_ppm']} ppm) — activar ventilação forçada",
            "timestamp": ts,
        })

    # Registar no log
    for cmd in commands:
        ACTUATOR_LOG.appendleft(cmd)

    return commands


def get_log(limit: int = 30) -> list:
    return list(ACTUATOR_LOG)[:limit]


def get_zone_state(zone_id: str) -> dict:
    """Último estado conhecido dos actuadores de uma zona."""
    state = {}
    for cmd in ACTUATOR_LOG:
        if cmd["zone_id"] == zone_id and cmd["actuator"] not in state:
            state[cmd["actuator"]] = cmd["command"]
    return state
