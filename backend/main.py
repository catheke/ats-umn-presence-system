"""
API Principal — ATS-UMN Presence System v2.0
Instituto Politécnico da Huíla (IPH) | Universidade Mandume ya Ndemufayo

Monitorização multi-entidade: Pessoas | Veículos | Animais | Equipamentos
"""

import json, math, threading, os
from datetime import datetime
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory
from flask_sock import Sock

# Carregar variáveis de ambiente do .env antes de qualquer import
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    pass

import store
import actuators
import database

_STATIC = Path(__file__).parent.parent / "frontend" / "dist"
app  = Flask(__name__, static_folder=str(_STATIC) if _STATIC.exists() else None, static_url_path="")
sock = Sock(app)

_ws_clients: list = []
_ws_lock = threading.Lock()


# ---------------------------------------------------------------------------
# WebSocket
# ---------------------------------------------------------------------------

def broadcast(data: dict):
    msg  = json.dumps(data, default=str)
    dead = []
    with _ws_lock:
        for ws in list(_ws_clients):
            try: ws.send(msg)
            except Exception: dead.append(ws)
        for ws in dead:
            try: _ws_clients.remove(ws)
            except ValueError: pass


@sock.route("/ws")
def ws_handler(ws):
    with _ws_lock:
        _ws_clients.append(ws)
    try:
        ws.send(json.dumps({
            "type":   "initial_state",
            "zones":  [store.zone_to_dict(z) for z in store.ZONES.values()],
            "alerts": list(store.ALERTS),
            "stats":  store.get_stats(),
        }, default=str))
        while True:
            if ws.receive(timeout=60) is None:
                break
    except Exception:
        pass
    finally:
        with _ws_lock:
            try: _ws_clients.remove(ws)
            except ValueError: pass


# ---------------------------------------------------------------------------
# REST — core
# ---------------------------------------------------------------------------

@app.get("/api/zones")
def get_zones():
    return jsonify([store.zone_to_dict(z) for z in store.ZONES.values()])

@app.get("/api/zones/<zone_id>")
def get_zone(zone_id):
    z = store.ZONES.get(zone_id)
    if not z: return jsonify({"error": "Zona não encontrada"}), 404
    return jsonify(store.zone_to_dict(z))

@app.get("/api/history")
def get_all_history():
    return jsonify({k: list(v) for k, v in store.HISTORY.items()})

@app.get("/api/history/<zone_id>")
def get_history(zone_id):
    entries = list(store.HISTORY[zone_id])
    return jsonify(entries[-int(request.args.get("limit", 50)):])

@app.get("/api/alerts")
def get_alerts():
    return jsonify(list(store.ALERTS))

@app.get("/api/stats")
def get_stats():
    return jsonify(store.get_stats())

@app.get("/api/health")
def health():
    with _ws_lock: n = len(_ws_clients)
    return jsonify({"status": "healthy", "ws_clients": n, "zones": len(store.ZONES)})

@app.post("/api/reading")
def receive_reading():
    data = request.get_json(force=True, silent=True) or {}
    if "zone_id" not in data or "count" not in data:
        return jsonify({"error": "Campos obrigatórios: zone_id, count"}), 400

    env = {k: data[k] for k in ("temperature","humidity","co2_ppm","noise_db") if k in data}
    result = store.update_zone(data["zone_id"], int(data["count"]), env or None)
    if result is None:
        return jsonify({"error": f"Zona '{data['zone_id']}' não encontrada"}), 404

    zone, alert = result
    zone_dict   = store.zone_to_dict(zone)
    broadcast({"type": "zone_update", "zone": zone_dict})
    if alert:
        broadcast({"type": "alert", "alert": alert})
    return jsonify({"status": "ok", "zone": zone_dict, "alert": alert})


# ---------------------------------------------------------------------------
# REST — entidades especializadas
# ---------------------------------------------------------------------------

@app.get("/api/entities/vehicles")
def get_vehicles():
    """Estado dos parques de estacionamento."""
    zones = [store.zone_to_dict(z) for z in store.ZONES.values() if z.entity_type == "vehicle"]
    total_spots = sum(z["capacity"] for z in zones)
    used_spots  = sum(z["current_count"] for z in zones)
    return jsonify({
        "zones": zones,
        "total_spots": total_spots,
        "used_spots":  used_spots,
        "free_spots":  total_spots - used_spots,
        "occupancy_percent": round(used_spots / total_spots * 100, 1) if total_spots else 0,
    })

@app.get("/api/entities/animals")
def get_animals():
    """Presença de animais no exterior do campus."""
    zones     = [store.zone_to_dict(z) for z in store.ZONES.values() if z.entity_type == "animal"]
    total     = sum(z["current_count"] for z in zones)
    incidents = list(store.INCIDENTS)[:10]
    return jsonify({
        "zones":   zones,
        "total_detected": total,
        "recent_incidents": incidents,
        "safety_status": "caution" if total >= 5 else "clear" if total == 0 else "monitor",
    })

