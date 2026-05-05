# ATS-UMN Presence System
### Sistema de Monitorização de Presença Inteligente
**Instituto Politécnico da Huíla (IPH) · Universidade Mandume ya Ndemufayo**
Lubango, Província da Huíla, Angola

---

## Visão Geral

O **ATS-UMN Presence System** é uma plataforma de monitorização de presença em tempo real desenvolvida para o campus do Instituto Politécnico da Huíla (IPH/UMN). O sistema acompanha a ocupação de 10 zonas do campus — salas de aula, laboratórios, refeitório, biblioteca e auditório — e apresenta os dados num dashboard web interativo atualizado em tempo real via WebSocket.

> **Contexto Académico:** Desenvolvido no âmbito da UC *Sistemas Embebidos e IoT* (Unidade 2: Protocolos de Comunicação; Unidade 3: Aquisição e Processamento de Dados em Tempo Real).

---

## Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────┐
│                    ATS-UMN ARCHITECTURE                  │
│                                                         │
│  ┌──────────────┐     HTTP POST      ┌───────────────┐  │
│  │  SIMULADOR   │ ──────────────────▶│   BACKEND     │  │
│  │  (Python)    │   /api/reading     │  (FastAPI)    │  │
│  │              │                    │               │  │
│  │ Simula:      │                    │  • REST API   │  │
│  │ • ESP32      │◀── (futuro MQTT) ──│  • WebSocket  │  │
│  │ • Arduino    │                    │  • In-memory  │  │
│  │ • Sensores   │                    │    store      │  │
│  │   PIR/IR     │                    └──────┬────────┘  │
│  └──────────────┘                           │WS push    │
│                                             ▼           │
│                                    ┌───────────────┐    │
│                                    │   FRONTEND    │    │
│                                    │  (React/Vite) │    │
│                                    │               │    │
│                                    │  • Mapa SVG   │    │
│                                    │  • ZoneCards  │    │
│                                    │  • Gráficos   │    │
│                                    │  • Alertas    │    │
│                                    └───────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### Fluxo de Dados
1. O **Simulador** gera leituras realistas baseadas no horário académico do IPH
2. Envia via **HTTP POST** para `/api/reading` no Backend
3. O **Backend** atualiza o estado da zona e difunde via **WebSocket** para todos os clientes
4. O **Frontend** recebe a mensagem WS e atualiza o dashboard sem recarregar a página
5. **Alertas automáticos** são gerados quando ocupação ultrapassa 75% ou 100%

---

## Tecnologias

| Camada | Tecnologia | Versão | Papel |
|--------|-----------|--------|-------|
| Backend | Python + FastAPI | 3.11+ / 0.115 | API REST + WebSocket |
| Backend | Uvicorn | 0.30 | Servidor ASGI assíncrono |
| Backend | Pydantic v2 | 2.9 | Validação de dados IoT |
| Frontend | React | 18.3 | Interface reativa |
| Frontend | Vite | 5.4 | Build tool / dev server |
| Frontend | Tailwind CSS | 3.4 | Estilização utilitária |
| Frontend | Recharts | 2.13 | Visualização de dados |
| Simulador | Python + httpx | 3.11+ | Cliente HTTP assíncrono |
| Protocolo | WebSocket (RFC 6455) | — | Comunicação em tempo real |
| Protocolo futuro | MQTT 3.1.1 | — | Para ESP32/Arduino reais |

---

## Zonas Monitorizadas

Baseadas na estrutura real do Campus IPH — Cursos: Eng. Informática, Computação, Eng. Civil, Eng. Mecânica, Eng. Geológica, Zootecnia, Agronomia e Design.

| ID | Zona | Edifício | Capacidade | Tipo |
|----|------|---------|-----------|------|
| `cafeteria` | Refeitório Central | Edifício de Apoio | 180 | Refeitório |
| `sala_14` | Sala 1.4 — Eng. Informática | Bloco A, Piso 1 | 40 | Sala de Aula |
| `sala_15` | Sala 1.5 — Computação | Bloco A, Piso 1 | 40 | Sala de Aula |
| `sala_21` | Sala 2.1 — Eng. Civil | Bloco A, Piso 2 | 45 | Sala de Aula |
| `sala_23` | Sala 2.3 — Eng. Mecânica | Bloco B, Piso 2 | 35 | Sala de Aula |
| `lab_info_1` | Lab. Informática I | Bloco C, Piso 1 | 30 | Laboratório |
| `lab_info_2` | Lab. Informática II | Bloco C, Piso 1 | 30 | Laboratório |
| `biblioteca` | Biblioteca Central | Edifício Biblioteca | 100 | Biblioteca |
| `auditorio` | Auditório Principal | Edifício Central | 300 | Auditório |
| `secretaria` | Secretaria Académica | Edifício Administrativo | 15 | Gabinete |

---

## Limiares de Ocupação

| Status | Percentagem | Cor | Ação |
|--------|------------|-----|------|
| 🟢 Baixa | < 40% | Verde | — |
| 🟡 Média | 40–75% | Amarelo | — |
| 🔴 Alta | 75–100% | Vermelho | Alerta automático |
| 🔴 Lotado | ≥ 100% | Vermelho escuro | Alerta crítico + animação |

---

## Estrutura do Projeto

