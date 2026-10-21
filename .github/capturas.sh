#!/bin/sh
# Imprime as capturas JPEG do e2e como anotações (tar.gz em base64, pedaços de 4000 caracteres),
# para conferência visual sem baixar artefatos. Só roda quando o commit tem "[capturas]".
# Uso: sh .github/capturas.sh <primeiro pedaço>   (10 pedaços por passo, limite do GitHub)
set -e
[ -d test-results/capturas ] || exit 0
if [ ! -f /tmp/capturas.b64 ]; then
  tar czf /tmp/capturas.tgz -C test-results capturas
  base64 -w0 /tmp/capturas.tgz > /tmp/capturas.b64
  echo "tamanho base64: $(wc -c < /tmp/capturas.b64)"
fi
inicio=$1
i=0
while [ $i -lt 10 ]; do
  n=$((inicio + i))
  pedaco=$(dd if=/tmp/capturas.b64 bs=4000 skip=$n count=1 2>/dev/null)
  [ -z "$pedaco" ] && exit 0
  echo "::notice title=captura $(printf %03d $n)::$pedaco"
  i=$((i + 1))
done
