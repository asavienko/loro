#!/usr/bin/env bash
# Encrypted API environment; never print decrypted values.
set -euo pipefail
cd "$(dirname "$0")/.."
export SOPS_AGE_KEY_FILE="${SOPS_AGE_KEY_FILE:-$HOME/.config/sops/age/loro.txt}"
encrypted=secrets/api.enc.env
plain=apps/api/.env
umask 077
scratch=''
trap '[[ -z "$scratch" ]] || rm -f "$scratch"' EXIT
case "${1:-}" in
  encrypt)
    [[ -f "$plain" ]] || { echo "Missing $plain; copy apps/api/.env.example first." >&2; exit 1; }
    scratch=$(mktemp secrets/.encrypt.XXXXXX)
    sops encrypt --filename-override "$encrypted" --input-type dotenv --output-type dotenv "$plain" > "$scratch"
    mv "$scratch" "$encrypted"
    ;;
  decrypt)
    scratch=$(mktemp apps/api/.env.XXXXXX)
    sops decrypt --input-type dotenv --output-type dotenv "$encrypted" > "$scratch"
    mv "$scratch" "$plain"
    ;;
  edit)
    sops edit --input-type dotenv --output-type dotenv "$encrypted"
    ;;
  *) echo "Usage: $0 encrypt|decrypt|edit" >&2; exit 2 ;;
esac
