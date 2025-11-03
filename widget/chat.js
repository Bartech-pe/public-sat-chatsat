const __ENV = (typeof window !== 'undefined' && window.__ENV) ? window.__ENV : {};

// URLs principales con fallbacks seguros
const chanet_conector_url = __ENV.CHANET_CONNECTOR_URL ;
const socket_principal = __ENV.SOCKET_CHAT_ORIGIN;
const socket_secundario = __ENV.SOCKET_SECONDARY_ORIGIN ;
const url_apis = (__ENV.API_BASE_URL);

// Endpoints específicos
let EMAIL_API = url_apis + "email";
//let SURVEY_API = url_apis + "/channel-citizen/create-survey";
let SURVEY_API = chanet_conector_url + "/create-survey";
let API_TOKEN = null;

let chatSocket = null;
let secondarySocket = null;

let typingIndicatorTimer = null;
let typingIndicatorElement = null;


// Helper para extraer el chat_id de diferentes estructuras de evento
let messageNew  =  {
  assistanceId:null,
  channelRoomId:null,
  userId:null,
  citizenId:null
}


// Estado global
let userData = null;
let selectedAdvisor = null;
let agents = [];
let inactivityTimer;
let chatHistory = localStorage.getItem('chatHistory') ? JSON.parse(localStorage.getItem('chatHistory')) : [];
let isTyping = false;
let userCiudadano = null;

// Inicializar conexiones de socket
function initializeSockets() {
  return new Promise((resolve, reject) => {
    if (!window.io) {
      const error = 'Socket.io no está disponible. Asegúrate de incluir la biblioteca Socket.IO en tu HTML.';
      console.error(error);
      reject(new Error(error));
      return;
    }

    try {
      // Cerrar conexiones existentes si las hay
      if (chatSocket) {
        chatSocket.disconnect();
      }
      if (secondarySocket) {
        secondarySocket.disconnect();
      }

      const socketChanel = window.io(chanet_conector_url, {
        auth: {
          token: API_TOKEN
        },
        transports: ["websocket",'polling'],
      });
       console.log("Conectado con id:", socketChanel.id);
      // Eventos del canal ngrok
      socketChanel.on("connect", () => {
        console.log("Conectado con id:", socketChanel.id);
     
      });
      
      socketChanel.on("disconnect", () => {
        console.log("Desconectado del ngrok");
      });
      
      socketChanel.on("connect_error", (err) => {
        console.error("Error de conexión:", err.message);
      });
      
  
    socketChanel.on("message.outgoing", (data) => {

          messageNew.assistanceId = data.assistanceId || null;
          messageNew.channelRoomId = data.channelRoomId || null;
          messageNew.userId = data.userId || null;
          messageNew.citizenId = data.citizenId || null;

          if(userCiudadano.id ==  messageNew.citizenId){

            if (typingIndicatorElement) {
              typingIndicatorElement.remove();
              typingIndicatorElement = null;
            }
  
            if (typingIndicatorTimer) {
              clearTimeout(typingIndicatorTimer);
              typingIndicatorTimer = null;
            }
  
            if (Array.isArray(data.attachments) && data.attachments.length > 0) {
                const attachment = data.attachments[0];
  
                const fileData = {
                  name: `archivo_${attachment.id}.${attachment.extension}`,
                  type: attachment.type,
                  extension: attachment.extension,
                  size: attachment.size,
                  content: attachment.content,
                };
  
                addMessage("Asesor", data.message, false, fileData);
            } else {
                addMessage("Asesor", data.message, false, false);
            }
          }

         
      });

      socketChanel.on("chat.status.typing.indicator", (indicator) => {
          console.log("chat.status",indicator)

          if(userCiudadano.id ==  messageNew.citizenId){

            const content = document.getElementById('chat-content');
            
              if (!content) {
                return;
              }
  
              // Limpiar el indicador anterior si existe
              if (typingIndicatorElement) {
                typingIndicatorElement.remove();
                typingIndicatorElement = null;
              }
              if (typingIndicatorTimer) {
                clearTimeout(typingIndicatorTimer);
              }

              // Crear el elemento de "Escribiendo..."
              typingIndicatorElement = document.createElement('div');
              typingIndicatorElement.className = 'mb-2 flex justify-start animate-fadeIn';
              typingIndicatorElement.innerHTML = `
                <div class="relative min-w-[80px] max-w-[80%] px-3 py-2 rounded-2xl bg-gray-200 text-gray-600 text-sm">
                  <span>Escribiendo<span class="animate-pulse">...</span></span>
                </div>
              `;
              content.appendChild(typingIndicatorElement);
              content.scrollTop = content.scrollHeight;

              // Configurar temporizador para eliminar el indicador después de 3 minutos
            typingIndicatorTimer = setTimeout(() => {
                if (typingIndicatorElement) {
                  typingIndicatorElement.remove();
                  typingIndicatorElement = null;
                }
                typingIndicatorTimer = null;
              },  10 * 1000);
            }
      });

      socketChanel.on("chat.status.completed", (completed) => {
          console.log("chat.completed",completed)
          if(userCiudadano.id ==  messageNew.citizenId){
            
            addMessage("Asesor", "El chat ha finalizado por inactividad.\n Gracias por comunicarte con nosotros.\n Antes de salir, te invitamos a responder una breve encuesta para mejorar nuestro servicio", false, false);
            addMessage("Asesor", "¿Quieres que te enviemos esta conversación a tu correo?", false, false);
     
            const content_chat = document.getElementById("chat-content");
            if (content_chat) {
              const optionsDiv_chat = document.createElement("div");
              optionsDiv_chat.className = "mt-3 flex gap-3";

              const yesBtn = document.createElement("button");
              yesBtn.textContent = "✅ Sí, enviar";
              yesBtn.className =
                "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition";
              yesBtn.onclick = async() => {
                console.log("👉 Encuesta será enviada por correo");
                 try {
                    // Send survey data to API
                    const responseAssistance = await fetch(chanet_conector_url + '/attention/' + messageNew.assistanceId + '/send-to-email' , {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': API_TOKEN,
                      },
                      body:  JSON.stringify({}),
                    });

               
                    if (userCiudadano && userCiudadano.email) {
                      addMessage("Asesor", "Acabamos de enviar el chat a su correo " + userData.email, false, false);
                    } else {
                      addMessage("Asesor", "Acabamos de enviar el chat a su correo registrado.", false, false);
                    }

                  } catch (error) {
                    console.log('Error sending survey:', error);
                  }

                  optionsDiv_chat.remove();
              };

              const noBtn = document.createElement("button");
              noBtn.textContent = "❌ No, gracias";
              noBtn.className =
                "px-4 py-2 bg-gray-300 text-gray-900 rounded-lg hover:bg-gray-400 transition";
              noBtn.onclick = () => {
               
                optionsDiv_chat.remove();
              };

              optionsDiv_chat.appendChild(yesBtn);
              optionsDiv_chat.appendChild(noBtn);
              content_chat.appendChild(optionsDiv_chat);
            }
            
            setTimeout(() => {
                showSatisfactionSurvey();
            }, 10000);
          }
 
      });

      
      // Socket principal para el chat (puerto 4000)
      chatSocket = window.io(socket_principal, {
        path: '/socket.io/chat',
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        timeout: 10000, // 10 segundos de timeout
        forceNew: true, // Forzar nueva conexión
        transports: ['websocket', 'polling'] // Intentar ambos métodos de transporte
      });

      // Manejar conexión del socket principal
      chatSocket.on('connect', () => {

        // Unirse a la sala actual solo si está definida
        if (window.currentRoom) {
          chatSocket.emit('joinRoom', window.currentRoom);
        }
        
        // Escuchar mensajes entrantes
        chatSocket.on('message', (data) => {
          console.log("Escuchar mensajes entrantes socket", data);

          if (data.msg && data.user) {
            const isUser = data.user.id === (userData ? userData.id : 'anonymous');
            addMessage(isUser ? 'Tú' : data.user.name || 'Asesor', data.msg, isUser,false);
          }

        });

        // Escuchar asignación de sala canónica desde el servidor
        chatSocket.on('roomAssigned', (info) => {
          const newRoom = info?.room ? String(info.room) : null;
          if (newRoom && newRoom !== window.currentRoom) {
            const oldRoom = window.currentRoom;
            if (oldRoom) {
              chatSocket.emit('leaveRoom', oldRoom);
            }
            window.currentRoom = newRoom;
            chatSocket.emit('joinRoom', window.currentRoom);
            console.log('Cambiado a sala canónica:', window.currentRoom);
          }
        });
        
        // Configurar socket secundario después de que el principal esté conectado
        setupSecondarySocket()
          .then(() => resolve())
          .catch(err => {
            console.error('Error configurando socket secundario:', err);
            // Aún resolvemos la promesa ya que el socket principal está conectado
            resolve();
          });
      });
      
      // Manejar errores de conexión
      chatSocket.on('connect_error', (error) => {
        console.error('Error de conexión con el socket de chat:', error);
        // No rechazamos aquí para permitir la reconexión automática
      });
      
      // Manejar reconexión fallida
      chatSocket.on('reconnect_failed', () => {
        const error = 'No se pudo reconectar el socket de chat';
        console.error(error);
        reject(new Error(error));
      });
      
      chatSocket.on('disconnect', (reason) => {
        console.log('Desconectado del socket de chat:', reason);
        if (reason === 'io server disconnect') {
          // Reconexión será manejada automáticamente por socket.io
          console.log('Intentando reconectar...');
        }
      });
      
    } catch (error) {
      console.error('Error al inicializar los sockets:', error);
      reject(error);
    }
  });
}

