# --- Estágio de Build (para construir a aplicação React/Vite) ---
FROM node:20-alpine as build

# Define o diretório de trabalho
WORKDIR /app

# Copia package.json e package-lock.json (ou yarn.lock) para otimizar o cache
COPY package*.json ./

# Instala as dependências do Node.js
RUN npm install

# Copia o restante do código da aplicação
COPY . .

# Constrói a aplicação para produção
RUN npm run build

# --- Estágio de Servir (usando Nginx para servir os arquivos estáticos) ---
FROM nginx:stable-alpine

# Remove a configuração padrão do Nginx
RUN rm -f /etc/nginx/conf.d/nginx.conf

# Copia os arquivos de build da aplicação do estágio anterior para o diretório de servir do Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Copia a configuração personalizada do Nginx
COPY nginx/nginx.conf /etc/nginx/conf.d/nginx.conf 

# Expõe a porta 80, que é a porta padrão HTTP do Nginx
EXPOSE 80

# Comando padrão para iniciar o Nginx
CMD ["nginx", "-g", "daemon off;"]