@app.get("/api/entities/equipment")
def get_equipment():
    """Computadores e equipamentos activos nos laboratórios."""
    zones = [store.zone_to_dict(z) for z in store.ZONES.values() if z.entity_type == "equipment"]
    return jsonify({
        "zones": zones,
        "total_active": sum(z["current_count"] for z in zones),
        "total_capacity": sum(z["capacity"] for z in zones),
    })

@app.get("/api/entities/environment")
def get_environment():
    """Leituras ambientais de todas as zonas (CO₂, temperatura, humidade, ruído)."""
    env_data = []
    for z in store.ZONES.values():
        if z.entity_type != "person":
            continue
        env_data.append({
            "zone_id":     z.id,
            "zone_name":   z.name,
            "name_short":  z.name_short,
            "zone_type":   z.zone_type,
            "temperature": z.temperature,
            "humidity":    z.humidity,
            "co2_ppm":     z.co2_ppm,
            "noise_db":    z.noise_db,
            "aqi_label":   z.aqi_label,
            "aqi_color":   z.aqi_color,
            "env_alerts":  z.env_alerts,
            "last_updated":z.last_updated,
        })
    has_alerts = [z for z in env_data if z["env_alerts"]]
    return jsonify({"zones": env_data, "zones_with_alerts": len(has_alerts)})

@app.get("/api/incidents")
def get_incidents():
    return jsonify(list(store.INCIDENTS))


# ---------------------------------------------------------------------------
# REST — analytics
# ---------------------------------------------------------------------------

@app.get("/api/analytics/utilization")
def analytics_utilization():
    return jsonify(store.get_utilization_analytics())

@app.get("/api/analytics/energy")
def analytics_energy():
    return jsonify(store.get_energy_analytics())

@app.get("/api/analytics/overview")
def analytics_overview():
    util  = store.get_utilization_analytics()
    energy = store.get_energy_analytics()
    people_zones = [z for z in store.ZONES.values() if z.entity_type == "person"]
    total_cap    = sum(z.capacity for z in people_zones)
    total_people = sum(z.current_count for z in people_zones)

    # Zona mais e menos utilizada
    most_used  = util[0]  if util else None
    least_used = util[-1] if util else None

    return jsonify({
        "campus_utilization": round(total_people / total_cap * 100, 1) if total_cap else 0,
        "top_zone":    most_used,
        "bottom_zone": least_used,
        "energy":      energy,
        "total_vehicles": sum(z.current_count for z in store.ZONES.values() if z.entity_type == "vehicle"),
        "total_animals":  sum(z.current_count for z in store.ZONES.values() if z.entity_type == "animal"),
        "zones_count": {
            "people":    len([z for z in store.ZONES.values() if z.entity_type == "person"]),
            "vehicles":  len([z for z in store.ZONES.values() if z.entity_type == "vehicle"]),
            "animals":   len([z for z in store.ZONES.values() if z.entity_type == "animal"]),
            "equipment": len([z for z in store.ZONES.values() if z.entity_type == "equipment"]),
        },
    })


# ---------------------------------------------------------------------------
# REST — Portal do Estudante
# ---------------------------------------------------------------------------

def _gaussian(t, mu, sigma, amp):
    return amp * math.exp(-0.5 * ((t - mu) / sigma) ** 2)

def _cafeteria_curve(t):
    if t < 7.0 or t > 22.0: return 0.02
    return max(_gaussian(t,7.75,0.4,0.35), _gaussian(t,12.75,0.6,1.0), _gaussian(t,19.0,0.7,0.65), 0.03)

def _queue_minutes(n): return max(0, int((n - 25) / 3 * 2)) if n > 25 else 0

def _study_score(z): return max(0, min(100, int(100 - z.occupancy_percent + (12 if z.zone_type=="library" else 0))))

def _campus_mood(zones):
    stats = store.get_stats()
    pct   = stats["overall_occupancy"]
    if pct >= 65: return {"level":"busy",    "label":"Campus Agitado",   "emoji":"🔴","color":"red",    "description":"Muito movimento agora"}
    if pct >= 30: return {"level":"moderate","label":"Actividade Normal", "emoji":"🟡","color":"amber",  "description":"Movimento moderado"}
    if pct >= 8:  return {"level":"quiet",   "label":"Campus Tranquilo", "emoji":"🟢","color":"emerald","description":"Boa altura para estudar"}
    return              {"level":"empty",    "label":"Campus Calmo",     "emoji":"🔵","color":"blue",   "description":"Poucos estudantes agora"}

