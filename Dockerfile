FROM node:22.14.0

# Set the working directory
WORKDIR /usr/src/app

# Copy current directory into working directory
COPY . .

RUN npm install

CMD [ "node", "--env-file=.env", "src/app.js" ]