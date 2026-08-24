// js/firebase-config.js - Configuración e Inicialización de Firebase Auth
// Proyecto: emprendimiento-f8b3a

const defaultFirebaseConfig = {
    apiKey: "", // Coloca aquí tu apiKey de la consola si pruebas fuera de Firebase Hosting
    authDomain: "emprendimiento-f8b3a.firebaseapp.com",
    projectId: "emprendimiento-f8b3a",
    storageBucket: "emprendimiento-f8b3a.appspot.com"
};

// Inicialización de Firebase
try {
    if (typeof firebase !== 'undefined') {
        if (!firebase.apps.length) {
            // Intentar inicializar con la configuración base
            const savedConfigStr = localStorage.getItem('cotizador_firebase_config');
            const activeConfig = savedConfigStr ? JSON.parse(savedConfigStr) : defaultFirebaseConfig;
            
            if (activeConfig.apiKey || activeConfig.projectId) {
                firebase.initializeApp(activeConfig);
                console.log('Firebase Inicializado con Éxito:', activeConfig.projectId);
            }
        }
    }
} catch (e) {
    console.warn('Error inicializando Firebase:', e);
}

// Helper para traducir errores comunes de Firebase Auth al español
window.getFirebaseAuthErrorMessage = function(errorCode) {
    switch (errorCode) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
            return 'Contraseña incorrecta o usuario no válido.';
        case 'auth/user-not-found':
            return 'No existe ningún usuario registrado en Firebase con este correo.';
        case 'auth/invalid-email':
            return 'El formato del correo electrónico no es válido.';
        case 'auth/user-disabled':
            return 'Este usuario ha sido deshabilitado en Firebase Console.';
        case 'auth/too-many-requests':
            return 'Demasiados intentos fallidos. Por favor espera unos minutos o restablece la clave.';
        case 'auth/network-request-failed':
            return 'Error de red o conexión a internet al conectar con Firebase.';
        case 'auth/invalid-api-key':
            return 'La API Key de Firebase no es válida. Configúrala en la consola de Firebase.';
        default:
            return 'Error de autenticación en Firebase: ' + errorCode;
    }
};
