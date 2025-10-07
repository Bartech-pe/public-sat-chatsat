const path = require('path');
const dotenv = require('dotenv');

// Cargar siempre server/.env sin depender del CWD
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Constantes para backend (NO públicas)
const CHAT_PORT = process.env.CHAT_PORT;
const SECONDARY_PORT = process.env.SECONDARY_PORT;
const API_URL = process.env.API_URL;
const CHANEL_URL = process.env.CHANEL_URL;

// Solo variables públicas (OK para navegador)
function getPublicConfig() {
  return {
    SOCKET_CHAT_ORIGIN: process.env.SOCKET_CHAT_ORIGIN,
    SOCKET_SECONDARY_ORIGIN: process.env.SOCKET_SECONDARY_ORIGIN,
    CHANET_CONNECTOR_URL: process.env.CHANEL_URL,
    API_BASE_URL: process.env.API_URL
  };
}

module.exports = {
  CHAT_PORT,
  SECONDARY_PORT,
  API_URL,
  CHANEL_URL,
  getPublicConfig
};