def _generate_recommendations(zones, hour):
    recs = []
    cafe = zones.get("cafeteria"); bib = zones.get("biblioteca"); sec = zones.get("secretaria")
    labs = [z for z in zones.values() if z.zone_type == "laboratory"]
    animals_total = sum(z.current_count for z in zones.values() if z.entity_type == "animal")
    free_parking = sum(z.capacity - z.current_count for z in zones.values() if z.entity_type == "vehicle")

    if cafe and 11.0 <= hour <= 11.75 and cafe.occupancy_percent < 55:
        recs.append({"priority":"tip","icon":"🍽️","title":"Vai almoçar? Vá já!",
            "message":f"Em ~{int((12.5-hour)*60)} min o Refeitório enche. Ainda tranquilo ({int(cafe.occupancy_percent)}%)."})
    if cafe and cafe.status == "full":
        recs.append({"priority":"urgent","icon":"⚠️","title":"Refeitório lotado",
            "message":"Capacidade máxima. Aguarde ~15 min ou traga lanche de casa."})
    if bib and bib.occupancy_percent < 45 and 7.5 <= hour <= 21.5:
        recs.append({"priority":"info","icon":"📚","title":f"Biblioteca com {bib.capacity-bib.current_count} lugares livres",
            "message":"Ambiente tranquilo. Wi-Fi e tomadas disponíveis."})
    if sec and sec.occupancy_percent > 65 and 8 <= hour <= 16:
        recs.append({"priority":"tip","icon":"📋","title":"Secretaria com fila",
            "message":"Evite agora. Melhor: antes das 09h ou após as 15h30."})
    if animals_total >= 3:
        recs.append({"priority":"tip","icon":"🐕","title":f"{animals_total} animais detectados no exterior",
            "message":"Cão(ões) vadio(s) no campus. Se necessário, use percurso alternativo pelo Bloco B."})
    if free_parking <= 5:
        recs.append({"priority":"tip","icon":"🚗","title":f"Apenas {free_parking} vaga(s) no parque",
            "message":"Parques quase lotados. Considere transporte público ou chegue mais cedo amanhã."})
    free_labs = [z for z in labs if z.occupancy_percent < 50]
    if free_labs and 7.5 <= hour <= 21.5:
        recs.append({"priority":"info","icon":"💻","title":f"{free_labs[0].name_short} disponível",
            "message":f"{free_labs[0].capacity - free_labs[0].current_count} postos livres para prática."})
    return recs[:5]

@app.get("/api/student/status")
def student_status():
    now   = datetime.now()
    hour  = now.hour + now.minute / 60.0
    zones = store.ZONES
    cafe  = zones.get("cafeteria")
    sec   = zones.get("secretaria")
    study_spots = sorted([
        {"id":z.id,"name":z.name,"name_short":z.name_short,"type":z.zone_type,
         "free_seats":z.capacity-z.current_count,"occupancy_percent":z.occupancy_percent,
         "status":z.status,"score":_study_score(z),
         "tags":{"library":["Silêncio","Wi-Fi","Tomadas"],"classroom":["Quadro","Grupo"]}.get(z.zone_type,[])}
        for z in zones.values() if z.zone_type in ("library","classroom")
    ], key=lambda x: x["score"], reverse=True)
    return jsonify({
        "timestamp":    now.isoformat(),
        "campus_mood":  _campus_mood(zones),
        "recommendations": _generate_recommendations(zones, hour),
        "cafeteria": {"current_count":cafe.current_count,"capacity":cafe.capacity,
            "occupancy_percent":cafe.occupancy_percent,"status":cafe.status,
            "queue_wait_minutes":_queue_minutes(cafe.current_count),
            "suggestion":("Lotado! Aguarde ~15 min." if cafe.status=="full" else
                          "Bom momento para ir." if cafe.occupancy_percent < 40 else "Moderado.")} if cafe else None,
        "study_spots":  study_spots[:6],
        "labs": [{"id":z.id,"name":z.name,"name_short":z.name_short,
                  "occupancy_percent":z.occupancy_percent,"status":z.status,
                  "free_seats":z.capacity-z.current_count,"capacity":z.capacity,
                  "available":z.occupancy_percent<60} for z in zones.values() if z.zone_type=="laboratory"],
        "secretaria": {"current_count":sec.current_count,"capacity":sec.capacity,
            "occupancy_percent":sec.occupancy_percent,"status":sec.status,
            "wait_minutes":sec.current_count*5,"is_open":8<=hour<=17,
            "schedule":"08h00–17h00 (dias úteis)",
            "suggestion":"Quase sem fila — bom momento." if sec.occupancy_percent<30 else
                         "Fila grande. Tente antes das 09h." if sec.occupancy_percent>65 else "Espera moderada."} if sec else None,
        "parking": {"free_spots": sum(z.capacity-z.current_count for z in zones.values() if z.entity_type=="vehicle"),
                    "total_spots": sum(z.capacity for z in zones.values() if z.entity_type=="vehicle"),
                    "zones": [store.zone_to_dict(z) for z in zones.values() if z.entity_type=="vehicle"]},
        "animals": {"total": sum(z.current_count for z in zones.values() if z.entity_type=="animal"),
                    "zones": [store.zone_to_dict(z) for z in zones.values() if z.entity_type=="animal"]},
    })