// Configurar socket secundario
function setupSecondarySocket() {
  return new Promise((resolve) => {
    // Socket secundario (puerto 3000)
    secondarySocket = window.io(socket_secundario, {
      path: '/socket.io/secondary',
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    // Configurar manejadores de eventos para el socket secundario
    if (secondarySocket) {
      secondarySocket.on('connect', () => {
        resolve();
      });

      secondarySocket.on('customResponse', (data) => {
      
      });

      secondarySocket.on('disconnect', () => {
       
      });
      
      secondarySocket.on('connect_error', (error) => {
        console.error('Error de conexión con el socket secundario:', error);
        // Continuamos aunque falle el socket secundario
        resolve();
      });
    } else {
      resolve();
    }
  });
}

// Inicializar los sockets cuando el DOM esté listo
// document.addEventListener('DOMContentLoaded', () => {
  
// });



// Crear el widget HTML
// Lista de feriados (ejemplo para Perú, 2025). Actualiza según tus necesidades.
const HOLIDAYS = [
  '2025-01-01', // Año Nuevo
  '2025-04-17', // Jueves Santo
  '2025-04-18', // Viernes Santo
  '2025-05-01', // Día del Trabajo
  '2025-06-29', // San Pedro y San Pablo
  '2025-07-28', // Fiestas Patrias
  '2025-07-29', // Fiestas Patrias
  '2025-08-30', // Santa Rosa de Lima
  '2025-10-08', // Combate de Angamos
  '2025-11-01', // Todos los Santos
  '2025-12-08', // Inmaculada Concepción
  '2025-12-25'  // Navidad
];

// Verificar si es horario laboral (8:00 AM - 5:00 PM, lunes a viernes, no feriado)
function isBusinessHours() {
  const now = new Date();
  const limaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Lima' }));
  
  // Verificar hora (8:00 AM - 5:00 PM)
  const hours = limaTime.getHours();
  const isValidHour = hours >= 0 && hours < 24;
  
  // Verificar día (lunes a viernes)
  const dayOfWeek = limaTime.getDay();
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 7; // 0=Domingo, 6=Sábado
  
  // Verificar feriado
  const dateString = limaTime.toISOString().split('T')[0];
  const isHoliday = HOLIDAYS.includes(dateString);
  
  return isValidHour && isWeekday && !isHoliday;
}

// Formulario de consulta por correo (fuera de horario)
function showEmailForm() {
  const emailFormContainer = document.createElement('div');
  emailFormContainer.id = 'email-form-widget';
  emailFormContainer.className = 'fixed bottom-1 right-1 w-96 max-w-[99%] bg-white shadow-2xl rounded-2xl overflow-hidden flex flex-col z-50 transition-all duration-300 transform scale-0 border border-gray-200';
  emailFormContainer.innerHTML = `
    <div class="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-t-2xl flex justify-between items-center shadow-md">
      <div class="flex items-center space-x-2">
        <div class="w-3 h-3 rounded-full bg-red-400 animate-pulse"></div>
        <h2 class="text-lg font-semibold">Consulta Fuera de Horario</h2>
      </div>
      <button id="close-email-form" class="text-white hover:bg-blue-800 w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-200">
        <span class="text-xl">&times;</span>
      </button>
    </div>
    <div class="p-4 bg-gradient-to-b from-gray-50 to-gray-100 flex-1">
      <p class="text-sm text-gray-600 mb-4">Lo sentimos, no hay asesores disponibles fuera del horario laboral (8:00 AM - 5:00 PM, lunes a viernes, excepto feriados). Por favor, deje su consulta y le responderemos por correo.</p>
      <form id="email-consultation-form" class="space-y-4">
        <div class="space-y-1">
          <label for="email-name" class="block text-sm font-medium text-gray-700">Nombre</label>
          <input id="email-name" type="text" class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200" placeholder="Ingrese su nombre completo">
          <p id="email-name-error" class="text-red-500 text-xs mt-1 hidden">Por favor, ingrese su nombre</p>
        </div>
        <div class="space-y-1">
          <label for="email-address" class="block text-sm font-medium text-gray-700">Correo Electrónico</label>
          <input id="email-address" type="email" class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200" placeholder="ejemplo@correo.com">
          <p id="email-address-error" class="text-red-500 text-xs mt-1 hidden">Por favor, ingrese un correo válido</p>
        </div>
        <div class="space-y-1">
          <label for="email-message" class="block text-sm font-medium text-gray-700">Consulta</label>
          <textarea id="email-message" class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200" placeholder="Describa su consulta" rows="4"></textarea>
          <p id="email-message-error" class="text-red-500 text-xs mt-1 hidden">Por favor, ingrese su consulta</p>
        </div>
        <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50">
          Enviar Consulta
        </button>
      </form>
    </div>
  `;

  document.body.appendChild(emailFormContainer);

  // Mostrar formulario con animación
  setTimeout(() => emailFormContainer.classList.add('scale-100'), 10);

  // Manejar cierre
  const closeBtn = document.getElementById('close-email-form');
  closeBtn.addEventListener('click', () => {
    emailFormContainer.style.display = 'none';
    document.getElementById('chat-open-btn').style.display = 'flex';
  });

  // Manejar envío del formulario
  const form = document.getElementById('email-consultation-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Resetear errores
    document.querySelectorAll('[id$="-error"]').forEach(el => el.classList.add('hidden'));

    // Validar campos
    const name = document.getElementById('email-name').value.trim();
    const email = document.getElementById('email-address').value.trim();
    const message = document.getElementById('email-message').value.trim();
    let isValid = true;

    if (!name) {
      document.getElementById('email-name-error').classList.remove('hidden');
      document.getElementById('email-name').focus();
      isValid = false;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      document.getElementById('email-address-error').classList.remove('hidden');
      if (isValid) document.getElementById('email-address').focus();
      isValid = false;
    }
    if (!message) {
      document.getElementById('email-message-error').classList.remove('hidden');
      if (isValid) document.getElementById('email-message').focus();
      isValid = false;
    }

    if (!isValid) return;

    try {
      // Simular envío a una API (reemplaza con tu endpoint real)
      // const response = await fetch(EMAIL_API, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': 'Bearer YOUR_API_TOKEN' // Usa el token de .env
      //   },
      //   body: JSON.stringify({
      //     name: DOMPurify.sanitize(name),
      //     email: DOMPurify.sanitize(email),
      //     message: DOMPurify.sanitize(message)
      //   })
      // });
      const response = "enviado";
      if (response) {
        emailFormContainer.innerHTML = `
          <div class="p-4 text-center">
            <p class="text-green-600 font-medium mb-4">¡Consulta enviada con éxito!</p>
            <p class="text-sm text-gray-600">Le responderemos a la brevedad. Gracias por contactarnos.</p>
          </div>
        `;
        setTimeout(() => {
          emailFormContainer.style.display = 'none';
          document.getElementById('chat-open-btn').style.display = 'flex';
        }, 3000);
      } else {
        throw new Error('Error al enviar la consulta');
      }
    } catch (error) {
      emailFormContainer.innerHTML = `
        <div class="p-4 text-center">
          <p class="text-red-600 font-medium mb-4">Error al enviar la consulta</p>
          <p class="text-sm text-gray-600">Por favor, intenta de nuevo más tarde.</p>
        </div>
      `;
      setTimeout(() => {
        emailFormContainer.style.display = 'none';
        document.getElementById('chat-open-btn').style.display = 'flex';
      }, 3000);
    }
  });
}

function createChatWidget(key) {
  const room = key;
  // Guardar la sala/ID de chat globalmente para que otros flujos la usen
  window.currentRoom = room;

  // Verificar si está en horario laboral
  if (isBusinessHours()) {
    // Crear widget de chat
    if (chatSocket) {
      chatSocket.emit('joinRoom', room);
    }

    const widget = document.createElement('div');
    widget.id = 'mi-chat-widget';
    widget.className = 'fixed bottom-1 right-1 w-96 max-w-[99%] h-[690px] bg-white shadow-2xl rounded-2xl overflow-hidden flex flex-col z-50 transition-all duration-300 transform scale-0 border border-gray-200';
    widget.innerHTML = `
      <div class="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-t-2xl flex justify-between items-center shadow-md">
        <div class="flex items-center space-x-2">
          <div class="w-3 h-3 rounded-full bg-green-400 animate-pulse"></div>
          <h2 class="text-lg font-semibold">ChatSAT</h2>
        </div>
        <button id="close-chat" class="text-white hover:bg-blue-800 w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-200">
          <span class="text-xl">&times;</span>
        </button>
      </div>
      <div id="chat-content" class="flex-1 p-4 bg-gradient-to-b from-gray-50 to-gray-100 overflow-y-auto space-y-3 font-sans"></div>
      <div id="chat-input-container" class="p-4 bg-white border-t border-gray-200 hidden">
        <div id="file-preview" class="hidden mb-2 p-2 bg-blue-50 rounded-lg">
          <div class="flex items-center justify-between">
            <span id="file-name" class="text-sm text-blue-700 truncate"></span>
            <button id="remove-file" class="text-red-500 hover:text-red-700">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
        <div class="flex items-center space-x-2">
          <label class="p-2 text-gray-500 hover:text-blue-600 cursor-pointer rounded-full hover:bg-gray-100 transition-colors">
            <input type="file" id="file-upload" class="hidden" accept="image/*,.pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </label>
          <input id="chat-input" type="text" placeholder="Escribe tu mensaje..." 
            class="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:outline-none transition-all duration-200 font-sans text-gray-700">
          <button id="send-message" class="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg transition-colors duration-200">
            Enviar
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(widget);

    // Inicializar formulario de registro
    showRegistrationForm();

    // Eventos de cierre
    const closeBtn = document.getElementById('close-chat');
    closeBtn.addEventListener('click', () => {
      //endChatSession();
      document.getElementById('mi-chat-widget').style.display = 'none';
      document.getElementById('chat-open-btn').style.display = 'flex';
      clearTimeout(inactivityTimer);
    });

    // Mostrar widget con animación
    setTimeout(() => widget.classList.add('scale-100'), 10);
    startInactivityTimer();
  } else {
    // Mostrar formulario de consulta por correo
    showEmailForm();
  }

  // Botón flotante (siempre visible)
  const openBtn = document.createElement('button');
  openBtn.id = 'chat-open-btn';
  openBtn.className = 'fixed bottom-5 right-5 bg-blue-600 text-white w-14 h-14 rounded-full shadow-lg hover:bg-blue-700 hover:scale-110 transition-all duration-200 z-50 flex items-center justify-center';
  openBtn.innerHTML = '<span class="text-2xl">💬</span>';
  openBtn.onclick = () => {
    if (isBusinessHours()) {
      // Mostrar widget de chat
      document.getElementById('mi-chat-widget').style.display = 'flex';
      setTimeout(() => document.getElementById('mi-chat-widget').classList.add('scale-100'), 10);
      startInactivityTimer();
    } else {
      // Mostrar formulario de consulta
      showEmailForm();
    }
    openBtn.style.display = 'none';
  };
  document.body.appendChild(openBtn);

  // Asegurar que el widget de chat o el formulario de correo estén inicialmente ocultos
  if (document.getElementById('mi-chat-widget')) {
    document.getElementById('mi-chat-widget').style.display = 'none';
  }
  if (document.getElementById('email-form-widget')) {
    document.getElementById('email-form-widget').style.display = 'none';
  }
}

// Mostrar formulario de registro
function showRegistrationForm() {
  const content = document.getElementById('chat-content');
  content.innerHTML = `
    <div class="p-0">
      <div class="text-center mb-6">
        <h3 class="text-xl font-bold text-gray-800 mb-2">Bienvenido al ChatSAT</h3>
        <p class="text-sm text-gray-600">Por favor completa tus datos para comenzar</p>
      </div>
      <form id="registration-form" class="space-y-4">
        <div class="space-y-1">
          <label for="doc-type" class="block text-sm font-medium text-gray-700">Tipo de Documento</label>
          <select id="doc-type" class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200">
            <option value="">Seleccione una opción</option>
            <option value="DNI" select>DNI</option>
            <option value="Pasaporte">Pasaporte</option>
            <option value="RUC">RUC</option>
          </select>
          <p id="doc-type-error" class="text-red-500 text-xs mt-1 hidden">Por favor seleccione un tipo de documento</p>
        </div>
        <div class="space-y-1">
          <label for="doc-number" class="block text-sm font-medium text-gray-700">N° de Documento</label>
          <input id="doc-number" value="" type="text" class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200" placeholder="Ingrese su número de documento">
          <p id="doc-number-error" class="text-red-500 text-xs mt-1 hidden">Por favor ingrese un número de documento válido</p>
        </div>
        <div class="space-y-1">
          <label for="names" class="block text-sm font-medium text-gray-700">Nombres Completos</label>
          <input id="names" value="" type="text" class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200" placeholder="Ingrese sus nombres completos">
          <p id="names-error" class="text-red-500 text-xs mt-1 hidden">Por favor ingrese sus nombres completos</p>
        </div>
        <div class="space-y-1">
          <label for="email" class="block text-sm font-medium text-gray-700">Correo Electrónico</label>
          <input id="email" value="" type="email" class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200" placeholder="ejemplo@correo.com">
          <p id="email-error" class="text-red-500 text-xs mt-1 hidden">Por favor ingrese un correo electrónico válido</p>
        </div>
        <div class="space-y-1">
          <label for="phone" class="block text-sm font-medium text-gray-700">Número de Celular</label>
          <div class="relative">
            <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <span class="text-gray-500">+51</span>
            </div>
            <input id="phone" value="" type="tel" class="w-full p-3 pl-16 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200" placeholder="912 345 678">
          </div>
          <p id="phone-error" class="text-red-500 text-xs mt-1 hidden">Por favor ingrese un número de celular válido</p>
        </div>
        <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50">
          Continuar al Chat
        </button>
      </form>
    </div>
  `;

  document.getElementById('registration-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    // Resetear mensajes de error
    document.querySelectorAll('[id$="-error"]').forEach(el => el.classList.add('hidden'));
    
    // Validar campos
    const docType = document.getElementById('doc-type').value;
    const docNumber = document.getElementById('doc-number').value.trim();
    const names = document.getElementById('names').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    
    let isValid = true;
    
    // Validar tipo de documento
    if (!docType) {
      document.getElementById('doc-type-error').classList.remove('hidden');
      document.getElementById('doc-type').focus();
      isValid = false;
    }
    
    // Validar número de documento según el tipo
    if (!docNumber) {
      document.getElementById('doc-number-error').textContent = 'Este campo es obligatorio';
      document.getElementById('doc-number-error').classList.remove('hidden');
      if (isValid) document.getElementById('doc-number').focus();
      isValid = false;
    } else if (docType === 'DNI' && (!/^[0-9]{8}$/.test(docNumber))) {
      document.getElementById('doc-number-error').textContent = 'El DNI debe tener 8 dígitos';
      document.getElementById('doc-number-error').classList.remove('hidden');
      if (isValid) document.getElementById('doc-number').focus();
      isValid = false;
    } else if (docType === 'RUC' && !/^[0-9]{11}$/.test(docNumber)) {
      document.getElementById('doc-number-error').textContent = 'El RUC debe tener 11 dígitos';
      document.getElementById('doc-number-error').classList.remove('hidden');
      if (isValid) document.getElementById('doc-number').focus();
      isValid = false;
    }
    
    // Validar nombres
    if (!names) {
      document.getElementById('names-error').classList.remove('hidden');
      if (isValid) document.getElementById('names').focus();
      isValid = false;
    } else if (names.length < 3) {
      document.getElementById('names-error').textContent = 'El nombre debe tener al menos 3 caracteres';
      document.getElementById('names-error').classList.remove('hidden');
      if (isValid) document.getElementById('names').focus();
      isValid = false;
    }
    
    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      document.getElementById('email-error').textContent = 'Este campo es obligatorio';
      document.getElementById('email-error').classList.remove('hidden');
      if (isValid) document.getElementById('email').focus();
      isValid = false;
    } else if (!emailRegex.test(email)) {
      document.getElementById('email-error').textContent = 'Ingrese un correo electrónico válido';
      document.getElementById('email-error').classList.remove('hidden');
      if (isValid) document.getElementById('email').focus();
      isValid = false;
    }
    
    // Validar teléfono
    if (!phone) {
      document.getElementById('phone-error').textContent = 'Este campo es obligatorio';
      document.getElementById('phone-error').classList.remove('hidden');
      if (isValid) document.getElementById('phone').focus();
      isValid = false;
    } else if (!/^[0-9]{9}$/.test(phone)) {
      document.getElementById('phone-error').textContent = 'Ingrese un número de celular válido (9 dígitos)';
      document.getElementById('phone-error').classList.remove('hidden');
      if (isValid) document.getElementById('phone').focus();
      isValid = false;
    }
    
    // Si todo es válido, continuar
    if (isValid) {
      userData = {
        docType,
        docNumber,
        names,
        email,
        phone: `51${phone}` // Agregar código de país
      };
      
      // Mostrar animación de carga
      const submitBtn = e.target.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <div class="flex items-center justify-center space-x-2">
          <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          <span>Procesando...</span>
        </div>
      `;
      
      // Función para intentar el registro
      const attemptRegistration = () => {
        if (chatSocket && chatSocket.connected) {
          // Enviar datos de registro al servidor
          chatSocket.emit('registerUser', userData, (response) => {
            // Esta función de callback se ejecutará cuando el servidor confirme la recepción
            if (response && response.success) {
              userCiudadano = response.citizen;

              API_TOKEN =   `Bearer ${response.citizen.accessToken}` ;
              console.log("obtener datos ciudadano", API_TOKEN );

              initializeSockets();

              showConfirmationCard();
            } else {
              console.error('Error en el registro:', response ? response.error : 'Error desconocido');
              alert('Error al registrar el usuario: ' + (response?.error || 'Error desconocido'));
            }
            
            // Restaurar el botón
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
          });
        } else {
          // Intentar reconectar y volver a intentar
          console.log('Socket no conectado, intentando reconectar...');
          initializeSockets()
            .then(() => {
              if (chatSocket && chatSocket.connected) {
                attemptRegistration();
              } else {
                throw new Error('No se pudo establecer la conexión');
              }
            })
            .catch(err => {
              console.error('Error al reconectar el socket:', err);
              alert('No se pudo establecer la conexión. Por favor, recarga la página e intenta de nuevo.');
              submitBtn.disabled = false;
              submitBtn.innerHTML = originalBtnText;
            });
        }
      };
      
      // Iniciar el proceso de registro
      attemptRegistration();
    }
  });
}

