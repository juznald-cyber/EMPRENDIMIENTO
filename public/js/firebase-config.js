// js/firebase-config.js - Configuración e Inicialización de Firebase Auth
// Proyecto: emprendimiento-f8b3a

let defaultFirebaseConfig = {
    apiKey: "", // Se autocompleta con lo guardado en localStorage si se usa en GitHub Pages
    authDomain: "emprendimiento-f8b3a.firebaseapp.com",
    projectId: "emprendimiento-f8b3a",
    storageBucket: "emprendimiento-f8b3a.appspot.com",
    messagingSenderId: "1064249156382",
    appId: "1:1064249156382:web:a1b2c3d4e5f6"
};

function getActiveFirebaseConfig() {
    const saved = localStorage.getItem('cotizador_firebase_config');
    if (saved) {
        try {
            return { ...defaultFirebaseConfig, ...JSON.parse(saved) };
        } catch (e) {
            console.error('Error parsing saved firebase config', e);
        }
    }
    return defaultFirebaseConfig;
}

// Inicializar Firebase
function initFirebaseApp() {
    try {
        if (typeof firebase !== 'undefined') {
            const config = getActiveFirebaseConfig();
            if (!firebase.apps.length) {
                if (config.apiKey && config.apiKey.length > 5) {
                    firebase.initializeApp(config);
                    console.log('Firebase Inicializado correctamente:', config.projectId);
                } else {
                    console.warn('API Key de Firebase no configurada aún.');
                }
            }
        }
    } catch (err) {
        console.warn('Error inicializando Firebase:', err);
    }
}

initFirebaseApp();

// Helper para traducir errores comunes de Firebase Auth
window.getFirebaseAuthErrorMessage = function(errorCode) {
    switch (errorCode) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
            return 'Contraseña incorrecta o usuario no válido.';
        case 'auth/user-not-found':
            return 'No existe ningún usuario registrado con este correo.';
        case 'auth/invalid-email':
            return 'El formato del correo electrónico no es válido.';
        case 'auth/user-disabled':
            return 'Este usuario ha sido deshabilitado.';
        case 'auth/too-many-requests':
            return 'Demasiados intentos fallidos. Espera unos minutos.';
        case 'auth/network-request-failed':
            return 'Error de conexión a internet.';
        case 'auth/invalid-api-key':
        case 'auth/api-key-not-valid':
            return 'La API Key de Firebase no es válida. Por favor configúrala.';
        case 'auth/operation-not-allowed':
            return 'El inicio de sesión con Correo/Contraseña no está habilitado en tu consola de Firebase (Sign-in method).';
        default:
            return 'Error al iniciar sesión: ' + errorCode;
    }
};
