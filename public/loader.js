(function() {
  // Función para cargar scripts dinámicamente
  function loadScript(src, onLoad, onError) {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = onLoad;
    script.onerror = onError || function() { console.error(`Failed to load ${src}`); };
    document.head.appendChild(script);
  }

  // Orden de carga de dependencias
  let loadedScripts = 0;
  const totalScripts = 4; // Socket.io, marked, DOMPurify, config.js

  function checkAllLoaded() {
    loadedScripts++;
    if (loadedScripts === totalScripts) {
      // Cargar chat.js después de todas las dependencias
      const chatOrigin = window.__ENV?.SOCKET_CHAT_ORIGIN || 'http://localhost:4000';
      const chatUrl = `${chatOrigin.replace(/\/$/, '')}/chat.js`;
      
      loadScript(chatUrl, function() {
        if (window.miChat && typeof window.miChat.init === 'function') {
          window.miChat.init(window._miChat.key);
        } else {
          console.error('Error: window.miChat.init no está definido');
        }
      }, function() {
        console.error('No se pudo cargar chat.js');
      });
    }
  }

  // Cargar Socket.io
  loadScript('https://cdn.socket.io/4.7.2/socket.io.min.js', checkAllLoaded);

  // Cargar marked
  loadScript('https://cdn.jsdelivr.net/npm/marked/marked.min.js', checkAllLoaded);

  // Cargar DOMPurify
  loadScript('https://cdn.jsdelivr.net/npm/dompurify/dist/purify.min.js', checkAllLoaded);

  // Cargar configuración pública desde el servidor
  (function(){
    // 🔹 CAMBIO PRINCIPAL: Detectar el origen del script loader.js
    const loaderScript = document.currentScript || 
                         document.querySelector('script[src*="loader.js"]');
    
    let configOrigin = 'http://localhost:4000'; // Fallback por defecto
    
    if (loaderScript && loaderScript.src) {
      // Extraer el origen del URL del loader.js
      const url = new URL(loaderScript.src);
      configOrigin = url.origin;
    }
    
    const configUrl = `${configOrigin}/config.js`;
    
    loadScript(configUrl, checkAllLoaded, function() {
      console.warn('No se pudo cargar config.js desde:', configUrl);
      console.warn('Usando valores por defecto');
      
      // Establecer valores por defecto si falla la carga
      window.__ENV = {
        SOCKET_CHAT_ORIGIN: configOrigin,
        SOCKET_SECONDARY_ORIGIN: `${configOrigin}:3004`,
        CHANET_CONNECTOR_URL: 'https://[DOMINIO_CHANNEL_CONNECTOR]/chatsat',
        API_BASE_URL: 'http://[IP_BACKEND_CRM]/v1'
      };
      
      checkAllLoaded();
    });
  })();
})();
