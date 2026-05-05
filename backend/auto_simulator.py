"""
Simulador automático em background — ATS-UMN Presence System v2.0
Corre como thread daemon quando o backend arranca no Render/produção.
Chama store.update_zone() directamente, sem HTTP overhead.
"""

import math, random, threading, time
from datetime import datetime
from typing import Callable, Optional

import store
import database

INTERVAL     = 4       # segundos entre ciclos
NOISE_FACTOR = 0.07

# ── Funções de ocupação ──────────────────────────────────────────────────

def _g(t, mu, sigma, amp):
    return amp * math.exp(-0.5 * ((t - mu) / sigma) ** 2)

def _cafeteria(t):
    if t < 7.0 or t > 22.0: return 0.02
    return max(_g(t,7.75,0.4,0.35), _g(t,12.75,0.6,1.0), _g(t,19.0,0.7,0.65), 0.03)

def _classroom(t, offset=0.0):
    if t < 7.25 or t > 22.5: return 0.0
    return max((_g(t, s+offset, 0.35, 1.0) for s in [7.5,9.0,10.5,14.0,15.5,18.5,20.0]), default=0.0)

def _lab(t):
    if t < 7.5 or t > 22.5: return 0.05
    return max(_g(t,8.5,0.5,0.65), _g(t,15.0,0.7,0.9), _g(t,19.5,0.5,0.55), 0.05)

def _library(t):
    if t < 7.5 or t > 21.5: return 0.02
    return 0.25 + max(_g(t,10.0,1.0,0.4), _g(t,16.0,1.2,0.55), _g(t,20.0,0.6,0.35))

def _auditorium(t):
    if t < 8.0 or t > 21.0: return 0.0
    return max((_g(t, ev, 0.3, random.uniform(0.0, 0.85)) for ev in [9.0,14.0,18.5]), default=0.0)

def _office(t):
    if t < 8.0 or t > 17.0: return 0.02
    return max(_g(t,9.5,0.8,0.7), _g(t,14.5,0.6,0.5), 0.1)

def _parking(t):
    if t < 6.5 or t > 22.5: return 0.02
    return max(_g(t,8.0,0.7,1.0), _g(t,12.5,1.0,0.55), _g(t,17.5,0.6,0.75), _g(t,21.5,0.5,0.4), 0.05)

def _animal(t, variant=0):
    if t < 5.5 or t > 23.0: return random.uniform(0, 0.05)
    base = max(_g(t,6.5,0.6,0.8), _g(t,12.5,0.5,0.4), _g(t,18.0,0.7,0.9), 0.05) + random.uniform(0, 0.15)
    return base * (1.0 + variant * 0.2 * random.uniform(-1, 1))

def _equipment(t):
    return min(1.0, _lab(t) + min(0.2, _lab(t) * 0.3))


ZONE_CONFIG = {
    "cafeteria":    {"capacity":180, "fn": _cafeteria,                                     "env": True},
    "sala_14":      {"capacity": 40, "fn": lambda t: _classroom(t, 0.00),                  "env": True},
    "sala_15":      {"capacity": 40, "fn": lambda t: _classroom(t, 0.20),                  "env": True},
    "sala_21":      {"capacity": 45, "fn": lambda t: _classroom(t,-0.10),                  "env": True},
    "sala_23":      {"capacity": 35, "fn": lambda t: _classroom(t, 0.15),                  "env": True},
    "lab_info_1":   {"capacity": 30, "fn": _lab,                                            "env": True},
    "lab_info_2":   {"capacity": 30, "fn": lambda t: _lab(t)*random.uniform(0.8,1.0),      "env": True},
    "biblioteca":   {"capacity":100, "fn": _library,                                        "env": True},
    "auditorio":    {"capacity":300, "fn": _auditorium,                                     "env": True},
    "secretaria":   {"capacity": 15, "fn": _office,                                         "env": True},
    "parque_a":     {"capacity": 50, "fn": _parking,                                        "env": False},
    "parque_b":     {"capacity": 30, "fn": lambda t: _parking(t)*random.uniform(0.7,1.0),  "env": False},
    "campus_norte": {"capacity": 20, "fn": lambda t: _animal(t, 0),                        "env": False},
    "campus_sul":   {"capacity": 15, "fn": lambda t: _animal(t, 1),                        "env": False},
    "lab_equip_1":  {"capacity": 30, "fn": _equipment,                                     "env": False},
    "lab_equip_2":  {"capacity": 30, "fn": lambda t: _equipment(t)*random.uniform(0.85,1.0), "env": False},
}

