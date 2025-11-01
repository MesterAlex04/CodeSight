#!/usr/bin/env sh
# verify staged files with Ollama; returns non-zero to block commit

# prefer explicit env var, otherwise pick the first local model if present
model="${OLLAMA_MODEL:-}"
if [ -z "$model" ]; then
  # More robustly get the first model name, skipping the header line
  model=$(ollama list | sed -n '2p' | sed 's/\s.*$//')
fi

# Final check to ensure we have a valid model name
if [ -z "$model" ]; then
  echo "Error: Could not automatically find an Ollama model."
  echo "1. Run 'ollama list' to confirm you have models."
  echo "2. If the list is empty, run 'ollama pull llama3'."
  echo "3. You can also specify a model: OLLAMA_MODEL=llama3 ./scripts/verify-with-ollama.sh"
  exit 1
fi

echo "Husky: Attempting to use Ollama model: '$model'"

files="$(git diff --cached --name-only --diff-filter=ACM)"
if [ -z "$files" ]; then
  echo "No staged files to verify."
  exit 0
fi

tmp="$(mktemp /tmp/ollama-review.XXXXXX || mktemp)"
printf "Staged files:\n\n" > "$tmp"
for f in $files; do
  printf "\n--- FILE:%s ---\n" "$f" >> "$tmp"
  if [ -f "$f" ]; then
    sed 's/^/    /' "$f" >> "$tmp"
  else
    printf "    (file not present on disk)\n" >> "$tmp"
  fi
done

# Ask model to output a single first line: VERDICT: OK or VERDICT: FAIL
ollama run "$model" <<-PROMPT
You are an automated code reviewer. Inspect the staged files below and output a single-line verdict as the first line in this exact form: "VERDICT: OK" or "VERDICT: FAIL".
After the first line you may output short comments.
Context:
$(cat "$tmp")
PROMPT

rv=$?
rm -f "$tmp"
exit $rv