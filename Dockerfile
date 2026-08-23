# Utiliser Node.js 22 pour le support natif des WebSockets requis par @supabase/supabase-js
FROM node:22-alpine

WORKDIR /usr/src/app

# Installation des dépendances
COPY package*.json ./
RUN npm install

# Copie du code source et compilation
COPY . .
RUN npm run build

EXPOSE 3000

# Démarrage de l'API NestJS
CMD ["node", "dist/main"]