async function getPublicIP() {
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    const data = await res.json();
    return data.ip; // la IP pública
  } catch (e) {
    console.error("Error obteniendo IP:", e);
    return "IP desconocida";
  }
}

// Mostrar card de confirmación
async function showConfirmationCard() {
  const ip = await getPublicIP(); // obtener IP pública primero

  const content = document.getElementById('chat-content');
  content.innerHTML = `
    <div class="p-4 text-center">
      <h3 class="text-lg font-semibold mb-4">CENTRO DE ATENCIÓN VÍA CHAT</h3>
      <p class="mb-2">Nombres: ${userData.names}</p>
      <p class="mb-2">Correo : ${userData.email}</p>
      <p class="mb-2">Dirección IP: ${ip}</p>
      
      <h4 class="text-lg font-semibold mb-4">POLÍTICAS DEL SERVICIO</h4>
      <p class="mb-2">Se prohíbe el uso de lenguaje ofensivo hacia los orientadores que prestan este servicio, caso contrario, se dará por finalizada la sesión de Chat.</p>
      <p class="mb-2">Se dará por terminada una sesión del Chat, a quien no respete la política de servicio o abandone la sesión por más de 10 minutos.</p>
      <p class="text-lg font-semibold mb-4">La Administración se reserva el derecho de limitar el número de accesos por Dirección IP.</p>
      
      <strong>Usted participa de esta conversación como : ${userData.names}</strong>
      <button id="start-chat" class="w-full bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-colors mt-4">Iniciar</button>
    </div>
  `;

  document.getElementById('start-chat').addEventListener('click', showAdvisorSelection);
}

