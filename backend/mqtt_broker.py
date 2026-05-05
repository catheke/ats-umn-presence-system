"""
Broker MQTT Embebido — ATS-UMN Presence System
Instituto Politécnico da Huíla (IPH) | Universidade Mandume ya Ndemufayo

UC: Sistemas Embebidos e IoT — Unidade 2: Protocolos de Comunicação IoT

Utiliza amqtt (broker MQTT asyncio puro Python) — sem dependências C.
Escuta na porta 1883 (MQTT standard).

Tópicos geridos:
  campus/IPH/<zone_id>/sensor/presence  — leituras de presença dos sensores
  campus/IPH/<zone_id>/sensor/env       — dados ambientais (temp, CO₂, humidade)
  campus/IPH/<zone_id>/actuator/led     — comandos para LEDs indicadores
  campus/IPH/<zone_id>/actuator/buzzer  — comandos para buzzer de alerta
  campus/IPH/<zone_id>/status           — estado online/offline do nó sensor

Fluxo:
  ESP32/Simulador → MQTT publish → Este broker → MQTT subscriber (backend) → API REST interna
"""

import asyncio
import json
import logging
from datetime import datetime
import httpx

try:
    from amqtt.broker import Broker
    from amqtt.client import MQTTClient, ConnectException
    AMQTT_OK = True
except ImportError:
    AMQTT_OK = False

logging.basicConfig(level=logging.WARNING)

BACKEND_URL   = "http://localhost:8000"
BROKER_CONFIG = {
    "listeners": {
        "default": {"type": "tcp", "bind": "0.0.0.0:1883"},
    },
    "sys_interval": 0,
    "auth": {"allow-anonymous": True},
    "topic-check": {"enabled": False},
}


# ── Subscriber — processa mensagens dos sensores ─────────────────────────

async def subscribe_and_forward():
    """
    Subscreve os tópicos dos sensores e reencaminha para a API REST interna.
    Também processa tópicos de actuadores e envia comandos de volta.
    """
    await asyncio.sleep(2)  # Aguardar broker ficar pronto

    client = MQTTClient(client_id="ats-umn-backend-subscriber")
    try:
        await client.connect("mqtt://localhost:1883/")
        print("[MQTT-SUB] Conectado ao broker interno")
    except Exception as e:
        print(f"[MQTT-SUB] Falha ao conectar: {e}")
        return

    # Subscrever todos os tópicos dos sensores IPH
    await client.subscribe([
        ("campus/IPH/+/sensor/presence", 0),  # leituras de presença
        ("campus/IPH/+/sensor/env",      0),  # dados ambientais
        ("campus/IPH/+/status",          0),  # estado dos nós
    ])
    print("[MQTT-SUB] A subscrever: campus/IPH/+/sensor/# e /status")

    async with httpx.AsyncClient() as http:
        while True:
            try:
                msg = await asyncio.wait_for(client.deliver_message(), timeout=5.0)
                if not msg:
                    continue

                topic   = msg.topic
                payload = msg.data.decode("utf-8", errors="ignore")
                parts   = topic.split("/")  # campus/IPH/<zone_id>/sensor/<type>

                if len(parts) < 4:
                    continue

                zone_id = parts[2]

                # ── Leitura de presença ──────────────────────────────────
                if "sensor/presence" in topic:
                    try:
                        data = json.loads(payload)
                        count = int(data.get("count", 0))
                        await http.post(
                            f"{BACKEND_URL}/api/reading",
                            json={
                                "zone_id":   zone_id,
                                "count":     count,
                                "sensor_id": data.get("sensor_id", f"MQTT-{zone_id}"),
                                "timestamp": data.get("timestamp", datetime.utcnow().isoformat()),
                            },
                            timeout=3.0,
                        )
                        print(f"[MQTT→HTTP] {zone_id}: {count} pessoas")
                    except Exception as e:
                        print(f"[MQTT-SUB] Erro ao processar presença {zone_id}: {e}")

                # ── Dados ambientais ─────────────────────────────────────
                elif "sensor/env" in topic:
                    try:
                        data = json.loads(payload)
                        await http.post(
                            f"{BACKEND_URL}/api/reading",
                            json={
                                "zone_id":     zone_id,
                                "count":       0,   # env-only update
                                "sensor_id":   data.get("sensor_id", f"ENV-{zone_id}"),
                                "temperature": data.get("temperature"),
                                "humidity":    data.get("humidity"),
                                "co2_ppm":     data.get("co2_ppm"),
                                "timestamp":   datetime.utcnow().isoformat(),
                            },
                            timeout=3.0,
                        )
                        print(f"[MQTT→HTTP] Env {zone_id}: T={data.get('temperature')}°C CO₂={data.get('co2_ppm')}ppm")
                    except Exception as e:
                        print(f"[MQTT-SUB] Erro ao processar env {zone_id}: {e}")

                # ── Estado do nó sensor ──────────────────────────────────
                elif "/status" in topic:
                    print(f"[MQTT] Nó {zone_id}: {payload}")

            except asyncio.TimeoutError:
                pass
            except Exception as e:
                print(f"[MQTT-SUB] Erro inesperado: {e}")
                await asyncio.sleep(1)


# ── Actuator Manager — envia comandos de volta aos sensores ─────────────

async def actuator_manager():
    """
    Publica comandos de actuadores nos tópicos MQTT correspondentes.
    O ESP32 subscreve estes tópicos e acciona LED/buzzer.
    Chama-se de outros módulos via fila asyncio.
    """
    # Esta função pode ser expandida para receber comandos da API e publicar via MQTT
    pass


# ── Ponto de entrada — iniciar broker + subscriber ───────────────────────

async def main():
    if not AMQTT_OK:
        print("[MQTT] amqtt não disponível — instale com: pip install amqtt")
        return

    print("=" * 56)
    print("  ATS-UMN MQTT Broker — porta 1883")
    print("  Protocolo: MQTT 3.1.1 (amqtt)")
    print("  Instituto Politécnico da Huíla | UMN")
    print("=" * 56)

    broker = Broker(BROKER_CONFIG)
    await broker.start()
    print("[MQTT-Broker] Broker iniciado em mqtt://0.0.0.0:1883")

    # Executar subscriber em paralelo com o broker
    await asyncio.gather(
        subscribe_and_forward(),
        actuator_manager(),
    )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[MQTT-Broker] Encerrado.")
