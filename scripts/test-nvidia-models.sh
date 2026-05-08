#!/bin/bash
# Test NVIDIA NIM models to find which ones are available
set -e

# Load key from .env.local
KEY=$(grep "^NVIDIA_API_KEY=" .env.local 2>/dev/null | cut -d'=' -f2-)
if [ -z "$KEY" ]; then
  echo "ERROR: NVIDIA_API_KEY not found in .env.local"
  exit 1
fi

BASE="https://integrate.api.nvidia.com/v1"
PAYLOAD='{"messages":[{"role":"user","content":"hola"}],"max_tokens":20,"stream":false}'

MODELS=(
  "meta/llama-3.1-405b-instruct"
  "meta/llama-3.1-70b-instruct"
  "meta/llama-3.3-70b-instruct"
  "nvidia/llama-3.1-nemotron-70b-instruct"
  "mistralai/mixtral-8x22b-instruct-v0.1"
  "mistralai/mistral-7b-instruct-v0.3"
  "google/gemma-2-27b-it"
  "deepseek-ai/deepseek-r1"
  "deepseek-ai/deepseek-v3"
  "deepseek-ai/deepseek-r1-distill-llama-70b"
)

echo "Testing NVIDIA NIM endpoint: $BASE"
echo "================================================"

for MODEL in "${MODELS[@]}"; do
  BODY=$(echo "$PAYLOAD" | jq --arg m "$MODEL" '. + {"model": $m}')
  STATUS=$(curl -s -o /tmp/nv_response.json -w "%{http_code}" \
    -X POST "$BASE/chat/completions" \
    -H "Authorization: Bearer $KEY" \
    -H "Content-Type: application/json" \
    -d "$BODY" 2>/dev/null)

  if [ "$STATUS" = "200" ]; then
    REPLY=$(cat /tmp/nv_response.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['choices'][0]['message']['content'][:60])" 2>/dev/null || echo "(parse error)")
    echo "✓ $MODEL → 200 OK | '$REPLY'"
  else
    ERR=$(cat /tmp/nv_response.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('detail','') or d.get('error',{}).get('message',''))" 2>/dev/null | head -c 80 || cat /tmp/nv_response.json | head -c 80)
    echo "✗ $MODEL → HTTP $STATUS | $ERR"
  fi
done

echo "================================================"
echo "Done. Copy the model ID from a ✓ row and update src/lib/ai/agent-prompt.ts"