// Mostrar selección de asesor
function showAdvisorSelection() {
  const content = document.getElementById('chat-content');

  // Manejar clic en el botón
  startChat();
  
}

// Iniciar el chat
async function  startChat()  {
  try {
  
    const content = document.getElementById('chat-content');
    const inputContainer = document.getElementById('chat-input-container');
    const messageInput = document.getElementById('chat-input');  // Cambiado de 'message-input' a 'chat-input'
    const messageFile = document.getElementById('file-upload');  // Cambiado de 'message-input' a 'chat-input'
    const sendButton = document.getElementById('send-message');   // Cambiado de 'send-button' a 'send-message'

    messageFile.addEventListener("change", async () => {
      const fileChange = messageFile?.files?.[0];
      let fileDatachange = null;

      const getBases64 = (file) => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => 
              resolve(reader.result.split(",")[1]); 
              // 🔹 devuelve solo el contenido base64, sin el "data:image/png;base64," al inicio

            reader.onerror = (error) => reject(error);

            reader.readAsDataURL(file);
          });
      };

      if (fileChange) {

        const base64Content = await getBases64(fileChange);
           const extension = fileChange.name.split(".").pop();

          fileDatachange = {
            name: fileChange.name,
            type: fileChange.type,
            extension: extension,
            content: base64Content
          };

        const messageDataview = {
              msg: "",
              room: window.currentRoom,
              user: userCiudadano,
              advisor: selectedAdvisor,
              timestamp: new Date().toISOString(),
              file: fileDatachange 
          };
          
          console.log(messageDataview)
          // Enviar mensaje al servidor de chat principal
          if (chatSocket) {
             chatSocket.emit('chatMessage', messageDataview);
             addMessage('Tú', '', true,fileDatachange);
          }

           messageFile.value = "";
      }
    });

    // Verificar elementos críticos
    if (!content) {
      console.error('No se encontró el contenedor del chat');
      return;
    }
    
    // Limpiar el contenido
    content.innerHTML = '';
    
    // Mostrar contenedor de entrada si existe
    if (inputContainer) {
      inputContainer.classList.remove('hidden');
    } else {
      console.warn('No se encontró el contenedor de entrada del chat');
      return; // Salir si no hay contenedor de entrada
    }
    
    // Verificar y habilitar campo de entrada
    if (!messageInput) {
      console.error('No se encontró el campo de entrada de mensaje');
      return;
    }
    messageInput.disabled = false;
    messageInput.placeholder = 'Escribe tu mensaje...';
    
    // Verificar y habilitar botón de enviar
    if (!sendButton) {
      console.error('No se encontró el botón de enviar');
      return;
    }
    sendButton.disabled = false;
    
    // Mostrar mensaje de bienvenida
    // addMessage('Sistema', `Conectando con al chatsat...`, false,false);
    
    // Configurar eventos del chat
    setupChatEvents();
    
    // Mostrar mensajes iniciales
    showInitialMessages();
    
    // Enfocar el campo de entrada
    setTimeout(() => {
      messageInput.focus();
    }, 500);
    
  } catch (error) {
    console.error('Error en startChat:', error);
    addMessage('Sistema', 'Error al iniciar el chat. Por favor, intenta de nuevo.', false,false);
  }
}

