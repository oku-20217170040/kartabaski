#!/usr/bin/env bash
# Telegram botunu siteye bağlar. Sunucuda, etkileşimli çalıştırılır:
#   bash /home/ubuntu/kartabaski/tools/sunucu/telegram-kur.sh
# Anahtar ekranda görünmez; yalnız sunucudaki .env dosyasına yazılır.
set -euo pipefail

APP="${APP:-/home/ubuntu/kartabaski}"
HOST="${HOST:-www.kartabaski.com}"
umask 077
cd "$APP"

envval() {
  grep -E "^$1=" .env | tail -1 | cut -d= -f2- | tr -d '\r' | sed -e "s/^[\"']//" -e "s/[\"']\$//"
}

echo "BotFather'daki bot anahtarını yapıştırıp Enter'a basın (yazdığınız görünmez)."
read -rsp "Anahtar: " TOKEN
echo
TOKEN="$(printf '%s' "$TOKEN" | tr -d '[:space:]')"
[[ "$TOKEN" =~ ^[0-9]+:[A-Za-z0-9_-]{30,}$ ]] || { echo "Bu bir bot anahtarına benzemiyor. Hiçbir şey değişmedi."; exit 1; }

telegram() {
  printf 'url = "https://api.telegram.org/bot%s/%s"\n' "$TOKEN" "$1" | curl -sS -m 20 -K -
}

ME="$(telegram getMe)"
grep -q '"ok":true' <<<"$ME" || { echo "Telegram anahtarı kabul etmedi. Hiçbir şey değişmedi."; exit 1; }
echo "Bot bulundu: @$(grep -o '"username":"[^"]*"' <<<"$ME" | cut -d'"' -f4)"

HOOK="$(telegram getWebhookInfo | grep -o '"url":"[^"]*"' | head -1 | cut -d'"' -f4 || true)"
if [ -n "$HOOK" ] && [ "$HOOK" != "https://$HOST/api/telegram" ]; then
  echo "UYARI: bu bot şu an başka bir adrese bağlı: $(sed -E 's#^(https?://[^/]+).*#\1#' <<<"$HOOK")"
  echo "Devam ederseniz oradaki bot çalışmayı bırakır."
  read -rp "Yine de bu siteye bağlansın mı? (evet yazın): " ANSWER
  [ "$ANSWER" = "evet" ] || { echo "Vazgeçildi. Hiçbir şey değişmedi."; exit 1; }
fi

# .env yerinde güncellenir (izinler ve diğer satırlar korunur).
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
grep -v -E '^TELEGRAM_BOT_TOKEN=' .env > "$TMP" || true
[ -z "$(tail -c1 "$TMP")" ] || echo >> "$TMP"
printf 'TELEGRAM_BOT_TOKEN=%s\n' "$TOKEN" >> "$TMP"
cat "$TMP" > .env
unset TOKEN

echo "Uygulama yeni ayarla yeniden başlatılıyor..."
sudo docker compose up -d --force-recreate >/dev/null 2>&1
for _ in $(seq 1 45); do
  [ "$(sudo docker inspect -f '{{.State.Health.Status}}' kartabaski 2>/dev/null)" = "healthy" ] && break
  sleep 2
done

printf 'header = "Authorization: Bearer %s"\n' "$(envval CRON_SECRET)" |
  curl -sS -K - --resolve "$HOST:443:127.0.0.1" -m 60 -X POST "https://$HOST/api/bot"