_ZONE_TYPE = {
    "cafeteria":"cafeteria","sala_14":"classroom","sala_15":"classroom",
    "sala_21":"classroom","sala_23":"classroom","lab_info_1":"laboratory",
    "lab_info_2":"laboratory","biblioteca":"library","auditorio":"auditorium",
    "secretaria":"office","parque_a":"parking","parque_b":"parking",
    "campus_norte":"outdoor","campus_sul":"outdoor",
    "lab_equip_1":"laboratory","lab_equip_2":"laboratory",
}

def _env(zone_id: str, count: int, capacity: int, t: float) -> dict:
    pct       = count / capacity * 100 if capacity else 0
    ztype     = _ZONE_TYPE.get(zone_id, "classroom")
    t_amb     = 18.0 + 5.0 * math.sin((t - 6.0) * math.pi / 14.0)
    temp      = t_amb + pct*0.065 + {"laboratory":1.5,"cafeteria":0.5}.get(ztype,0) \
                + {"cafeteria":-1.5,"library":-1.0,"auditorium":-1.0,"office":-0.5}.get(ztype,0) \
                + random.gauss(0, 0.4)
    co2_pp    = {"classroom":9,"library":10,"laboratory":8,"cafeteria":5,"auditorium":8,"office":10}.get(ztype,7)
    co2       = max(400, min(5000, int(420 + count*co2_pp + random.gauss(0,25))))
    humidity  = round(max(30, min(98, 65 + pct*0.05 + 8*math.sin((t-14)*math.pi/12) + random.gauss(0,1.5))), 1)
    base_n    = {"library":28,"classroom":42,"laboratory":48,"cafeteria":60,"auditorium":42,"office":44,"parking":55,"outdoor":50}.get(ztype,42)
    noise     = round(max(15, min(105, base_n + pct*0.28 + random.gauss(0,2.5))), 1)
    return {"temperature": round(temp,1), "humidity": humidity, "co2_ppm": co2, "noise_db": noise}


def _loop(broadcast_fn: Callable):
    print("[Simulador] Loop iniciado.", flush=True)
    while True:
        try:
            now = datetime.now()
            t   = now.hour + now.minute/60.0 + now.second/3600.0

            for zone_id, cfg in ZONE_CONFIG.items():
                factor   = cfg["fn"](t)
                capacity = cfg["capacity"]
                noise    = random.gauss(0, NOISE_FACTOR * max(factor, 0.05))
                count    = max(0, min(capacity, int(round((factor + noise) * capacity))))
                env      = _env(zone_id, count, capacity, t) if cfg["env"] else None

                result = store.update_zone(zone_id, count, env)
                if result:
                    zone, alert = result
                    zone_dict = store.zone_to_dict(zone)
                    broadcast_fn({"type": "zone_update", "zone": zone_dict})
                    if alert:
                        broadcast_fn({"type": "alert", "alert": alert})
        except Exception as e:
            print(f"[Simulador] ERRO: {e}", flush=True)

        time.sleep(INTERVAL)


def start(broadcast_fn: Callable):
    t = threading.Thread(target=_loop, args=(broadcast_fn,), daemon=True)
    t.start()
    print("  [Simulador] Thread de simulação automática iniciada.")
