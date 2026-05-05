/**
 * Firmware ESP32 — ATS-UMN Presence System
 * Instituto Politécnico da Huíla (IPH) | Universidade Mandume ya Ndemufayo
 *
 * UC: Sistemas Embebidos e IoT
 * Unidade 2 — Nós Sensores e Actuadores | Protocolo: MQTT + HTTP
 * Unidade 3 — Aquisição e Processamento de Dados em Tempo Real
 *
 * Hardware necessário:
 *   • ESP32 DevKit v1 (ou equivalente)
 *   • Sensor PIR HC-SR501 (detecção de movimento / presença)
 *   • Sensor DHT22 (temperatura e humidade)
 *   • Sensor MQ-135 (qualidade do ar / CO₂ aproximado)
 *   • LED RGB (actuador: indicador visual de ocupação)
 *   • Buzzer passivo (actuador: alarme de lotação)
 *
 * Ligações:
 *   PIR DATA     → GPIO 14
 *   DHT22 DATA   → GPIO 15
 *   MQ-135 AOUT  → GPIO 34 (ADC)
 *   LED Vermelho → GPIO 25
 *   LED Verde    → GPIO 26
 *   LED Azul     → GPIO 27
 *   Buzzer       → GPIO 32
 *
 * Protocolo: publica em MQTT (broker: IP do servidor)
 * Tópicos:
 *   campus/IPH/<zone_id>/sensor/presence  → { count, sensor_id, timestamp }
 *   campus/IPH/<zone_id>/sensor/env       → { temperature, humidity, co2_ppm }
 *   campus/IPH/<zone_id>/actuator/led     → subscreve (recebe comandos)
 *   campus/IPH/<zone_id>/actuator/buzzer  → subscreve (recebe comandos)
 */

#include <WiFi.h>
#include <PubSubClient.h>   // instalar via Library Manager
#include <DHT.h>            // instalar via Library Manager: DHT sensor library by Adafruit
#include <ArduinoJson.h>    // instalar via Library Manager
#include <time.h>

// ── Configuração ──────────────────────────────────────────────────────────
const char* WIFI_SSID     = "IPH-Campus-WiFi";    // SSID da rede do campus
const char* WIFI_PASSWORD = "iph2024umn";          // Palavra-passe
const char* MQTT_BROKER   = "192.168.1.100";       // IP do servidor ATS-UMN
const int   MQTT_PORT     = 1883;
const char* ZONE_ID       = "sala_14";             // Alterar por zona
const char* SENSOR_ID     = "ESP32-A1";            // ID único deste nó
const char* DEVICE_NAME   = "ESP32-Sala1.4-IPH";

// ── Pinos ────────────────────────────────────────────────────────────────
#define PIN_PIR      14
#define PIN_DHT      15
#define PIN_MQ135    34
#define PIN_LED_R    25
#define PIN_LED_G    26
#define PIN_LED_B    27
#define PIN_BUZZER   32

// ── Parâmetros ───────────────────────────────────────────────────────────
#define DHT_TYPE     DHT22
#define READ_INTERVAL_MS   10000   // Enviar leitura a cada 10 segundos
#define PIR_WINDOW_MS      30000   // Janela de contagem PIR: 30 segundos
#define MAX_CAPACITY       40      // Capacidade máxima da zona (Sala 1.4)

DHT dht(PIN_DHT, DHT_TYPE);
WiFiClient   espClient;
PubSubClient mqtt(espClient);

// ── Estado do sensor de presença ─────────────────────────────────────────
volatile int  pirCount    = 0;     // contagens PIR na janela actual
volatile bool pirDetected = false;
unsigned long lastWindow  = 0;
int currentCount          = 0;

// ── Tópicos MQTT ─────────────────────────────────────────────────────────
char topicPresence[80];
char topicEnv[80];
char topicActuatorLed[80];
char topicActuatorBuzzer[80];
char topicStatus[80];

// ── ISR do sensor PIR ────────────────────────────────────────────────────
void IRAM_ATTR onPIRTrigger() {
  pirDetected = true;
  pirCount++;
}

// ── Conexão Wi-Fi ────────────────────────────────────────────────────────
void connectWiFi() {
  Serial.print("[WiFi] A conectar a ");
  Serial.print(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Conectado! IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\n[WiFi] FALHA — operação offline");
  }
}

