const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid');
const { CHAT_PORT, SECONDARY_PORT, getPublicConfig } = require('./config');

// Cargar variables de entorno
dotenv.config();

// Mapa para almacenar tokens por socket.id
const tokenStore = new Map();

// Configuración de Express
const app = express();

// Servir archivos estáticos
app.use(express.static('../public'));
app.use(express.static('../widget'));

// Endpoint para exponer variables públicas al cliente
app.get('/config.js', (_req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.send(`window.__ENV = ${JSON.stringify(getPublicConfig())};`);
});

// Crear servidor HTTP principal para la aplicación
const server = http.createServer(app);

// Configurar Socket.IO para el chat (puerto 4000)
const chatIo = new Server(server, {
  cors: { 
    origin: '*',
    methods: ['GET', 'POST']
  },
  path: '/socket.io/chat'
});

// Crear un servidor HTTP adicional para el segundo socket (puerto 3004)
const secondApp = express();
const secondServer = http.createServer(secondApp);

// Configurar el segundo Socket.IO en el puerto 3004
const secondIo = new Server(secondServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  path: '/socket.io/secondary'
});

// Configurar eventos para el socket de chat (puerto 4000)
chatIo.on('connection', (socket) => {
  socket.on('joinRoom', (room) => {
    socket.join(room);
  });

  socket.on('leaveRoom', (room) => {
    try {
      if (room) socket.leave(String(room));
    } catch (e) {
      console.warn('Error al abandonar sala:', e?.message || e);
    }
  });

  // Manejar mensajes de chat
  socket.on('chatMessage', async (data) => {
      // Transformar al formato INCOMING

      console.log(data);
      
      let transformed = {
        type: 'message.incoming',
        payload: {
          chat_id: uuidv4(), 
          channel: 'chatsat',
          fromMe: false,
          token: 'cw330b6io69n8xbge5ynn8ox8831ikc2s0p7', 
          message: {
            id: Date.now().toString(),
            body: data.msg || ''
          },
          receiver: {
            id: null,
            full_name: '',
            phone_number: '',
            alias: ''
          },
          sender: {
            id: data.user.id,
            full_name: data.user.name,
            phone_number: data.user.phoneNumber,
            alias: data.user.name.toLowerCase().replace(/\s+/g, '_')
          },
          timestamp: data.timestamp,
          attachments: []
        }
      };

      if (data.file) {
        transformed.payload.attachments.push({
          name: data.file?.name || '',
          extension: data.file?.extension || '',
          content: data.file?.content || ''
        });
      }

      const accessToken = data.user.accessToken;

      try {
        const responseMessage = await axios.post(`${process.env.CHANEL_URL}/send-message`, transformed, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': accessToken ? `Bearer ${accessToken}` : undefined // Añadir el token a los headers
          }
        });

        socket.emit('responseMessageChanel', responseMessage.data);

        try {
          const { channelRoomId } = responseMessage.data || {};
          if (channelRoomId) {
            const canonicalRoom = String(channelRoomId);
            socket.join(canonicalRoom);
            socket.emit('roomAssigned', { room: canonicalRoom });

            // Limpiar otras salas
            try {
              const rooms = socket.rooms || new Set();
              for (const r of rooms) {
                if (r !== canonicalRoom && r !== socket.id) {
                  socket.leave(r);
                }
              }
            } catch (e) {
              console.warn('No se pudieron limpiar salas previas:', e?.message || e);
            }
          }
        } catch (e) {
          console.warn('No se pudo sincronizar la sala canónica:', e?.message || e);
        }
      } catch (error) {
        console.error('Error al enviar mensaje:', error.message);
      }
  });

  socket.on('disconnect', () => {
    tokenStore.delete(socket.id);
  });

  socket.on('registerUser', async (data, callback) => {
 
    if (typeof callback !== 'function') {
      return;
    }

    try {
      if (!data) {
        return callback({ success: false, message: 'No se recibieron datos de registro' });
      }

      const requiredFields = ['names', 'phone'];
      const missingFields = requiredFields.filter(field => !data[field]);

      if (missingFields.length > 0) {
        return callback({ success: false, message: `Faltan campos: ${missingFields.join(', ')}` });
      }

      const responseData = await axios.post(`${process.env.CHANEL_URL}/create-citizen`, {
        name: data.names || "",
        phoneNumber: data.phone || "",
        isExternal: true,
        email: data.email || "",
        documentNumber: data.docNumber || "",
        documentType: data.docType || "",
        avatarUrl: ""
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Almacenar el token en el mapa usando el socket.id como clave
      tokenStore.set(socket.id, responseData.data.accessToken);

      callback({ 
        success: true, 
        message: 'Usuario registrado exitosamente',
        citizen: responseData.data
      });

    } catch (err) {
   
      const errorMessage = err.response?.data?.message || err.message || 'Error desconocido';
      callback({
        success: false,
        message: errorMessage,
        citizen: null,
        error: errorMessage
      });
    }
  });

  socket.on('typing', (data) => {
    console.log('Usuario escribiendo:', data.user);
  });
});

server.listen(CHAT_PORT, () => {
  console.log(`Servidor de chat corriendo en http://localhost:${CHAT_PORT}`);
});

secondServer.listen(SECONDARY_PORT, () => {
  console.log(`Servidor secundario corriendo en http://localhost:${SECONDARY_PORT}`);

  secondIo.on('connection', (socket) => {
    socket.on('customEvent', (data) => {
      socket.emit('customResponse', { status: 'received', data });
    });

    socket.on('disconnect', () => {
      console.log('Usuario desconectado del socket secundario:', socket.id);
    });
  });
});
