# Sample Profiles

These are starter profiles based on your manual commands. Users can
customize or create their own.

## default.json - Stock Settings
```json
{
  "name": "default",
  "description": "Stock power limits, GPU at auto",
  "power": {
    "stapmLimit": null,
    "slowLimit": null,
    "fastLimit": null
  },
  "gpu": {
    "clockMhz": null,
    "perfLevel": "auto"
  },
  "tunedProfile": null,
  "match": {
    "enabled": false,
    "processPatterns": [],
    "priority": 0
  }
}
```

## gaming-balanced.json - Your Standard Setup
Higher sustained power + GPU capped at 2700 MHz for CPU headroom.
```json
{
  "name": "gaming-balanced",
  "description": "132W STAPM, 154W slow PPT, GPU at 2700MHz for balanced CPU/GPU",
  "power": {
    "stapmLimit": 132000,
    "slowLimit": 154000,
    "fastLimit": null
  },
  "gpu": {
    "clockMhz": 2700,
    "perfLevel": null
  },
  "tunedProfile": "accelerator-performance",
  "match": {
    "enabled": true,
    "processPatterns": [
      "steam.*game",
      "gamescope"
    ],
    "priority": 10
  }
}
```

## gaming-cpu.json - CPU-Heavy Games
Lower GPU clocks to maximize CPU power budget.
```json
{
  "name": "gaming-cpu",
  "description": "Max CPU power - GPU at 2400MHz, high power limits",
  "power": {
    "stapmLimit": 132000,
    "slowLimit": 154000,
    "fastLimit": null
  },
  "gpu": {
    "clockMhz": 2400,
    "perfLevel": null
  },
  "tunedProfile": "accelerator-performance",
  "match": {
    "enabled": true,
    "processPatterns": [
      "Cyberpunk2077",
      "Starfield"
    ],
    "priority": 20
  }
}
```

## gaming-gpu.json - GPU-Heavy Games
Full GPU clocks, standard power limits.
```json
{
  "name": "gaming-gpu",
  "description": "Full GPU power for GPU-bound titles",
  "power": {
    "stapmLimit": 132000,
    "slowLimit": 154000,
    "fastLimit": null
  },
  "gpu": {
    "clockMhz": null,
    "perfLevel": "auto"
  },
  "tunedProfile": "accelerator-performance",
  "match": {
    "enabled": true,
    "processPatterns": [],
    "priority": 5
  }
}
```

## quiet.json - Low Power / Quiet Mode
Reduced power for low noise when browsing/working.
```json
{
  "name": "quiet",
  "description": "Reduced power limits for quiet operation",
  "power": {
    "stapmLimit": 65000,
    "slowLimit": 65000,
    "fastLimit": 80000
  },
  "gpu": {
    "clockMhz": null,
    "perfLevel": "auto"
  },
  "tunedProfile": "balanced",
  "match": {
    "enabled": false,
    "processPatterns": [],
    "priority": 0
  }
}
```