// Mostrar mensajes iniciales del chat
async function showInitialMessages() {

  try {

    const response = await fetch(`${chanet_conector_url}/get-automatic-messages`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json', 'Authorization': API_TOKEN },
       body: JSON.stringify({}),
    });

    const messagesAutomatic = await response.json(); 

    if (Array.isArray(messagesAutomatic)) {
      messagesAutomatic.forEach(msg => addMessage('Asesor', msg, false, false));
    } else {
      addMessage('Asesor', messagesAutomatic.toString(), false, false);
    }


  } catch (error) {
    console.error('Error al obtener mensajes automáticos:', error);
  }

}

function addMessage(user, msg, isUser, file = false) {

  console.log(msg);

  const content = document.getElementById('chat-content');
  if (!content) return; // Evitar errores si no existe el contenedor

  const msgDiv = document.createElement('div');
  msgDiv.className = `mb-2 flex ${isUser ? 'justify-end' : 'justify-start'} animate-fadeIn`;

  const innerDiv = document.createElement('div');
  innerDiv.className = `relative min-w-[80px] max-w-[80%] px-3 py-3 rounded-2xl shadow-md ${
    isUser ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-200 text-gray-900 rounded-bl-none'
  }`;

  // Procesar mensaje como markdown + sanitizar
  const htmlMsg = marked.parse(msg || '', {  
    breaks: true,
    gfm: true,
    mangle: false,
    headerIds: false,
    sanitize: false, 
  });
  
  const sanitizedHtml = DOMPurify.sanitize(htmlMsg);

  if (sanitizedHtml) {
    const wrapper = document.createElement('div');
    wrapper.className =
      'text-sm leading-relaxed whitespace-pre-wrap break-words overflow-hidden overflow-wrap-anywhere';
    wrapper.innerHTML = sanitizedHtml;

    // 🔗 Detectar y ajustar enlaces externos
    const links = wrapper.querySelectorAll('a[href^="http"]');
    links.forEach(link => {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
      link.classList.add(
        'text-blue-600',
        'underline',
        'hover:text-blue-800',
        'break-all'
      );
    });

    innerDiv.appendChild(wrapper);
  }

  // Manejar archivo adjunto
  if (file && file.content) {
    if (file.type?.startsWith('image')) {
      const img = document.createElement('img');
      const fileSrc = `data:${file.type};base64,${file.content}`;
      img.src = fileSrc;
      img.alt = 'Imagen enviada';
      img.className = 'mt-2 rounded-lg max-h-56 cursor-pointer hover:opacity-90 transition-all duration-200';
      img.title = 'Abrir imagen en una nueva pestaña';
      img.setAttribute('aria-label', 'Imagen enviada por el usuario');
      img.onclick = () => window.open(fileSrc, '_blank');
      innerDiv.appendChild(img);
    } else {
      // Generar nombre y tamaño de archivo
      const fileExtension = file.extension || getExtensionFromMimeType(file.type) || 'dat';
      const fileName = DOMPurify.sanitize(file.name || `archivo_${Date.now()}.${fileExtension}`);
      const fileSize = file.size ? formatFileSize(file.size) : 'Desconocido';

      // Ícono según tipo de archivo
      const icon = getFileIcon(file.type);

      const link = document.createElement('a');
      link.href = `data:${file.type || 'application/octet-stream'};base64,${file.content}`;
      link.download = fileName;
      link.className = 'mt-2 inline-flex items-center gap-2 bg-blue-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-blue-700 hover:shadow-md hover:scale-105 transition-all duration-200';
      link.title = `Descargar ${fileName} (${fileSize})`;
      link.setAttribute('aria-label', `Descargar archivo ${fileName}`);
      link.innerHTML = `
        ${icon}
        <span class="truncate max-w-[150px]">${fileName}</span>
      `;
      innerDiv.appendChild(link);
    }
  }

  // Agregar timestamp
  const timeSpan = document.createElement('span');
  timeSpan.className = 'absolute bottom-0 right-2 text-[10px] opacity-70';
  timeSpan.textContent = new Date().toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Lima'
  });
  innerDiv.appendChild(timeSpan);

  msgDiv.appendChild(innerDiv);
  content.appendChild(msgDiv);
  content.scrollTop = content.scrollHeight;

  // Guardar historial
  chatHistory.push({ user, msg, file, time: timeSpan.textContent });
 //localStorage.setItem('chatHistory', JSON.stringify(chatHistory.slice(-100))); // Limitar historial
}

