"""
Simulador Multi-Entidade — ATS-UMN Presence System v2.0
Instituto Politécnico da Huíla (IPH) | Universidade Mandume ya Ndemufayo

Entidades simuladas:
  • Pessoas      — padrões Gaussianos baseados no horário académico do IPH
  • Veículos     — fluxo de entrada/saída nos parques de estacionamento
  • Animais      — cães/gatos vadios (realidade dos campus angolanos)
  • Equipamentos — computadores activos nos laboratórios

Dados ambientais por zona:
  • Temperatura (°C) — clima de Lubango, altitude ~1700 m
  • Humidade (%)     — semi-árido com influência de altitude
  • CO₂ (ppm)       — correlacionado com ocupação humana
  • Ruído (dB)      — varia por tipo de zona e ocupação
"""

import asyncio, math, random
from datetime import datetime, timezone
from typing import Optional

import httpx

BACKEND_URL     = "http://localhost:8000"
INTERVAL        = 4      # segundos entre ciclos
NOISE_FACTOR    = 0.07   # ruído do sensor (variação relativa)


# ═══════════════════════════════════════════════════════════════════════
# PERFIS DE OCUPAÇÃO — funções Gaussianas por tipo de zona
# ═══════════════════════════════════════════════════════════════════════

def g(t, mu, sigma, amp):
    return amp * math.exp(-0.5 * ((t - mu) / sigma) ** 2)

# ── Pessoas ─────────────────────────────────────────────────────────────

def cafeteria_factor(t):
    if t < 7.0 or t > 22.0: return 0.02
    return max(g(t,7.75,0.4,0.35), g(t,12.75,0.6,1.0), g(t,19.0,0.7,0.65), 0.03)

def classroom_factor(t, offset=0.0):
    if t < 7.25 or t > 22.5: return 0.0
    starts = [7.5, 9.0, 10.5, 14.0, 15.5, 18.5, 20.0]
    return max((g(t, s + offset, 0.35, 1.0) for s in starts), default=0.0)

def lab_factor(t):
    if t < 7.5 or t > 22.5: return 0.05
    return max(g(t,8.5,0.5,0.65), g(t,15.0,0.7,0.9), g(t,19.5,0.5,0.55), 0.05)

def library_factor(t):
    if t < 7.5 or t > 21.5: return 0.02
    return 0.25 + max(g(t,10.0,1.0,0.4), g(t,16.0,1.2,0.55), g(t,20.0,0.6,0.35))

def auditorium_factor(t):
    if t < 8.0 or t > 21.0: return 0.0
    events = [9.0, 14.0, 18.5]
    return max((g(t, ev, 0.3, random.uniform(0.0, 0.85)) for ev in events), default=0.0)

def office_factor(t):
    if t < 8.0 or t > 17.0: return 0.02
    return max(g(t,9.5,0.8,0.7), g(t,14.5,0.6,0.5), 0.1)

# ── Veículos — Estacionamento ─────────────────────────────────────────

def parking_factor(t):
    """
    Fluxo de veículos: pico de entrada 07h-09h (chegada ao campus),
    pico de saída 17h-18h e 22h (fim das aulas nocturnas).
    """
    if t < 6.5 or t > 22.5: return 0.02
    morning  = g(t, 8.0,  0.7, 1.0)   # chegada manhã
    midday   = g(t, 12.5, 1.0, 0.55)  # rotatividade ao almoço
    evening  = g(t, 17.5, 0.6, 0.75)  # saída tarde
    night    = g(t, 21.5, 0.5, 0.4)   # fim das noturnas
    return max(morning, midday, evening, night, 0.05)

# ── Animais — Exterior do campus ─────────────────────────────────────

def animal_factor(t, zone_variant=0):
    """
    Cães e gatos vadios: mais activos ao amanhecer (6h-8h) e ao entardecer (17h-19h).
    Actividade esporádica ao longo do dia, especialmente perto do refeitório (ao almoço).
    """
    if t < 5.5 or t > 23.0: return random.uniform(0, 0.05)
    dawn    = g(t, 6.5,  0.6, 0.8)    # amanhecer
    lunch   = g(t, 12.5, 0.5, 0.4)   # perto do refeitório
    dusk    = g(t, 18.0, 0.7, 0.9)   # entardecer
    noise   = random.uniform(0, 0.15) # presença errática e imprevisível
    base    = max(dawn, lunch, dusk, 0.05) + noise
    # Zona variante — um pouco desfasada para simular diferentes áreas
    return base * (1.0 + zone_variant * 0.2 * random.uniform(-1, 1))

# ── Equipamentos — PCs activos (correlacionados com ocupação dos labs) ─

def equipment_factor(t):
    """PCs ligados: ligeiramente acima da ocupação humana (PCs são ligados antes dos estudantes)."""
    base = lab_factor(t)
    overhead = min(0.2, base * 0.3)  # técnicos/professores ligam PCs antes das aulas
    return min(1.0, base + overhead)


