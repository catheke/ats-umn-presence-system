# Guia de Instalação — ATS-UMN Presence System v2.0
**Instituto Politécnico da Huíla (IPH) | Universidade Mandume ya Ndemufayo**
Lubango, Angola

---

## Requisitos do Sistema

| Software | Versão mínima | Como verificar |
|---|---|---|
| Python | 3.11+ | `python3 --version` |
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| Git | qualquer | `git --version` |

> **Nota:** O sistema foi desenvolvido e testado com Python 3.14 e Node.js 20.

---

## Instalação Rápida (Linux / macOS)

```bash
# 1. Clonar / copiar o projecto
cd ats-umn-presence-system

# 2. Dar permissão ao script
chmod +x setup.sh

# 3. Executar (instala tudo e arranca os serviços)
./setup.sh
```

Abrir no browser: **http://localhost:3000**

---

## Instalação no Windows

```powershell
cd ats-umn-presence-system
python start.py
```

---

## Instalação Manual (passo a passo)

### Passo 1 — Clonar o projecto

```bash
git clone <url-do-repositório>
cd ats-umn-presence-system
```

Ou descomprimir o `.zip` e entrar na pasta.

---

### Passo 2 — Configurar o Backend (Python)

```bash
cd backend

# Criar ambiente virtual isolado
python3 -m venv .venv

# Activar o ambiente virtual
# Linux / macOS:
source .venv/bin/activate
# Windows:
.venv\Scripts\activate

# Instalar todas as dependências
pip install -r requirements.txt

# Verificar instalação
python3 -c "import flask, flask_sock, httpx, paho.mqtt.client, amqtt; print('OK')"
```

---

### Passo 3 — Configurar variáveis de ambiente

O ficheiro `.env` já está incluído com as credenciais do Supabase:

```bash
# backend/.env (já existe no projecto)
SUPABASE_URL=https://pidxcusgbdkgbfmsggww.supabase.co
SUPABASE_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> Se quiser usar o **seu próprio projecto Supabase**, crie um novo projecto em
> [supabase.com](https://supabase.com), execute o SQL em `docs/schema.sql`
> e actualize o `.env` com a sua URL e chave anon.

---

### Passo 4 — Configurar o Frontend (Node.js)

```bash
cd frontend

# Instalar dependências JavaScript
npm install

# Verificar instalação
npm list react vite tailwindcss recharts lucide-react
```

---

### Passo 5 — Instalar dependências do Simulador

```bash
cd simulator

# Usar o mesmo venv do backend
source ../backend/.venv/bin/activate   # Linux/macOS
# ..\backend\.venv\Scripts\activate   # Windows

pip install -r requirements.txt
```

---

### Passo 6 — Arrancar os serviços

Abrir **4 terminais** separados:

**Terminal 1 — MQTT Broker:**
```bash
cd backend
source .venv/bin/activate
python3 mqtt_broker.py
# → Broker MQTT iniciado em mqtt://0.0.0.0:1883
```

**Terminal 2 — Backend API:**
```bash
cd backend
source .venv/bin/activate
python3 main.py
# → API disponível em http://localhost:8000
```

**Terminal 3 — Simulador IoT:**
```bash
cd simulator
source ../backend/.venv/bin/activate
python3 simulator.py
# → A enviar dados a cada 4 segundos
```

**Terminal 4 — Frontend:**
```bash
cd frontend
npm run dev
# → Dashboard em http://localhost:3000
```

---

## Verificar que tudo está a funcionar

```bash
# Backend (deve responder com status: healthy)
curl http://localhost:8000/api/health

# Zonas monitorizadas
curl http://localhost:8000/api/stats

# Estado do Supabase
curl http://localhost:8000/api/db/summary

