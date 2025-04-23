FROM node:18-slim

# Instala as dependências que o Puppeteer/Chromium precisa
RUN apt-get update && apt-get install -y \
  wget \
  ca-certificates \
  fonts-liberation \
  libappindicator3-1 \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdbus-1-3 \
  libdrm2 \
  libgbm1 \                    
  libgdk-pixbuf2.0-0 \
  libnspr4 \
  libnss3 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  xdg-utils \
  --no-install-recommends && apt-get clean

# Define o diretório onde o app vai rodar
WORKDIR /app

# Copia todos os arquivos para o container
COPY . .

# Instala as dependências do projeto
RUN npm install

# Expõe a porta que o Railway vai usar
EXPOSE 3000

# Comando pra iniciar seu bot
CMD ["npm", "start"]