// Helper: Obtener extensión desde MIME type
function getExtensionFromMimeType(mimeType) {
  const mimeToExt = {
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'text/plain': 'txt',
    'application/zip': 'zip',
    'application/octet-stream': 'dat'
  };
  return mimeToExt[mimeType] || null;
}

// Helper: Formatear tamaño de archivo
function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

// Helper: Obtener ícono según tipo de archivo
function getFileIcon(mimeType) {
  if (mimeType?.startsWith('application/pdf')) {
    return `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 2a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6H6zm6 1.5L18.5 8H12V3.5zM8 12h8v2H8v-2zm0 4h8v2H8v-2z"/></svg>`;
  } else if (mimeType?.includes('word')) {
    return `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM7 18h10v-2H7v2zm0-4h10v-2H7v2z"/></svg>`;
  } else {
    return `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 2a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6H6zm6 1.5L18.5 8H12V3.5z"/></svg>`;
  }
}


// Cargar historial
function loadChatHistory() {
  chatHistory.forEach(({ user, msg }) => addMessage(user, msg, user === 'Usuario',false));
}

// Configurar eventos del chat
function setupChatEvents() {
  const input = document.getElementById('chat-input');
 
  const sendBtn = document.getElementById('send-message');
  
  if (!input || !sendBtn) {
    return;
  }


  // Remover event listeners existentes para evitar duplicados
  const newSendBtn = sendBtn.cloneNode(true);
  sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);
  
  // Configurar el nuevo botón
  newSendBtn.addEventListener('click', handleSendMessage);
  
  // Configurar evento de teclado en el input
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });
  

  // Enfocar el campo de entrada
  setTimeout(() => {
    input.focus();
  }, 100);
}


