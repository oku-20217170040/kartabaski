#!/usr/bin/env bash
# Sunucu zamanlayıcısı (ubuntu crontab):
#   */30 4-21 * * *  bash /home/ubuntu/kartabaski/tools/sunucu/zamanlayici.sh cron    # otomasyon turu (TSİ 07:00-00:30)
#   */5  *    * * *  bash /home/ubuntu/kartabaski/tools/sunucu/zamanlayici.sh nobet   # site ve disk nöbeti
# Anahtarlar .env'den okunur ve curl'e standart girdiden verilir (işlem listesinde görünmez).
set -uo pipefail

APP="${APP:-/home/ubuntu/kartabaski}"
HOST="${HOST:-www.kartabaski.com}"
STATE="${STATE:-/home/ubuntu/.kartabaski-nobet}"
LOG="${LOG:-/home/ubuntu/kartabaski-zamanlayici.log}"
DISK_LIMIT="${DISK_LIMIT:-85}"
umask 077
mkdir -p "$STATE"

envval() {
  grep -E "^$1=" "$APP/.env" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '\r' | sed -e "s/^[\"']//" -e "s/[\"']\$//"
}

note() {
  echo "$(date -u '+%F %T') $*" >> "$LOG"
  tail -n 500 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
}

# Uygulamaya kenar sunucusu üzerinden, dış DNS'e bağlı kalmadan istek.
local_curl() { curl -sS --resolve "$HOST:443:127.0.0.1" "$@"; }

authed() {
  printf 'header = "Authorization: Bearer %s"\n' "$(envval CRON_SECRET)" | local_curl -K - "$@"
}

send() {
  local token chat
  token="$(envval TELEGRAM_BOT_TOKEN)"
  chat="$(cat "$STATE/hedef" 2>/dev/null)"
  [ -n "$chat" ] || chat="$(envval TELEGRAM_CHAT_ID)"
  if [ -z "$token" ] || [ -z "$chat" ]; then note "uyari gonderilemedi (bot bagli degil): $1"; return 1; fi
  printf 'url = "https://api.telegram.org/bot%s/sendMessage"\n' "$token" |
    curl -sS -m 20 -K - --data-urlencode "chat_id=$chat" --data-urlencode "text=$1" | grep -q '"ok":true'
}

run_cron() {
  exec 9>"$STATE/cron.kilit"
  flock -n 9 || { note "cron: onceki tur suruyor"; return 0; }
  local code
  code="$(authed -m 290 -o "$STATE/cron.json" -w '%{http_code}' "https://$HOST/api/cron/main")"
  note "cron: HTTP $code"
}

run_watch() {
  local code fails today used
  code="$(local_curl -o /dev/null -m 20 -w '%{http_code}' "https://$HOST/robots.txt" 2>/dev/null)"
  if [ "$code" = "200" ]; then
    rm -f "$STATE/hata"
    if [ -f "$STATE/ariza" ] && send "Site yeniden açık: https://$HOST"; then rm -f "$STATE/ariza"; fi
    # Grup kimliği saklanır: site kapalıyken de uyarı gidebilsin.
    local chat
    chat="$(authed -m 20 -f "https://$HOST/api/bot" 2>/dev/null | tr -d '[:space:]')"
    [[ "$chat" =~ ^-?[0-9]+$ ]] && printf '%s' "$chat" > "$STATE/hedef"
  else
    fails=$(( $(cat "$STATE/hata" 2>/dev/null || echo 0) + 1 ))
    echo "$fails" > "$STATE/hata"
    note "nobet: site yanit vermiyor (HTTP $code, $fails. kez)"
    # Tek seferlik takılma uyarı sayılmaz.
    if [ "$fails" -ge 2 ] && [ ! -f "$STATE/ariza" ]; then
      send "Site açılmıyor (HTTP $code). Adres: https://$HOST" && touch "$STATE/ariza"
    fi
  fi

  today="$(date -u +%F)"
  used="$(df --output=pcent / | tail -1 | tr -dc '0-9')"
  if [ "${used:-0}" -ge "$DISK_LIMIT" ] && [ "$(cat "$STATE/disk" 2>/dev/null)" != "$today" ]; then
    send "Sunucu diski %$used dolu." && echo "$today" > "$STATE/disk"
  fi
}

case "${1:-}" in
  cron) run_cron ;;
  nobet) run_watch ;;
  *) echo "kullanim: $0 cron|nobet" >&2; exit 2 ;;
esac