# ═══════════════════════════════════════════════════════════════════════
# DADOS AMBIENTAIS — Clima de Lubango + efeito da ocupação
# ═══════════════════════════════════════════════════════════════════════

def simulate_environment(zone_type: str, count: int, capacity: int, t: float) -> dict:
    """
    Lubango (Huíla) — altitude ~1700 m:
      • Temperatura: amena, 16–26 °C em Abril (outono austral)
      • Humidade:    60–80 %
      • CO₂:         420 ppm base (exterior), sobe com ocupação
      • Ruído:       varia por tipo de zona
    """
    pct = (count / capacity * 100) if capacity > 0 else 0

    # Temperatura ambiente: ciclo diurno suave
    t_ambient = 18.0 + 5.0 * math.sin((t - 6.0) * math.pi / 14.0)
    # Calor gerado por pessoas + equipamentos
    heat_person = pct * 0.065
    heat_equip  = {"laboratory": 1.5, "cafeteria": 0.5}.get(zone_type, 0.0)
    hvac_offset = {"cafeteria": -1.5, "library": -1.0, "auditorium": -1.0, "office": -0.5}.get(zone_type, 0.0)
    temperature = t_ambient + heat_person + heat_equip + hvac_offset + random.gauss(0, 0.4)

    # CO₂ — cada pessoa emite ~0.2 L/min de CO₂; em sala fechada acumula-se
    co2_per_person = {"classroom":9,"library":10,"laboratory":8,"cafeteria":5,"auditorium":8,"office":10}.get(zone_type,7)
    co2 = 420 + count * co2_per_person + random.gauss(0, 25)
    co2 = max(400, min(5000, int(co2)))

    # Humidade — base 65 %, sobe com respiração humana
    humidity = 65 + pct * 0.05 + 8 * math.sin((t - 14) * math.pi / 12) + random.gauss(0, 1.5)
    humidity = round(max(30, min(98, humidity)), 1)

    # Ruído — nível base por tipo, sobe com ocupação
    base_noise = {"library":28,"classroom":42,"laboratory":48,"cafeteria":60,
                  "auditorium":42,"office":44,"parking":55,"outdoor":50}.get(zone_type, 42)
    noise = base_noise + pct * 0.28 + random.gauss(0, 2.5)
    noise = round(max(15, min(105, noise)), 1)

    return {
        "temperature": round(temperature, 1),
        "humidity":    humidity,
        "co2_ppm":     co2,
        "noise_db":    noise,
    }


# ═══════════════════════════════════════════════════════════════════════
# CONFIGURAÇÃO DE TODAS AS ZONAS
# ═══════════════════════════════════════════════════════════════════════

ZONE_CONFIG = {
    # Pessoas
    "cafeteria":    {"capacity": 180, "fn": lambda t: cafeteria_factor(t),        "env": True},
    "sala_14":      {"capacity":  40, "fn": lambda t: classroom_factor(t, 0.00),  "env": True},
    "sala_15":      {"capacity":  40, "fn": lambda t: classroom_factor(t, 0.20),  "env": True},
    "sala_21":      {"capacity":  45, "fn": lambda t: classroom_factor(t,-0.10),  "env": True},
    "sala_23":      {"capacity":  35, "fn": lambda t: classroom_factor(t, 0.15),  "env": True},
    "lab_info_1":   {"capacity":  30, "fn": lambda t: lab_factor(t),              "env": True},
    "lab_info_2":   {"capacity":  30, "fn": lambda t: lab_factor(t) * random.uniform(0.8, 1.0), "env": True},
    "biblioteca":   {"capacity": 100, "fn": lambda t: library_factor(t),          "env": True},
    "auditorio":    {"capacity": 300, "fn": lambda t: auditorium_factor(t),        "env": True},
    "secretaria":   {"capacity":  15, "fn": lambda t: office_factor(t),           "env": True},
    # Veículos
    "parque_a":     {"capacity":  50, "fn": lambda t: parking_factor(t),          "env": False},
    "parque_b":     {"capacity":  30, "fn": lambda t: parking_factor(t) * random.uniform(0.7, 1.0), "env": False},
    # Animais
    "campus_norte": {"capacity":  20, "fn": lambda t: animal_factor(t, 0),        "env": False},
    "campus_sul":   {"capacity":  15, "fn": lambda t: animal_factor(t, 1),        "env": False},
    # Equipamentos
    "lab_equip_1":  {"capacity":  30, "fn": lambda t: equipment_factor(t),        "env": False},
    "lab_equip_2":  {"capacity":  30, "fn": lambda t: equipment_factor(t) * random.uniform(0.85, 1.0), "env": False},
}


# ═══════════════════════════════════════════════════════════════════════
# GERADOR DE LEITURAS
# ═══════════════════════════════════════════════════════════════════════

