#include <WiFi.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <ESP32Servo.h>
#include <ArduinoJson.h>

// ===================== CONFIGURACIÓN =====================
const char *WIFI_SSID = "RedmiNote14Plus";
const char *WIFI_PASS = "ElSiwardo?";

// Pines BTS7960
constexpr int PIN_R_EN = 27;
constexpr int PIN_L_EN = 26;
constexpr int PIN_R_PWM = 25;
constexpr int PIN_L_PWM = 32;

// Servo
constexpr int SERVO_PIN = 18;
Servo servoMotor;

// Variables
int motorPosition = 90;
int servoPosition = 90;

// Servidor y WebSocket
AsyncWebServer server(80);
AsyncWebSocket ws("/ws");

// ===================== HARDWARE =====================
void setupMotorDriver()
{
    pinMode(PIN_R_EN, OUTPUT);
    pinMode(PIN_L_EN, OUTPUT);
    pinMode(PIN_R_PWM, OUTPUT);
    pinMode(PIN_L_PWM, OUTPUT);

    digitalWrite(PIN_R_EN, HIGH);
    digitalWrite(PIN_L_EN, HIGH);
}

void setupServo()
{
    servoMotor.attach(SERVO_PIN);
    servoMotor.write(servoPosition);
}

void setMotor(int value)
{
    motorPosition = constrain(value, 0, 180);
    int pwmValue = map(motorPosition, 0, 180, -255, 255);

    if (pwmValue > 0)
    {
        analogWrite(PIN_R_PWM, pwmValue);
        analogWrite(PIN_L_PWM, 0);
    }
    else if (pwmValue < 0)
    {
        analogWrite(PIN_R_PWM, 0);
        analogWrite(PIN_L_PWM, -pwmValue);
    }
    else
    {
        analogWrite(PIN_R_PWM, 0);
        analogWrite(PIN_L_PWM, 0);
    }
}

void setServo(int value)
{
    servoPosition = constrain(value, 0, 180);
    servoMotor.write(servoPosition);
}

// ===================== WEBSOCKET =====================
void processWebSocketMessage(uint8_t *data, size_t len)
{
    String jsonMessage;
    jsonMessage.reserve(len);
    for (size_t i = 0; i < len; i++)
        jsonMessage += char(data[i]);

    StaticJsonDocument<200> doc;
    if (deserializeJson(doc, jsonMessage) != DeserializationError::Ok)
        return;

    if (doc.containsKey("motor"))
        setMotor(doc["motor"]);
    if (doc.containsKey("servo"))
        setServo(doc["servo"]);
}

void onWebSocketEvent(AsyncWebSocket *server, AsyncWebSocketClient *client,
                      AwsEventType type, void *arg, uint8_t *data, size_t len)
{

    if (type == WS_EVT_DATA)
        processWebSocketMessage(data, len);
}

// ===================== SETUP =====================
void setup()
{
    Serial.begin(115200);

    setupMotorDriver();
    setupServo();

    WiFi.begin(WIFI_SSID, WIFI_PASS);

    Serial.print("Conectando");
    while (WiFi.status() != WL_CONNECTED)
    {
        delay(500);
        Serial.print(".");
    }

    Serial.printf("\nConectado → IP: %s\n", WiFi.localIP().toString().c_str());

    ws.onEvent(onWebSocketEvent);
    server.addHandler(&ws);

    // ===================== CORS FIX =====================
    DefaultHeaders::Instance().addHeader("Access-Control-Allow-Origin", "*");
    DefaultHeaders::Instance().addHeader("Access-Control-Allow-Headers", "*");
    // =====================================================

    server.on("/status", HTTP_GET, [](AsyncWebServerRequest *request)
              { request->send(200, "text/plain",
                              "Motor=" + String(motorPosition) +
                                  ", Servo=" + String(servoPosition)); });

    server.begin();
    Serial.println("Servidor iniciado (CORS ON)");
}

// ===================== LOOP =====================
void loop()
{
    ws.cleanupClients();
}