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
      const isFile = (typeof location !== 'undefined' && location.protocol === 'file:');
   
      const chatOrigin = window.__ENV.SOCKET_CHAT_ORIGIN;
    
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

  // Cargar configuración pública desde el servidor antes de chat.js
  (function(){
    const isFile = (typeof location !== 'undefined' && location.protocol === 'file:');
    const defaultOrigin = 'http://localhost:4000';
    const configUrl = isFile ? `${defaultOrigin}/config.js` : '/config.js';
    loadScript(configUrl, checkAllLoaded, function() {
      console.warn('No se pudo cargar /config.js, se usarán valores por defecto');
      checkAllLoaded();
    });
  })();
})();
