// js/firebase-config.js - Configuración Oficial de Firebase para 'emprendimiento-f8b3a'

const firebaseConfig = {
    apiKey: "AIzaSyAF9GFpu6wkJNzILj9rij1vBvVI1DaX-CI",
    authDomain: "emprendimiento-f8b3a.firebaseapp.com",
    projectId: "emprendimiento-f8b3a",
    storageBucket: "emprendimiento-f8b3a.firebasestorage.app",
    messagingSenderId: "1078881555420",
    appId: "1:1078881555420:web:4508f3b0179aad4927f519",
    measurementId: "G-BHFTRYHG0M"
};

// Inicialización de Firebase
try {
    if (typeof firebase !== 'undefined') {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
            console.log('Firebase Inicializado con éxito: emprendimiento-f8b3a');
        }
    }
} catch (err) {
    console.error('Error inicializando Firebase:', err);
}

// Helper para traducir errores de Firebase Auth al español
window.getFirebaseAuthErrorMessage = function(errorCode) {
    switch (errorCode) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
            return 'Contraseña incorrecta o usuario no válido.';
        case 'auth/user-not-found':
            return 'No existe ningún usuario registrado con este correo en Firebase.';
        case 'auth/invalid-email':
            return 'El formato del correo electrónico no es válido.';
        case 'auth/user-disabled':
            return 'Este usuario ha sido deshabilitado en Firebase.';
        case 'auth/too-many-requests':
            return 'Demasiados intentos fallidos. Por favor espera unos minutos.';
        case 'auth/network-request-failed':
            return 'Error de conexión a internet.';
        case 'auth/operation-not-allowed':
            return 'El proveedor de Correo/Contraseña no está habilitado en Authentication > Sign-in method.';
        default:
            return 'Error al iniciar sesión: ' + errorCode;
    }
};
