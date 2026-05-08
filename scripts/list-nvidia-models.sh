#!/bin/bash
KEY=$(grep "^NVIDIA_API_KEY=" .env.local 2>/dev/null | cut -d'=' -f2-)
if [ -z "$KEY" ]; then echo "ERROR: no NVIDIA_API_KEY in .env.local"; exit 1; fi

echo "=== Models available on your NVIDIA NIM account ==="
curl -s "https://integrate.api.nvidia.com/v1/models" \
  -H "Authorization: Bearer $KEY" | \
  python3 -c "
import sys, json
data = json.load(sys.stdin)
models = data.get('data', [])
if not models:
    print('No models returned or error:', json.dumps(data)[:200])
else:
    for m in models:
        print(m.get('id', '?'))
"