// Función para manejar el envío de mensajes
const handleSendMessage = async () => {
  const input = document.getElementById('chat-input');
  const inputFile = document.getElementById('file-upload');

  // if (!input) {
  //   console.error('No se encontró el campo de entrada de mensaje');
  //   return;
  // }
  
  const message = input.value.trim();
  const file = inputFile?.files?.[0];
  if (!message) return;
  

  const getBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]); // quitamos el encabezado data:
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  let fileData = null;

  if (file) {
    const base64Content = await getBase64(file);
    const extension = file.name.split(".").pop();
    fileData = {
      name: file.name,
      type: file.type,
      extension: extension,
      content: base64Content
    };
  }
  // Crear objeto de mensaje para el chat principal
  const messageData = {
    msg: message || (file ? "📎 Archivo enviado" : ""),
    room: window.currentRoom,
    user: userCiudadano,
    advisor: selectedAdvisor || { id: 'default-advisor' },
    timestamp: new Date().toISOString(),
    file: fileData 
  };
 
  // Enviar mensaje al servidor de chat principal
  if (chatSocket) {
    chatSocket.emit('chatMessage', messageData);
    
    // Añadir mensaje a la interfaz
    addMessage('Tú', message, true,fileData);
    
    // Actualizar historial
    chatHistory.push({
      user: 'Tú',
      message: message,
      timestamp: new Date().toISOString(),
      isUser: true
    });
    
    // Limpiar el input
    input.value = '';
    input.inputFile = '';
    if (inputFile) inputFile.value = '';
    // Desplazarse al final del chat
    const chatContent = document.getElementById('chat-content');
    if (chatContent) {
      chatContent.scrollTop = chatContent.scrollHeight;
    }
    
    // Enviar también al socket secundario si es necesario
    if (secondarySocket) {
      secondarySocket.emit('customEvent', {
        type: 'chat_message',
        message: message,
        file: fileData,
        userId: userData ? userData.id : 'anonymous',
        timestamp: new Date().toISOString()
      });
    }
    
    // Reiniciar temporizador de inactividad
    resetInactivityTimer();
  } else {
    console.error('El socket de chat no está disponible');
  }
  
  // Configurar eventos de escritura
  input.addEventListener('input', () => {
    if (chatSocket) {
      chatSocket.emit('typing', { 
        user: userData ? userData.name : 'Usuario',
        room: window.currentRoom || 'default'
      });
    }
  });
  
  // Escuchar mensajes entrantes
  if (chatSocket) {
    chatSocket.on('message', (data) => {
      console.log("Escuchar mensajes entrantes si socket", data);
      if (data.user && data.msg) {
        addMessage(data.user, data.msg, false,fileData);
        
        // Actualizar historial
        chatHistory.push({
          user: data.user,
          message: data.msg,
          timestamp: new Date().toISOString(),
          isUser: false
        });
        
        localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
        
        // Desplazarse al final del chat
        const chatContent = document.getElementById('chat-content');
        if (chatContent) {
          chatContent.scrollTop = chatContent.scrollHeight;
        }
      }
    });
  }
}

  // Los manejadores de eventos ya están configurados en la función setupChatEvents