```
ats-umn-presence-system/
│
├── backend/                    # API FastAPI
│   ├── main.py                 # App principal + WebSocket + rotas REST
│   ├── models.py               # Modelos Pydantic (ZoneData, ZoneReading, etc.)
│   ├── store.py                # Armazenamento em memória + lógica de estado
│   └── requirements.txt
│
├── simulator/                  # Simulador de sensores IoT
│   ├── simulator.py            # Gerador de dados com perfis Gaussianos
│   └── requirements.txt
│
├── frontend/                   # Dashboard React
│   ├── src/
│   │   ├── App.jsx             # Componente raiz + estado global
│   │   ├── hooks/
│   │   │   └── useWebSocket.js # Hook WS com reconexão automática
│   │   └── components/
│   │       ├── Dashboard.jsx   # Layout principal
│   │       ├── Header.jsx      # Barra superior com relógio e stats
│   │       ├── CampusMap.jsx   # Mapa SVG do campus IPH
│   │       ├── ZoneCard.jsx    # Cartão por zona com gauge circular
│   │       ├── OccupancyChart.jsx # Gráficos Recharts (barras + tendência)
│   │       └── AlertBanner.jsx # Sistema de notificações
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
│
├── setup.sh                    # Script de instalação + arranque (Linux/macOS)
├── start.py                    # Alternativa Python (multiplataforma)
└── README.md
```

---

## Instalação e Uso

### Pré-requisitos
- **Python** 3.11 ou superior (`python3 --version`)
- **Node.js** 18 ou superior + **npm** (`node --version`)

### Método 1 — Script automático (recomendado)

```bash
# Linux / macOS
cd ats-umn-presence-system
chmod +x setup.sh
./setup.sh
```

```bash
# Windows / Multiplataforma
cd ats-umn-presence-system
python start.py
```

### Método 2 — Manual (3 terminais separados)

**Terminal 1 — Backend:**
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Terminal 2 — Simulador:**
```bash
cd simulator
# (usar o mesmo venv do backend ou instalar httpx separadamente)
pip install httpx
python3 simulator.py
```

**Terminal 3 — Frontend:**
```bash
cd frontend
npm install
npm run dev
```

### Acesso

| Serviço | URL |
|---------|-----|
| Dashboard | http://localhost:3000 |
| API REST | http://localhost:8000 |
| Documentação API (Swagger) | http://localhost:8000/docs |
| WebSocket | ws://localhost:8000/ws |

---

## API REST — Endpoints Principais

```
GET  /api/zones              → Lista todas as zonas e estado atual
GET  /api/zones/{id}         → Detalhes de uma zona específica
GET  /api/history            → Histórico completo (todas as zonas)
GET  /api/history/{id}       → Histórico de uma zona (últimas 50 leituras)
GET  /api/alerts             → Alertas recentes
GET  /api/stats              → Estatísticas globais do campus
GET  /api/health             → Health check da API
POST /api/reading            → Receber leitura de sensor (body: ZoneReading)
WS   /ws                     → Canal WebSocket em tempo real
```

**Exemplo de leitura de sensor (ESP32 / Arduino / Simulador):**
```json
POST /api/reading
{
  "zone_id": "sala_14",
  "count": 32,
  "sensor_id": "ESP32-A1",
  "temperature": 24.5,
  "timestamp": "2026-04-23T10:30:00"
}
```

---

## Integração com Hardware Real (ESP32 / Arduino)

O sistema foi desenhado para suportar integração futura com microcontroladores (Unidade 2 — Nós Sensores e Actuadores).

**Exemplo de código Arduino/ESP32:**
```cpp
#include <WiFi.h>
#include <HTTPClient.h>

const char* ssid     = "IPH-WiFi";
const char* password = "senha";
const char* endpoint = "http://192.168.1.100:8000/api/reading";

void sendReading(String zoneId, int count) {
  HTTPClient http;
  http.begin(endpoint);
  http.addHeader("Content-Type", "application/json");
  String body = "{\"zone_id\":\"" + zoneId + "\",\"count\":" + count + ",\"sensor_id\":\"ESP32-001\"}";
  int code = http.POST(body);
  http.end();
}
```

Para MQTT (protocolo mais eficiente para IoT), o backend pode ser estendido com `fastapi-mqtt` ou um broker Mosquitto externo.

---

## Padrões de Ocupação Simulados

O simulador usa **distribuições Gaussianas** para modelar comportamentos realistas baseados no horário académico do IPH:

| Zona | Picos de Ocupação |
|------|------------------|
| Refeitório | Pequeno-almoço (07h45), Almoço (12h45), Jantar (19h00) |
| Salas de Aula | 07h30, 09h00, 10h30 (manhã) · 14h00, 15h30 (tarde) · 18h30, 20h00 (noite) |
| Laboratórios | 08h30, 15h00, 19h30 (uso intenso em aulas práticas) |
| Biblioteca | Estável ao longo do dia · pico 16h00 |
| Auditório | Eventos pontuais e esporádicos |
| Secretaria | Expediente: 08h00–17h00 |

---

## Conceitos IoT Implementados

| Conceito | Onde | Referência UC |
|---------|------|--------------|
| Aquisição de Dados | `simulator.py` — geração e envio periódico | Unidade 3 |
| Processamento em Tempo Real | `store.py` — cálculo de status e alertas | Unidade 3 |
| Protocolo HTTP REST | `/api/reading` — ingestão de dados | Unidade 2 |
| Protocolo WebSocket | `/ws` — difusão em tempo real | Unidade 2 |
| Buffer Circular | `deque(maxlen=100)` — histórico por zona | Unidade 3 |
| Modelação de Sensor | Gaussianas + ruído em `simulator.py` | Unidade 2 |
| Limiares e Alertas | `_compute_status()` em `store.py` | Unidade 3 |
| Arquitetura Cliente-Servidor | Backend API + Frontend reativo | Unidade 2 |

---

## Licença e Créditos

Desenvolvido para fins académicos no âmbito da Unidade Curricular **Sistemas Embebidos e IoT**.
Instituto Politécnico da Huíla · Universidade Mandume ya Ndemufayo · Lubango, Angola.

Dados da estrutura do campus: [umn.edu.ao](https://umn.edu.ao/umn/index.php/umn/estrutura)