// ── Callback MQTT — receber comandos de actuadores ───────────────────────
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String msg = "";
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];
  msg.trim();

  Serial.println("[MQTT] Comando recebido: " + String(topic) + " → " + msg);

  if (String(topic) == topicActuatorLed) {
    // Comandos: "red", "green", "blue", "yellow", "off"
    if (msg == "red")    { digitalWrite(PIN_LED_R, HIGH); digitalWrite(PIN_LED_G, LOW);  digitalWrite(PIN_LED_B, LOW);  }
    if (msg == "green")  { digitalWrite(PIN_LED_R, LOW);  digitalWrite(PIN_LED_G, HIGH); digitalWrite(PIN_LED_B, LOW);  }
    if (msg == "yellow") { digitalWrite(PIN_LED_R, HIGH); digitalWrite(PIN_LED_G, HIGH); digitalWrite(PIN_LED_B, LOW);  }
    if (msg == "blue")   { digitalWrite(PIN_LED_R, LOW);  digitalWrite(PIN_LED_G, LOW);  digitalWrite(PIN_LED_B, HIGH); }
    if (msg == "off")    { digitalWrite(PIN_LED_R, LOW);  digitalWrite(PIN_LED_G, LOW);  digitalWrite(PIN_LED_B, LOW);  }
  }

  if (String(topic) == topicActuatorBuzzer) {
    if (msg == "beep") {
      // Dois bips curtos — alerta de lotação
      for (int i = 0; i < 2; i++) {
        tone(PIN_BUZZER, 1000, 200);
        delay(400);
      }
    }
    if (msg == "alarm") {
      // Alarme contínuo 2s — capacidade crítica
      tone(PIN_BUZZER, 880, 2000);
    }
    if (msg == "off") noTone(PIN_BUZZER);
  }
}

// ── Reconexão MQTT ───────────────────────────────────────────────────────
void connectMQTT() {
  while (!mqtt.connected()) {
    Serial.print("[MQTT] A conectar ao broker " + String(MQTT_BROKER) + "...");
    if (mqtt.connect(DEVICE_NAME)) {
      Serial.println(" conectado!");
      // Subscrever tópicos de actuadores
      mqtt.subscribe(topicActuatorLed);
      mqtt.subscribe(topicActuatorBuzzer);
      // Publicar status online
      mqtt.publish(topicStatus, "{\"status\":\"online\"}", true);
    } else {
      Serial.print(" falhou (rc=" + String(mqtt.state()) + "). Tentando em 5s...");
      delay(5000);
    }
  }
}

// ── Ler CO₂ aproximado do MQ-135 ─────────────────────────────────────────
int readCO2() {
  int raw = analogRead(PIN_MQ135);  // 0-4095 no ESP32
  // Calibração simplificada: 400 ppm base, sobe com tensão do sensor
  // Calibração real requer curva de resposta do MQ-135 em ambiente controlado
  float voltage = raw / 4095.0 * 3.3;
  int co2_approx = (int)(400 + (voltage - 0.4) * 800);  // linear aproximado
  return constrain(co2_approx, 400, 5000);
}

// ── LED de estado de ocupação ─────────────────────────────────────────────
void updateLED(int count, int capacity) {
  float pct = (float)count / capacity * 100.0;
  if (pct >= 95)       { digitalWrite(PIN_LED_R, HIGH); digitalWrite(PIN_LED_G, LOW);  digitalWrite(PIN_LED_B, LOW);  } // Vermelho
  else if (pct >= 75)  { digitalWrite(PIN_LED_R, HIGH); digitalWrite(PIN_LED_G, HIGH); digitalWrite(PIN_LED_B, LOW);  } // Amarelo
  else if (pct >= 40)  { digitalWrite(PIN_LED_R, LOW);  digitalWrite(PIN_LED_G, LOW);  digitalWrite(PIN_LED_B, HIGH); } // Azul
  else                 { digitalWrite(PIN_LED_R, LOW);  digitalWrite(PIN_LED_G, HIGH); digitalWrite(PIN_LED_B, LOW);  } // Verde
}