@app.get("/api/student/cafeteria-forecast")
def cafeteria_forecast():
    cap = (store.ZONES.get("cafeteria") or type("",(),{"capacity":180})()).capacity
    return jsonify([{
        "time": f"{h:02d}:{m:02d}",
        "percent": round(_cafeteria_curve(h + m/60) * 100, 1),
        "count":   int(_cafeteria_curve(h + m/60) * cap),
        "level":   ("full" if _cafeteria_curve(h+m/60)>=0.95 else "high" if _cafeteria_curve(h+m/60)>=0.70
                    else "medium" if _cafeteria_curve(h+m/60)>=0.35 else "low"),
    } for h in range(7, 23) for m in (0, 30)])

# ---------------------------------------------------------------------------
# REST — Actuadores
# ---------------------------------------------------------------------------

@app.get("/api/actuators/log")
def actuator_log():
    """Histórico de comandos enviados aos actuadores (LED, buzzer, AC, portas)."""
    zone_id = request.args.get("zone_id")
    limit   = int(request.args.get("limit", 30))
    return jsonify(actuators.get_log(limit))

@app.get("/api/actuators/state/<zone_id>")
def actuator_state(zone_id):
    """Estado actual dos actuadores de uma zona."""
    return jsonify(actuators.get_zone_state(zone_id))

@app.post("/api/actuators/command")
def send_actuator_command():
    """Enviar comando manual a um actuador (via MQTT no hardware real)."""
    data = request.get_json(force=True, silent=True) or {}
    required = {"zone_id", "actuator", "command"}
    if not required.issubset(data):
        return jsonify({"error": f"Campos obrigatórios: {required}"}), 400
    cmd = {**data, "timestamp": datetime.utcnow().isoformat(),
           "topic": f"campus/IPH/{data['zone_id']}/actuator/{data['actuator']}",
           "reason": data.get("reason", "Comando manual via API")}
    actuators.ACTUATOR_LOG.appendleft(cmd)
    database.save_actuator_command(cmd)
    broadcast({"type": "actuator_command", "command": cmd})
    return jsonify({"status": "ok", "command": cmd})


# ---------------------------------------------------------------------------
# REST — Base de Dados / Persistência
# ---------------------------------------------------------------------------

@app.get("/api/db/summary")
def db_summary():
    """Estado e resumo da base de dados Supabase."""
    return jsonify(database.db_summary())

@app.get("/api/db/history/<zone_id>")
def db_history(zone_id):
    """Histórico persistente de uma zona (vem do Supabase, não da memória)."""
    limit = int(request.args.get("limit", 100))
    data  = database.get_zone_history(zone_id, limit)
    return jsonify(data if data else list(store.HISTORY[zone_id]))

@app.get("/api/db/alerts")
def db_alerts():
    data = database.get_recent_alerts(20)
    return jsonify(data if data else list(store.ALERTS))

@app.get("/api/db/actuators")
def db_actuators():
    zone_id = request.args.get("zone_id")
    data    = database.get_actuator_history(zone_id, 30)
    return jsonify(data)


@app.get("/api/student/free-rooms")
def free_rooms():
    rooms = [{"free_seats": z.capacity-z.current_count, **store.zone_to_dict(z)}
             for z in store.ZONES.values() if z.zone_type=="classroom" and z.occupancy_percent<30]
    return jsonify(sorted(rooms, key=lambda x: x["occupancy_percent"]))


# ---------------------------------------------------------------------------
# Ponto de entrada
# ---------------------------------------------------------------------------

# Catch-all para servir o React SPA em produção
if _STATIC.exists():
    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_spa(path):
        full = _STATIC / path
        if path and full.exists():
            return send_from_directory(str(_STATIC), path)
        return send_from_directory(str(_STATIC), "index.html")


if __name__ == "__main__":
    print("=" * 60)
    print("  ATS-UMN Presence System v2.0 — Multi-Entity Monitoring")
    print("  Instituto Politécnico da Huíla | UMN — Lubango, Angola")
    print(f"  Zonas: {len(store.ZONES)} | Entidades: pessoas, veículos, animais, equipamentos")
    print("  http://localhost:8000/api/health")
    print("=" * 60)
    host = os.getenv("FLASK_HOST", "0.0.0.0")
    port = int(os.getenv("FLASK_PORT", "8000"))
    app.run(host=host, port=port, threaded=True, debug=False)
