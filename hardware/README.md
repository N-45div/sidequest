# UNO R3 companion

Status: sketch and serial bridge prepared; physical execution not verified. No board was detected on serial ports during setup.

The board requires an external compatible analog microphone module; the UNO R3 has no built-in microphone. With only the board, this cannot measure sound. Use the module's instructions and the official board pinout for wiring: analog output to A0, common ground, and the module's appropriate supply voltage.

Upload `uno_r3/uno_r3.ino` using Arduino IDE with board **Arduino UNO** and the correct serial port. Close Serial Monitor before running the bridge.

```powershell
.\.venv\Scripts\python.exe hardware\serial_bridge.py --list
.\.venv\Scripts\python.exe hardware\serial_bridge.py --port COM3
```

Optional authenticated upload: put the organiser session credential in `SIDEQUEST_SESSION_TOKEN` in your local process, then add `--outing OUTING_ID --venue "Location name"`. Never share the session credential. Remote upload requires HTTPS.

Only raw peak-to-peak ADC amplitude is uploaded. This is not a sound-pressure measurement or decibel value; microphone gain and calibration matter. The observation is a time-specific user contribution, not proof of ongoing venue conditions. It does not automatically change recommendations.

The current hackathon Arduino category specifically requires UNO Q. This R3 companion is real Arduino work once physically tested, but is not represented as satisfying that category.
