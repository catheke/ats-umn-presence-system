#!/usr/bin/env python3
"""
start.py — Alternativa Python ao setup.sh
ATS-UMN Presence System | Instituto Politécnico da Huíla (IPH/UMN)

Inicia Backend, Simulador e Frontend em paralelo com gestão de processos.
Compatível com Windows, Linux e macOS.
"""

import subprocess
import sys
import os
import time
import signal
import urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR  = os.path.join(ROOT, "backend")
SIM_DIR      = os.path.join(ROOT, "simulator")
FRONTEND_DIR = os.path.join(ROOT, "frontend")

BLUE   = "\033[34m"
GREEN  = "\033[32m"
YELLOW = "\033[33m"
RED    = "\033[31m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

processes = []


def header():
    print(f"\n{BLUE}{BOLD}{'═'*58}{RESET}")
    print(f"{BLUE}{BOLD}  ATS-UMN Presence System{RESET}")
    print(f"{BLUE}  Instituto Politécnico da Huíla · UMN · Lubango, Angola{RESET}")
    print(f"{BLUE}{BOLD}{'═'*58}{RESET}\n")


def check_command(cmd):
    try:
        subprocess.run([cmd, "--version"], capture_output=True, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def install_backend_deps():
    print(f"{BOLD}[1/3] Instalando dependências do Backend...{RESET}")
    venv_dir = os.path.join(BACKEND_DIR, ".venv")
    if not os.path.exists(venv_dir):
        subprocess.run([sys.executable, "-m", "venv", venv_dir], check=True)

    pip = os.path.join(venv_dir, "bin", "pip") if sys.platform != "win32" else os.path.join(venv_dir, "Scripts", "pip")
    subprocess.run([pip, "install", "-q", "-r", os.path.join(BACKEND_DIR, "requirements.txt")], check=True)
    subprocess.run([pip, "install", "-q", "-r", os.path.join(SIM_DIR, "requirements.txt")], check=True)
    print(f"{GREEN}  ✓ Python deps instalados{RESET}")


def install_frontend_deps():
    print(f"{BOLD}[2/3] Instalando dependências do Frontend...{RESET}")
    if not os.path.exists(os.path.join(FRONTEND_DIR, "node_modules")):
        subprocess.run(["npm", "install"], cwd=FRONTEND_DIR, capture_output=True)
    print(f"{GREEN}  ✓ Node deps instalados{RESET}")


def wait_for_backend(timeout=30):
    print("  Aguardando backend ficar pronto", end="", flush=True)
    for _ in range(timeout * 2):
        try:
            urllib.request.urlopen("http://localhost:8000/api/health", timeout=1)
            print(f" {GREEN}pronto!{RESET}")
            return True
        except Exception:
            print(".", end="", flush=True)
            time.sleep(0.5)
    print(f" {RED}timeout!{RESET}")
    return False


def start_services():
    venv_python = (
        os.path.join(BACKEND_DIR, ".venv", "bin", "python")
        if sys.platform != "win32"
        else os.path.join(BACKEND_DIR, ".venv", "Scripts", "python")
    )

    print(f"\n{BOLD}[3/3] Iniciando os serviços...{RESET}\n")

    # Backend
    backend = subprocess.Popen(
        [venv_python, "-m", "uvicorn", "main:app",
         "--host", "0.0.0.0", "--port", "8000", "--log-level", "warning"],
        cwd=BACKEND_DIR,
    )
    processes.append(backend)

    if not wait_for_backend():
        terminate_all()
        sys.exit(1)

    # Simulador
    sim = subprocess.Popen([venv_python, "simulator.py"], cwd=SIM_DIR)
    processes.append(sim)

    # Frontend
    frontend = subprocess.Popen(["npm", "run", "dev"], cwd=FRONTEND_DIR)
    processes.append(frontend)

    print(f"\n{GREEN}{BOLD}  Sistema iniciado!{RESET}")
    print(f"  Dashboard → {BLUE}http://localhost:3000{RESET}")
    print(f"  API Docs  → {BLUE}http://localhost:8000/docs{RESET}")
    print(f"\n{YELLOW}  Pressione Ctrl+C para encerrar.{RESET}\n")


def terminate_all():
    for p in processes:
        try:
            p.terminate()
        except Exception:
            pass
    for p in processes:
        try:
            p.wait(timeout=5)
        except Exception:
            p.kill()


def main():
    header()

    # Verificar dependências
    for cmd in ["python3", "node", "npm"]:
        if not check_command(cmd):
            print(f"{RED}✗ '{cmd}' não encontrado. Instale-o e tente novamente.{RESET}")
            sys.exit(1)

    install_backend_deps()
    install_frontend_deps()
    start_services()

    def handle_exit(sig, frame):
        print(f"\n{YELLOW}  Encerrando todos os serviços...{RESET}")
        terminate_all()
        sys.exit(0)

    signal.signal(signal.SIGINT,  handle_exit)
    signal.signal(signal.SIGTERM, handle_exit)

    # Manter processo principal vivo, monitorar filhos
    while True:
        for p in processes:
            if p.poll() is not None:
                print(f"{YELLOW}  Processo {p.pid} encerrou inesperadamente.{RESET}")
        time.sleep(5)


if __name__ == "__main__":
    main()