# Actuadores activos
curl http://localhost:8000/api/actuators/log
```

---

## Estrutura de portas

| Serviço | Porta | Protocolo |
|---|---|---|
| Frontend (Vite) | 3000 | HTTP |
| Backend (Flask) | 8000 | HTTP + WebSocket |
| MQTT Broker | 1883 | MQTT 3.1.1 |
| Supabase | nuvem | HTTPS |

---

## Dependências completas

### Python (backend + simulador)

| Pacote | Versão | Função |
|---|---|---|
| Flask | 3.1.3 | Framework HTTP |
| flask-sock | 0.7.0 | WebSocket em tempo real |
| httpx | 0.28.1 | Cliente HTTP (Supabase) |
| paho-mqtt | 2.1.0 | Cliente MQTT IoT |
| amqtt | 0.11.3 | Broker MQTT embebido |
| python-dotenv | 1.2.2 | Variáveis de ambiente |
| Werkzeug | 3.1.8 | WSGI (Flask) |
| PyYAML | 6.0.2 | Config MQTT |
| passlib | 1.7.4 | Auth MQTT |
| anyio | 4.13.0 | Async I/O |
| certifi | 2026.4.22 | Certificados SSL |

### JavaScript (frontend)

| Pacote | Versão | Função |
|---|---|---|
| react | 18.3.1 | Interface reativa |
| react-dom | 18.3.1 | Renderização |
| recharts | 2.13.3 | Gráficos e charts |
| lucide-react | 0.462.0 | Ícones SVG |
| vite | 5.4.10 | Build / dev server |
| tailwindcss | 3.4.14 | Estilização CSS |
| @vitejs/plugin-react | 4.3.3 | Plugin React para Vite |
| autoprefixer | 10.4.20 | CSS prefixes |
| postcss | 8.4.47 | Transformação CSS |

---

## Base de Dados Supabase

O projecto usa o Supabase **cantina-previsao** já configurado.

Tabelas criadas automaticamente:

| Tabela | Conteúdo |
|---|---|
| `readings` | Leituras dos sensores (presença + ambiente) |
| `alerts` | Alertas de capacidade e qualidade do ar |
| `incidents` | Incidentes: animais, presença fora de horas |
| `actuator_log` | Histórico de comandos enviados aos actuadores |

Vistas disponíveis:
- `hourly_patterns` — padrões de ocupação por hora do dia
- `zone_latest` — última leitura de cada zona
- `daily_stats` — estatísticas diárias por zona

---

## Hardware Real (ESP32)

Para substituir o simulador por sensores reais:

1. Abrir `firmware/esp32_sensor/esp32_sensor.ino` no **Arduino IDE**
2. Instalar bibliotecas: `PubSubClient`, `DHT sensor library`, `ArduinoJson`
3. Editar no ficheiro:
   ```cpp
   const char* WIFI_SSID  = "nome-da-rede-wifi";
   const char* WIFI_PASSWORD = "senha-wifi";
   const char* MQTT_BROKER   = "IP-do-servidor";  // IP do PC onde corre o backend
   const char* ZONE_ID       = "sala_14";          // ID da zona a monitorizar
   ```
4. Carregar o firmware para o ESP32
5. O ESP32 publica automaticamente em `campus/IPH/<zone_id>/sensor/presence`

**Hardware necessário por nó sensor:**
- ESP32 DevKit v1
- Sensor PIR HC-SR501
- Sensor DHT22 (temperatura + humidade)
- Sensor MQ-135 (CO₂ aproximado)
- LED RGB (cátodo comum)
- Buzzer passivo
- Resistências 220Ω (x3 para o LED)

---

## Resolução de Problemas

| Problema | Solução |
|---|---|
| `pip install` falha com erro de compilação | Use Python 3.11 ou 3.12 (mais estável para wheels binários) |
| Porta 8000 já em uso | `fuser -k 8000/tcp` (Linux) ou `netstat -ano \| findstr 8000` (Windows) |
| Frontend não liga ao backend | Verificar que o backend está em `http://localhost:8000` |
| Supabase sem dados | Verificar chave API no `.env` — deve começar por `eyJ...` |
| MQTT broker não arranca | `pip install amqtt` e tentar novamente |
| `ModuleNotFoundError` | Activar o venv: `source backend/.venv/bin/activate` |

---

## Contacto e Suporte

**UC:** Sistemas Embebidos e IoT
**Instituição:** Instituto Politécnico da Huíla — Universidade Mandume ya Ndemufayo
**Local:** Lubango, Província da Huíla, Angola

Fonte institucional: [umn.edu.ao](https://umn.edu.ao)