// Temporizador de inactividad
function startInactivityTimer() {
  inactivityTimer = setTimeout(endChatSession, 50 * 90 * 1000); // 3 minutos
}

function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  startInactivityTimer();
} 

// Finalizar sesión
function endChatSession() {}

function showSatisfactionSurvey() {

  document.getElementById('chat-input-container').classList.add('hidden');
  const content = document.getElementById('chat-content');

  content.innerHTML = `
    <div class="p-6 bg-white rounded-xl shadow-lg max-w-md mx-auto">
      <h3 class="text-xl font-bold mb-4 text-gray-800">Encuesta de Satisfacción</h3>
      <p class="text-sm text-gray-500 mb-6">¿Qué tan satisfecho  te encuentras con el servicio?</p>

      <div class="flex flex-col sm:flex-row gap-3 mb-6">
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="radio" name="rating" value="1" class="accent-green-600 h-4 w-4">
          <span class="text-gray-700 font-medium">Satisfecho</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="radio" name="rating" value="0" class="accent-red-600 h-4 w-4">
          <span class="text-gray-700 font-medium">No satisfecho</span>
        </label>
      </div>

      <div id="motivo-container" class="hidden mb-6 animate-fadeIn">
        <p class="text-sm text-gray-700 mb-2 font-medium">Por favor, señale el motivo:</p>
        <div class="space-y-2">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="motivo" value="No solucionó mi problema" class="accent-red-600 h-4 w-4">
            <span class="text-gray-600">No solucionó mi problema</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="motivo" value="Información errónea" class="accent-red-600 h-4 w-4">
            <span class="text-gray-600">Información errónea</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="motivo" value="No recibí un trato amable" class="accent-red-600 h-4 w-4">
            <span class="text-gray-600">No recibí un trato amable</span>
          </label>
        </div>
      </div>

      <button id="submit-survey" class="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors duration-200 font-medium">
        Enviar Encuesta
      </button>
    </div>
  `;

  document.querySelectorAll('input[name="rating"]').forEach(radio => {
    radio.addEventListener('change', e => {
      document.getElementById('motivo-container').classList.toggle('hidden', e.target.value !== "0");
    });
  });

  document.getElementById('submit-survey').addEventListener('click', async () => {
    const selectedRating = document.querySelector('input[name="rating"]:checked');
    const selectedMotivo = document.querySelector('input[name="motivo"]:checked');

    if (!selectedRating) return alert('Por favor, seleccione una opción.');
    if (selectedRating.value === "0" && !selectedMotivo)
      return alert('Por favor, seleccione el motivo.');

    const requestEncuesta = {
      assistanceId: messageNew.assistanceId,
      channelRoomId: messageNew.channelRoomId,
      citizenId: messageNew.citizenId,
      userId: messageNew.userId,
      rating: parseInt(selectedRating.value, 10),
      comment: selectedMotivo ? selectedMotivo.value : ''
    };

    console.log('Encuesta enviada:', requestEncuesta);
    try {
      const response = await fetch(SURVEY_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': API_TOKEN },
        body: JSON.stringify(requestEncuesta),
      });
      if (!response.ok) throw new Error(`API request failed: ${response.status}`);

      content.innerHTML = `
        <div class="p-4 text-center">
          <svg class="w-12 h-12 text-green-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
          </svg>
          <h3 class="text-lg font-semibold text-gray-800 mb-2">¡Gracias por tu feedback!</h3>
          <p class="text-sm text-gray-600">Gracias por tu respuesta, nos servirá para mejorar nuestra atención.🤖 Recuerda que si tienes una consulta puedes escribirme las 24 horas del día..</p>
        </div>
      `;
      setTimeout(() => {
        const widget = document.getElementById('mi-chat-widget');
        const openBtn = document.getElementById('chat-open-btn');
        if (widget && openBtn) {
          widget.style.display = 'none';
          openBtn.style.display = 'flex';
          userCiudadano = null;
        }
        showRegistrationForm();
      }, 5000);
    } catch (error) {
      alert('Hubo un error al enviar la encuesta. Intente de nuevo.');
    }
  });
}




// Exposición global
window.miChat = { init: createChatWidget };
console.log('window.miChat definido:', window.miChat);
