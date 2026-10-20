#!/bin/sh
# Build de produção na VPS, dentro do container node:22-alpine
# (a mesma imagem que roda o sistema, para as dependências nativas baterem).
# Uso: docker run --rm --env-file /root/mes.env -v /opt/mes:/app node:22-alpine sh /app/infra/vps/build.sh
set -e
cd /app
echo "1/3 Instalando dependências..."
npm install --no-audit --no-fund
echo "2/3 Gerando o build..."
NODE_OPTIONS=--max-old-space-size=2048 npm run build
echo "3/3 Montando a pasta do servidor..."
cp -r .next/static .next/standalone/.next/
cp -r public drizzle .next/standalone/
echo "Build concluído."
