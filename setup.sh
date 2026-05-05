#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════
# setup.sh — ATS-UMN Presence System v2.0
# Instituto Politécnico da Huíla (IPH) | Universidade Mandume ya Ndemufayo
# ══════════════════════════════════════════════════════════════════════
# Instala dependências e arranca TODOS os serviços:
#   1. Backend  — Flask + WebSocket (porta 8000)
#   2. Frontend — Vite + React      (porta 3000)
#   3. Simulador — Multi-entidade   (HTTP a cada 4s)
# Base de dados: Supabase PostgreSQL (nuvem — sem instalação local)
# ══════════════════════════════════════════════════════════════════════

set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
B="\033[1m"; C="\033[36m"; G="\033[32m"; Y="\033[33m"; R="\033[31m"; X="\033[0m"

echo -e "\n${C}${B}══════════════════════════════════════════════════════════${X}"
echo -e "${C}${B}  ATS-UMN Presence System v2.0${X}"
echo -e "${C}  Instituto Politécnico da Huíla · UMN · Lubango, Angola${X}"
echo -e "${C}${B}══════════════════════════════════════════════════════════${X}\n"

# ── Carregar nvm se disponível (macOS) ──────────────────────────────
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# ── Verificar dependências ───────────────────────────────────────────
for cmd in python3 node npm; do
  command -v "$cmd" &>/dev/null || { echo -e "${R}✗ '$cmd' não encontrado. Instale Node.js: https://nodejs.org${X}"; exit 1; }
done
echo -e "${G}✓ Python3 ($(python3 --version)) · Node.js $(node --version) · npm $(npm --version)${X}"

# ── Backend: criar venv e instalar deps ─────────────────────────────
echo -e "\n${B}[1/3] Dependências do Backend...${X}"
cd "$ROOT/backend"
[ ! -d ".venv" ] && python3 -m venv .venv
source .venv/bin/activate
pip install -q -r requirements.txt
echo -e "${G}✓ Flask · WebSocket · httpx · paho-mqtt · dotenv${X}"

# ── Frontend: instalar deps ─────────────────────────────────────────
echo -e "\n${B}[2/3] Dependências do Frontend...${X}"
cd "$ROOT/frontend"
[ ! -d "node_modules" ] && npm install --silent
echo -e "${G}✓ React · Vite · Tailwind · Recharts · Lucide${X}"

# ── Cleanup de processos anteriores ─────────────────────────────────
echo -e "\n${B}[3/3] A iniciar serviços...${X}"
# macOS: usar lsof em vez de fuser
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
lsof -ti:1883 | xargs kill -9 2>/dev/null || true

cleanup() {
  echo -e "\n${Y}A encerrar todos os serviços...${X}"
  kill 0 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# ── Activar venv para serviços Python ───────────────────────────────
source "$ROOT/backend/.venv/bin/activate"

# ── Arrancar Backend ─────────────────────────────────────────────────
cd "$ROOT/backend"
python3 main.py &

# Aguardar backend
echo -n "  Aguardando backend"
for i in $(seq 1 30); do
  curl -s http://localhost:8000/api/health >/dev/null 2>&1 && break
  echo -n "." && sleep 0.5
done
echo -e " ${G}pronto!${X}"

# ── Arrancar Simulador ───────────────────────────────────────────────
cd "$ROOT/simulator"
python3 simulator.py &

# ── Arrancar Frontend ────────────────────────────────────────────────
cd "$ROOT/frontend"
npm run dev &

sleep 2
echo -e "\n${G}${B}  ✅ Sistema ATS-UMN v2.0 operacional!${X}"
echo -e ""
echo -e "  ${C}Dashboard     →${X} http://localhost:3000"
echo -e "  ${C}API (Backend) →${X} http://localhost:8000/api/health"
echo -e "  ${C}Supabase BD   →${X} https://pidxcusgbdkgbfmsggww.supabase.co"
echo -e ""
echo -e "  Tabs: Painel Geral · Portal Estudante · Multi-Entidade"
echo -e "        Ambiente · Actuadores · Analytics"
echo -e ""
echo -e "  ${Y}Ctrl+C para encerrar.${X}\n"

wait