def simulate_count(zone_id: str, t: float) -> int:
    cfg      = ZONE_CONFIG[zone_id]
    factor   = cfg["fn"](t)
    capacity = cfg["capacity"]
    noise    = random.gauss(0, NOISE_FACTOR * max(factor, 0.05))
    return max(0, min(capacity, int(round((factor + noise) * capacity))))


async def send_reading(client: httpx.AsyncClient, zone_id: str, count: int, env: Optional[dict]):
    payload = {
        "zone_id":   zone_id,
        "count":     count,
        "sensor_id": f"SIM-{zone_id[:8].upper()}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    if env:
        payload.update(env)
    try:
        r = await client.post(f"{BACKEND_URL}/api/reading", json=payload, timeout=5.0)
        r.raise_for_status()
    except httpx.ConnectError:
        print("  [ERRO] Backend não disponível.")
    except Exception as e:
        print(f"  [WARN] {zone_id}: {e}")


# ═══════════════════════════════════════════════════════════════════════
# LOOP PRINCIPAL
# ═══════════════════════════════════════════════════════════════════════

ENTITY_ICON = {
    "cafeteria":  "🍽️", "classroom": "🏫", "laboratory": "💻",
    "library":    "📚", "auditorium":"🎤", "office":     "📋",
    "parking":    "🚗", "outdoor":   "🐕", "equipment":  "🖥️",
}

async def run():
    print("═" * 62)
    print("  ATS-UMN Presence System v2.0 — Simulador Multi-Entidade")
    print("  Instituto Politécnico da Huíla | UMN — Lubango, Angola")
    print("═" * 62)
    print(f"  Backend:   {BACKEND_URL}")
    print(f"  Zonas:     {len(ZONE_CONFIG)}  |  Intervalo: {INTERVAL}s")
    print("  Entidades: pessoas, veículos, animais, equipamentos")
    print("  Ctrl+C para parar.\n")

    # Aguardar backend
    async with httpx.AsyncClient() as client:
        for i in range(15):
            try:
                r = await client.get(f"{BACKEND_URL}/api/health", timeout=3.0)
                if r.status_code == 200:
                    print("  ✅ Backend conectado — iniciando simulação...\n")
                    break
            except Exception:
                pass
            print(f"  ⏳ Aguardando backend... ({i+1}/15)")
            await asyncio.sleep(2)
        else:
            print("  ❌ Backend não respondeu. Inicie o backend primeiro.")
            return

    tick = 0
    async with httpx.AsyncClient() as client:
        while True:
            now = datetime.now()
            t   = now.hour + now.minute / 60.0 + now.second / 3600.0

            tasks, log = [], []
            for zone_id, cfg in ZONE_CONFIG.items():
                count = simulate_count(zone_id, t)
                cap   = cfg["capacity"]
                pct   = round(count / cap * 100)
                env   = simulate_environment(
                    _zone_type(zone_id), count, cap, t
                ) if cfg["env"] else None
                log.append((zone_id, count, cap, pct, env))
                tasks.append(send_reading(client, zone_id, count, env))

            await asyncio.gather(*tasks)

            if tick % 5 == 0:
                ts = now.strftime("%H:%M:%S")
                print(f"[{ts}]  Ciclo #{tick+1}\n")
                sections = [
                    ("👤 Pessoas",    [x for x in log if x[0] in ("cafeteria","sala_14","sala_15","sala_21","sala_23","lab_info_1","lab_info_2","biblioteca","auditorio","secretaria")]),
                    ("🚗 Veículos",   [x for x in log if x[0].startswith("parque")]),
                    ("🐕 Animais",    [x for x in log if "campus" in x[0]]),
                    ("🖥️  Equipam.",  [x for x in log if "equip" in x[0]]),
                ]
                for title, items in sections:
                    if not items: continue
                    print(f"  {title}")
                    for zone_id, count, cap, pct, env in items:
                        bar  = "█" * (pct // 10) + "░" * (10 - pct // 10)
                        icon = "🔴" if pct>=100 else "🟠" if pct>=75 else "🟡" if pct>=40 else "🟢"
                        env_str = f"  {env['temperature']:.1f}°C  CO₂:{env['co2_ppm']}ppm" if env else ""
                        print(f"    {icon} {zone_id:<14} {bar} {count:>3}/{cap} ({pct:>3}%){env_str}")
                    print()

            tick += 1
            await asyncio.sleep(INTERVAL)


def _zone_type(zone_id: str) -> str:
    mapping = {
        "cafeteria":"cafeteria","sala_14":"classroom","sala_15":"classroom",
        "sala_21":"classroom","sala_23":"classroom","lab_info_1":"laboratory",
        "lab_info_2":"laboratory","biblioteca":"library","auditorio":"auditorium",
        "secretaria":"office","parque_a":"parking","parque_b":"parking",
        "campus_norte":"outdoor","campus_sul":"outdoor",
        "lab_equip_1":"laboratory","lab_equip_2":"laboratory",
    }
    return mapping.get(zone_id, "classroom")


if __name__ == "__main__":
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        print("\n  Simulador encerrado.")