// ── Publicar leitura de presença ─────────────────────────────────────────
void publishPresence(int count) {
  StaticJsonDocument<200> doc;
  doc["zone_id"]   = ZONE_ID;
  doc["count"]     = count;
  doc["sensor_id"] = SENSOR_ID;
  doc["capacity"]  = MAX_CAPACITY;

  // Timestamp ISO 8601 (requer sincronização NTP)
  struct tm timeinfo;
  if (getLocalTime(&timeinfo)) {
    char ts[30];
    strftime(ts, sizeof(ts), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
    doc["timestamp"] = ts;
  }

  char buf[256];
  serializeJson(doc, buf);
  mqtt.publish(topicPresence, buf);
  Serial.println("[MQTT] Presença publicada: " + String(buf));
}

// ── Publicar dados ambientais ─────────────────────────────────────────────
void publishEnvironment() {
  float temp = dht.readTemperature();
  float hum  = dht.readHumidity();
  int   co2  = readCO2();

  if (isnan(temp) || isnan(hum)) {
    Serial.println("[DHT] Erro de leitura");
    return;
  }

  StaticJsonDocument<200> doc;
  doc["zone_id"]     = ZONE_ID;
  doc["temperature"] = round(temp * 10) / 10.0;
  doc["humidity"]    = round(hum  * 10) / 10.0;
  doc["co2_ppm"]     = co2;
  doc["sensor_id"]   = SENSOR_ID;

  char buf[256];
  serializeJson(doc, buf);
  mqtt.publish(topicEnv, buf);
  Serial.println("[MQTT] Ambiente publicado: T=" + String(temp,1) + "°C H=" + String(hum,1) + "% CO2=" + String(co2) + "ppm");
}

// ── Setup ─────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  Serial.println("\n=== ATS-UMN Sensor Node | IPH/UMN ===");
  Serial.println("Zona: " + String(ZONE_ID) + " | Sensor: " + SENSOR_ID);

  // GPIO
  pinMode(PIN_PIR,     INPUT);
  pinMode(PIN_LED_R,   OUTPUT);
  pinMode(PIN_LED_G,   OUTPUT);
  pinMode(PIN_LED_B,   OUTPUT);
  pinMode(PIN_BUZZER,  OUTPUT);
  pinMode(PIN_MQ135,   INPUT);

  // Indicar arranque (LED branco por 1s)
  digitalWrite(PIN_LED_R, HIGH); digitalWrite(PIN_LED_G, HIGH); digitalWrite(PIN_LED_B, HIGH);
  delay(1000);
  digitalWrite(PIN_LED_R, LOW);  digitalWrite(PIN_LED_G, LOW);  digitalWrite(PIN_LED_B, LOW);

  dht.begin();

  // Construir tópicos MQTT
  snprintf(topicPresence,       sizeof(topicPresence),       "campus/IPH/%s/sensor/presence", ZONE_ID);
  snprintf(topicEnv,            sizeof(topicEnv),            "campus/IPH/%s/sensor/env",      ZONE_ID);
  snprintf(topicActuatorLed,    sizeof(topicActuatorLed),    "campus/IPH/%s/actuator/led",    ZONE_ID);
  snprintf(topicActuatorBuzzer, sizeof(topicActuatorBuzzer), "campus/IPH/%s/actuator/buzzer", ZONE_ID);
  snprintf(topicStatus,         sizeof(topicStatus),         "campus/IPH/%s/status",          ZONE_ID);

  // ISR do PIR
  attachInterrupt(digitalPinToInterrupt(PIN_PIR), onPIRTrigger, RISING);

  connectWiFi();

  // Sincronizar relógio NTP
  configTime(3600, 0, "pool.ntp.org");  // UTC+1 Angola (WAT)

  mqtt.setServer(MQTT_BROKER, MQTT_PORT);
  mqtt.setCallback(mqttCallback);
  connectMQTT();

  lastWindow = millis();
  Serial.println("[OK] Nó sensor iniciado. A monitorizar...\n");
}

// ── Loop principal ────────────────────────────────────────────────────────
void loop() {
  if (!mqtt.connected()) connectMQTT();
  mqtt.loop();

  unsigned long now = millis();

  // Janela de contagem: a cada READ_INTERVAL_MS, calcula ocupação e publica
  if (now - lastWindow >= READ_INTERVAL_MS) {
    // Modelo simplificado: cada disparo PIR numa janela = 1 pessoa entrando/presente
    // Em sistema real: instalar sensores de barreira bidireccional (entrada - saída)
    currentCount = constrain(currentCount + pirCount - (pirCount / 3), 0, MAX_CAPACITY);
    pirCount  = 0;
    lastWindow = now;

    publishPresence(currentCount);
    publishEnvironment();
    updateLED(currentCount, MAX_CAPACITY);

    // Buzzer se capacidade crítica
    if (currentCount >= MAX_CAPACITY) {
      tone(PIN_BUZZER, 1000, 300);
    }
  }

  delay(50);  // Yield para o watchdog do ESP32
}
