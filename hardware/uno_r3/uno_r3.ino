// SideQuest UNO R3 ambient-signal scout.
// Requires a compatible analog microphone module on A0 (not included on UNO R3).
// Raw peak-to-peak ADC values are NOT calibrated decibels or verified noise classes.
// Stores no audio. Never connect an analog signal exceeding board limits.
const unsigned long SAMPLE_MS = 100;
void setup() { Serial.begin(115200); pinMode(LED_BUILTIN, OUTPUT); }
void loop() {
  int minimum = 1023, maximum = 0;
  unsigned long start = millis();
  while (millis() - start < SAMPLE_MS) {
    int value = analogRead(A0);
    if (value < minimum) minimum = value;
    if (value > maximum) maximum = value;
  }
  Serial.print("{\"board\":\"UNO R3\",\"peak_to_peak\":");
  Serial.print(maximum - minimum);
  Serial.println("}");
  digitalWrite(LED_BUILTIN, HIGH); delay(20);
  digitalWrite(LED_BUILTIN, LOW); delay(880);
}
