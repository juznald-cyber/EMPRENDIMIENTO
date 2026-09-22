// js/db.js - Base de Datos Local, Autenticación y Gestor de Estado

// Helper Global para Formato de Moneda y Miles (ej. 14000 -> 14.000 | 14000.5 -> 14.000,50 | 24137.93 -> 24.137,93)
window.formatMoney = function(amount, forceDecimals = false) {
    if (amount === null || amount === undefined || amount === '' || isNaN(amount)) return '0';
    const num = parseFloat(amount);
    if (isNaN(num)) return '0';
    
    const fixed = num.toFixed(2);
    const [intPart, decPart] = fixed.split('.');
    const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    
    if (decPart !== '00') {
        return `${formattedInt},${decPart}`;
    }
    if (forceDecimals === true) {
        return `${formattedInt},${decPart}`;
    }
    return formattedInt;
};

// Helper Global para parsear strings monetarios con puntos de miles y comas decimales
window.parseMoney = function(str) {
    if (str === '' || str === null || str === undefined) return 0;
    if (typeof str === 'number') return isNaN(str) ? 0 : str;
    const s = String(str).trim();
    if (!s) return 0;
    
    // Si contiene punto y coma (ej. 14.000,50 o 14,000.50)
    if (s.includes('.') && s.includes(',')) {
        if (s.indexOf('.') < s.indexOf(',')) {
            return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
        } else {
            return parseFloat(s.replace(/,/g, '')) || 0;
        }
    }
    // Si contiene solo coma: coma es decimal (ej. 14000,50 -> 14000.50)
    if (s.includes(',')) {
        return parseFloat(s.replace(',', '.')) || 0;
    }
    // Si contiene solo puntos (ej. 14.000 o 1.000.000 o 14.50)
    if (s.includes('.')) {
        const parts = s.split('.');
        if (parts.length > 2) {
            return parseFloat(parts.join('')) || 0;
        }
        if (parts.length === 2 && parts[1].length === 3) {
            return parseFloat(parts.join('')) || 0;
        }
        return parseFloat(s) || 0;
    }
    return parseFloat(s) || 0;
};

window.formatNumber = function(amount, decimals = 2) {
    if (amount === null || amount === undefined || isNaN(amount)) return '0';
    const num = parseFloat(amount) || 0;
    const fixed = num.toFixed(decimals);
    const [intPart, decPart] = fixed.split('.');
    const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    if (decimals > 0 && decPart && decPart !== '00') {
        const cleanDec = decPart.replace(/0+$/, '');
        return cleanDec.length > 0 ? `${formattedInt},${cleanDec}` : formattedInt;
    }
    return formattedInt;
};

const DB_KEYS = {
    PROFILE: 'cotizador_profile',
    SUPPLIERS: 'cotizador_suppliers',
    PRODUCTS: 'cotizador_products',
    CATEGORIES: 'cotizador_categories',
    VINYLS: 'cotizador_vinyls',
    QUOTES: 'cotizador_quotes',
    GLOBAL_TIERS: 'cotizador_global_tiers',
    SETTINGS: 'cotizador_settings'
};

// Categorías Iniciales
const DEFAULT_CATEGORIES = [
    'Vinilos',
    'Textil',
    'Promocionales',
    'Insumos',
    'Servicios',
    'Papelería',
    'Sublimación',
    'Gigantografía'
];

// Datos iniciales de perfil
const DEFAULT_PROFILE = {
    companyName: 'Mi Empresa Creativa',
    taxId: 'J-12345678-0',
    phone: '+58 412 1234567',
    email: 'contacto@miempresa.com',
    address: 'Av. Principal, Edificio Centro Empresarial, Local 4B',
    currency: '$',
    currencyCode: 'USD',
    taxRate: 16, // IVA 16% por defecto (configurable)
    enableTax: true,
    logo: 'assets/logo.jpg', // Logo oficial de la aplicación
    bankDetails: 'Banco Nacional - Cta Corriente #0102-0000-00-0000000000\nPago Móvil / Zelle: pagos@miempresa.com',
    terms: '1. Cotización válida por 15 días continuos.\n2. Para iniciar el trabajo se requiere 50% de anticipo y 50% contra entrega.\n3. Los tiempos de producción inician tras la aprobación formal del diseño.'
};

const DEFAULT_GLOBAL_TIERS = [
    { min: 1, max: 10, margin: 50, label: 'Menudeo (1 - 10 un)' },
    { min: 11, max: 50, margin: 40, label: 'Medio Mayoreo (11 - 50 un)' },
    { min: 51, max: 100, margin: 30, label: 'Mayoreo (51 - 100 un)' },
    { min: 101, max: 999999, margin: 20, label: 'Gran Volumen (101+ un)' }
];

const DEFAULT_SUPPLIERS = [
    {
        id: 'sup_1',
        rut: 'J-29837482-1',
        name: 'Distribuidora Gráfica Nacional',
        contact: 'Carlos Rodríguez',
        phone: '+58 414 5551122',
        email: 'ventas@distribuidoragrafica.com',
        category: 'Vinilos',
        notes: 'Descuento del 5% por pronto pago en transferencias.'
    },
    {
        id: 'sup_2',
        rut: 'J-31092834-0',
        name: 'Textiles & Confección Global',
        contact: 'María Elena Pérez',
        phone: '+58 424 9998877',
        email: 'pedidos@textilesglobal.com',
        category: 'Textil',
        notes: 'Entregas los días martes y jueves.'
    },
    {
        id: 'sup_3',
        rut: 'J-40192837-9',
        name: 'Insumos Tecnológicos UV',
        contact: 'Ing. Fernando Mendoza',
        phone: '+58 416 3334455',
        email: 'contacto@insumosuv.com',
        category: 'Insumos',
        notes: 'Distribuidor directo de consumibles DTF UV.'
    }
];

const DEFAULT_PRODUCTS = [
    {
        id: 'prod_1',
        sku: 'VIN-ADH-BLA',
        name: 'Bobina Vinilo Adhesivo Blanco Brillante (1.22m x 50m)',
        supplierId: 'sup_1',
        category: 'Vinilos',
        unit: 'Rollo',
        costPrice: 85.00,
        costTiers: [
            { min: 1, max: 2, cost: 85.00 },
            { min: 3, max: 5, cost: 80.00 },
            { min: 6, max: 999999, cost: 75.00 }
        ],
        defaultMargin: 45,
        useGlobalTiers: true,
        customTiers: [],
        notes: 'Marca Oracal 651 de alta durabilidad en exteriores.'
    },
    {
        id: 'prod_2',
        sku: 'CAM-ALGODON-REG',
        name: 'Franela de Algodón Cuello Redondo Premium',
        supplierId: 'sup_2',
        category: 'Textil',
        unit: 'Unidad',
        costPrice: 4.50,
        costTiers: [
            { min: 1, max: 12, cost: 4.50 },
            { min: 13, max: 50, cost: 3.90 },
            { min: 51, max: 999999, cost: 3.40 }
        ],
        defaultMargin: 50,
        useGlobalTiers: true,
        customTiers: [
            { min: 1, max: 12, margin: 60, label: 'Detal (1 - 12)' },
            { min: 13, max: 50, margin: 45, label: 'Docenas (13 - 50)' },
            { min: 51, max: 999999, margin: 35, label: 'Cientos (51+)' }
        ],
        notes: '100% Algodón 24/1, varios colores disponibles.'
    },
    {
        id: 'prod_3',
        sku: 'GOR-TRUCKER-NEGRA',
        name: 'Gorra Tipo Camionera / Trucker Negra',
        supplierId: 'sup_2',
        category: 'Textil',
        unit: 'Unidad',
        costPrice: 2.20,
        costTiers: [
            { min: 1, max: 10, cost: 2.20 },
            { min: 11, max: 50, cost: 1.90 },
            { min: 51, max: 999999, cost: 1.60 }
        ],
        defaultMargin: 60,
        useGlobalTiers: true,
        customTiers: [],
        notes: 'Frente acolchado de poliéster apto para sublimación o vinilo textil.'
    },
    {
        id: 'prod_4',
        sku: 'TAZA-CER-BLANCA',
        name: 'Taza de Cerámica Blanca 11oz para Personalizar',
        supplierId: 'sup_3',
        category: 'Promocionales',
        unit: 'Unidad',
        costPrice: 1.60,
        costTiers: [
            { min: 1, max: 24, cost: 1.60 },
            { min: 25, max: 999999, cost: 1.30 }
        ],
        defaultMargin: 55,
        useGlobalTiers: true,
        customTiers: [],
        notes: 'Caja individual de regalo incluida.'
    },
    {
        id: 'prod_5',
        sku: 'TRANS-PAPEL-30',
        name: 'Papel Transfer Transportador / Cinta de Aplicación 30cm',
        supplierId: 'sup_1',
        category: 'Insumos',
        unit: 'Metro',
        costPrice: 0.90,
        costTiers: [],
        defaultMargin: 50,
        useGlobalTiers: true,
        customTiers: [],
        notes: 'Adherencia media para corte de vinilo.'
    }
];

const DEFAULT_VINYLS = [
    {
        id: 'vin_adh',
        type: 'adhesivo',
        name: 'Vinilo Adhesivo de Corte (Rotulación / Calcomanía)',
        rollWidthCm: 58,
        rollLengthCm: 100,
        rollCost: 14000,
        rollLabor: 1600,
        costPerM2: 24137.93,
        laborCostPerM2: 2758.62,
        defaultMargin: 50,
        wasteRate: 10,
        description: 'Ideal para rotulación vehicular, vidrieras, señalética y stickers troquelados.',
        unitName: 'm²'
    },
    {
        id: 'vin_uv',
        type: 'uv',
        name: 'Impresión / Transfer DTF UV (Adhesivo para Rígidos)',
        rollWidthCm: 58,
        rollLengthCm: 100,
        rollCost: 24000,
        rollLabor: 2000,
        costPerM2: 41379.31,
        laborCostPerM2: 3448.28,
        defaultMargin: 50,
        wasteRate: 10,
        description: 'Para termos, tazas, plástico, metal, madera y superficies duras sin calor.',
        unitName: 'm²'
    },
    {
        id: 'vin_textil',
        type: 'textil',
        name: 'Vinilo Textil Termotransferible / DTF Textil',
        rollWidthCm: 58,
        rollLengthCm: 100,
        rollCost: 14000,
        rollLabor: 1600,
        costPerM2: 24137.93,
        laborCostPerM2: 2758.62,
        defaultMargin: 50,
        wasteRate: 10,
        description: 'Para estampado de franelas, uniformes, gorras y prendas de vestir.',
        unitName: 'm²'
    },
    {
        id: 'vin_lona',
        type: 'lona',
        name: 'Lona Banner Impresa 13oz con Ojetes',
        rollWidthCm: 100,
        rollLengthCm: 100,
        rollCost: 7000,
        rollLabor: 3500,
        costPerM2: 7000,
        laborCostPerM2: 3500,
        defaultMargin: 45,
        wasteRate: 10,
        description: 'Pancartas, vallas, bastidores y avisos de exterior.',
        unitName: 'm²'
    }
];

const DEFAULT_QUOTES = [
    {
        id: 'COT-1001',
        quoteNumber: 'COT-1001',
        date: new Date().toISOString().split('T')[0],
        validUntil: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
        client: {
            name: 'Restaurante El Gourmet C.A.',
            rut: 'J-40918273-0',
            contact: 'Lic. Alejandro Morales',
            phone: '+58 414 7776655',
            email: 'compras@elgourmet.com',
            address: 'Centro Comercial La Cascada, Nivel Feria'
        },
        items: [
            {
                id: 'item_1',
                productId: 'prod_2',
                name: 'Franela de Algodón Cuello Redondo - Uniforme con Logo Estampado',
                unit: 'Unidad',
                costPrice: 3.90, // Costo por tier de 25 unds
                margin: 45,
                quantity: 25,
                unitPrice: 5.66,
                total: 141.50,
                notes: 'Color negro, tallas variadas (S, M, L)'
            },
            {
                id: 'item_2',
                isVinyl: true,
                vinylType: 'uv',
                name: 'Stickers DTF UV para Personalizar Termos (Medida 8x8 cm)',
                unit: 'm²',
                dimensions: { width: 8, height: 8, count: 100, areaM2: 0.64, unitMode: 'cm' },
                costPrice: 15.36,
                margin: 60,
                quantity: 1,
                unitPrice: 38.40,
                total: 38.40,
                notes: 'Impresión DTF UV en alta resolución barniz incluido'
            }
        ],
        subtotal: 179.90,
        discountPercentage: 0,
        discountAmount: 0,
        taxRate: 16,
        taxAmount: 28.78,
        total: 208.68,
        status: 'Aprobada',
        notes: 'Tiempo estimado de entrega: 5 días hábiles luego del abono inicial.'
    }
];

// Motor de Persistencia y Métodos de Base de Datos
class Database {
    constructor() {
        this._firestoreReady = false;
        this._uid = null;
        this.init();
    }

    // ==========================================
    // FIRESTORE — CONFIGURACIÓN Y SINCRONIZACIÓN
    // ==========================================

    /** Devuelve la referencia al documento del usuario en Firestore */
    _userDoc() {
        if (!this._uid || !this._firestoreReady) return null;
        try {
            return firebase.firestore().collection('usuarios').doc(this._uid);
        } catch (e) {
            return null;
        }
    }

    /**
     * Llamado desde app.js cuando el usuario inicia sesión.
     * Combina de forma segura los datos de Firestore con localStorage para evitar pérdidas.
     */
    async syncFromFirestore(uid) {
        this._uid = uid;
        this._firestoreReady = true;
        const docRef = this._userDoc();
        if (!docRef) return;

        try {
            const snap = await docRef.get();
            if (snap.exists) {
                const data = snap.data();
                
                // 1. Proveedores: merge seguro
                if (Array.isArray(data.suppliers)) {
                    const localSuppliers = this.get(DB_KEYS.SUPPLIERS, []);
                    const mergedSup = [...data.suppliers];
                    localSuppliers.forEach(ls => {
                        if (ls && ls.id && !mergedSup.some(fs => fs.id === ls.id)) {
                            mergedSup.push(ls);
                        }
                    });
                    localStorage.setItem(DB_KEYS.SUPPLIERS, JSON.stringify(mergedSup));
                }

                // 2. Productos: merge seguro (NUNCA borrar productos creados localmente)
                if (Array.isArray(data.products)) {
                    const localProducts = this.get(DB_KEYS.PRODUCTS, []);
                    const mergedProd = [...data.products];
                    localProducts.forEach(lp => {
                        if (lp && lp.id && !mergedProd.some(fp => fp.id === lp.id)) {
                            mergedProd.push(lp);
                        }
                    });
                    localStorage.setItem(DB_KEYS.PRODUCTS, JSON.stringify(mergedProd));
                }

                // 3. Cotizaciones: merge seguro
                if (Array.isArray(data.quotes)) {
                    const localQuotes = this.get(DB_KEYS.QUOTES, []);
                    const mergedQuotes = [...data.quotes];
                    localQuotes.forEach(lq => {
                        if (lq && lq.id && !mergedQuotes.some(fq => fq.id === lq.id)) {
                            mergedQuotes.push(lq);
                        }
                    });
                    localStorage.setItem(DB_KEYS.QUOTES, JSON.stringify(mergedQuotes));
                }

                // 4. Categorías, Perfil, Vinilos, GlobalTiers
                if (data.categories !== undefined) localStorage.setItem(DB_KEYS.CATEGORIES, JSON.stringify(data.categories));
                if (data.profile !== undefined) localStorage.setItem(DB_KEYS.PROFILE, JSON.stringify(data.profile));
                if (data.globalTiers !== undefined) localStorage.setItem(DB_KEYS.GLOBAL_TIERS, JSON.stringify(data.globalTiers));
                if (data.vinyls !== undefined) localStorage.setItem(DB_KEYS.VINYLS, JSON.stringify(data.vinyls));

                // Sincronizar de vuelta a Firestore con la data combinada
                await this._pushAllToFirestore();
                console.log('✅ Datos sincronizados y protegidos con Firestore.');
            } else {
                // Primera vez: subir lo que hay en localStorage a Firestore
                await this._pushAllToFirestore();
                console.log('☁️ Datos locales subidos a Firestore por primera vez.');
            }
        } catch (e) {
            console.warn('No se pudo sincronizar con Firestore (modo offline):', e.message);
        }
    }

    /** Sube toda la data local a Firestore (primer uso o backup forzado) */
    async _pushAllToFirestore() {
        const docRef = this._userDoc();
        if (!docRef) return;
        try {
            const cleanData = JSON.parse(JSON.stringify({
                categories:  this.getCategories(),
                profile:     this.getProfile(),
                globalTiers: this.getGlobalTiers(),
                suppliers:   this.getSuppliers(),
                products:    this.getProducts(),
                vinyls:      this.getVinylPresets(),
                quotes:      this.getQuotes(),
                updatedAt:   firebase.firestore.FieldValue.serverTimestamp(),
            }));
            await docRef.set(cleanData, { merge: true });
        } catch (e) {
            console.warn('Error subiendo a Firestore:', e.message);
        }
    }

    /**
     * Guarda UNA colección específica en Firestore en segundo plano de forma limpia.
     * @param {string} firestoreKey  - nombre del campo en Firestore
     * @param {*}      value         - valor a guardar
     */
    _syncFieldToFirestore(firestoreKey, value) {
        const docRef = this._userDoc();
        if (!docRef) return;
        try {
            const cleanVal = JSON.parse(JSON.stringify(value));
            docRef.set({ [firestoreKey]: cleanVal, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true })
                .catch(e => console.warn(`Error sync Firestore [${firestoreKey}]:`, e.message));
        } catch (e) {
            console.warn(`Error serializando [${firestoreKey}]:`, e.message);
        }
    }

    // ==========================================
    // MOTOR LOCAL (localStorage + Firestore en 2do plano)
    // ==========================================

    init() {
        if (!localStorage.getItem(DB_KEYS.CATEGORIES)) {
            this.set(DB_KEYS.CATEGORIES, DEFAULT_CATEGORIES);
        }
        if (!localStorage.getItem(DB_KEYS.PROFILE)) {
            this.set(DB_KEYS.PROFILE, DEFAULT_PROFILE);
        }
        if (!localStorage.getItem(DB_KEYS.GLOBAL_TIERS)) {
            this.set(DB_KEYS.GLOBAL_TIERS, DEFAULT_GLOBAL_TIERS);
        }
        if (!localStorage.getItem(DB_KEYS.SUPPLIERS)) {
            this.set(DB_KEYS.SUPPLIERS, DEFAULT_SUPPLIERS);
        }
        if (!localStorage.getItem(DB_KEYS.PRODUCTS)) {
            this.set(DB_KEYS.PRODUCTS, DEFAULT_PRODUCTS);
        }
        if (!localStorage.getItem(DB_KEYS.VINYLS)) {
            this.set(DB_KEYS.VINYLS, DEFAULT_VINYLS);
        }
        if (!localStorage.getItem(DB_KEYS.QUOTES)) {
            this.set(DB_KEYS.QUOTES, DEFAULT_QUOTES);
        }
    }

    get(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (e) {
            console.error(`Error leyendo ${key} de localStorage:`, e);
            return defaultValue;
        }
    }

    /**
     * Guarda en localStorage Y sincroniza con Firestore.
     * @param {string} key            - clave de DB_KEYS (localStorage)
     * @param {*}      value          - valor a guardar
     * @param {string} [firestoreKey] - campo Firestore (si difiere del key local)
     */
    set(key, value, firestoreKey = null) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            // Sincronizar a Firestore si está autenticado
            if (this._firestoreReady && this._uid) {
                const fsKey = firestoreKey || this._localKeyToFirestoreKey(key);
                if (fsKey) this._syncFieldToFirestore(fsKey, value);
            }
            return true;
        } catch (e) {
            console.error(`Error guardando ${key} en localStorage:`, e);
            return false;
        }
    }

    /** Mapea las claves de localStorage a los campos de Firestore */
    _localKeyToFirestoreKey(localKey) {
        const map = {
            [DB_KEYS.CATEGORIES]:   'categories',
            [DB_KEYS.PROFILE]:      'profile',
            [DB_KEYS.GLOBAL_TIERS]: 'globalTiers',
            [DB_KEYS.SUPPLIERS]:    'suppliers',
            [DB_KEYS.PRODUCTS]:     'products',
            [DB_KEYS.VINYLS]:       'vinyls',
            [DB_KEYS.QUOTES]:       'quotes',
        };
        return map[localKey] || null;
    }

    // ==========================================
    // CATEGORÍAS DINÁMICAS
    // ==========================================
    getCategories() {
        return this.get(DB_KEYS.CATEGORIES, DEFAULT_CATEGORIES);
    }

    saveCategory(name) {
        const cat = (name || '').trim();
        if (!cat) return false;
        const categories = this.getCategories();
        if (!categories.includes(cat)) {
            categories.push(cat);
            this.set(DB_KEYS.CATEGORIES, categories);
        }
        return true;
    }

    deleteCategory(name) {
        const categories = this.getCategories().filter(c => c !== name);
        this.set(DB_KEYS.CATEGORIES, categories);
        return true;
    }

    // ==========================================
    // PERFIL DE LA EMPRESA
    // ==========================================
    getProfile() {
        return this.get(DB_KEYS.PROFILE, DEFAULT_PROFILE);
    }

    saveProfile(profileData) {
        const current = this.getProfile();
        const updated = { ...current, ...profileData };
        this.set(DB_KEYS.PROFILE, updated);
        return updated;
    }

    // ==========================================
    // REGLAS GLOBALES DE MÁRGENES
    // ==========================================
    getGlobalTiers() {
        return this.get(DB_KEYS.GLOBAL_TIERS, DEFAULT_GLOBAL_TIERS);
    }

    saveGlobalTiers(tiers) {
        this.set(DB_KEYS.GLOBAL_TIERS, tiers);
        return tiers;
    }

    // ==========================================
    // PROVEEDORES
    // ==========================================
    getSuppliers() {
        return this.get(DB_KEYS.SUPPLIERS, []);
    }

    getSupplierById(id) {
        return this.getSuppliers().find(s => s.id === id);
    }

    saveSupplier(supplier) {
        const suppliers = this.getSuppliers();
        if (!supplier.id) {
            supplier.id = 'sup_' + Date.now();
            suppliers.push(supplier);
        } else {
            const index = suppliers.findIndex(s => s.id === supplier.id);
            if (index !== -1) {
                suppliers[index] = supplier;
            } else {
                suppliers.push(supplier);
            }
        }
        this.set(DB_KEYS.SUPPLIERS, suppliers);
        return supplier;
    }

    deleteSupplier(id) {
        const suppliers = this.getSuppliers().filter(s => s.id !== id);
        this.set(DB_KEYS.SUPPLIERS, suppliers);
        return true;
    }

    // ==========================================
    // PRODUCTOS / INSUMOS CON ESCALA DE COSTO
    // ==========================================
    getProducts() {
        return this.get(DB_KEYS.PRODUCTS, []);
    }

    getProductById(id) {
        return this.getProducts().find(p => p.id === id);
    }

    getCostForQuantity(product, quantity) {
        const qty = parseFloat(quantity) || 1;
        if (product && product.costTiers && product.costTiers.length > 0) {
            const matchedTier = product.costTiers.find(tier => qty >= tier.min && qty <= tier.max);
            if (matchedTier && !isNaN(matchedTier.cost)) {
                return parseFloat(matchedTier.cost);
            }
        }
        return parseFloat(product?.costPrice) || 0;
    }

    getSalePriceForQuantity(product, quantity) {
        const qty = parseFloat(quantity) || 1;
        const baseCost = this.getCostForQuantity(product, qty);
        const extraCost = parseFloat(product?.extraCost) || 0;
        const totalUnitCost = baseCost + extraCost;

        // 1. Si el producto tiene escalas de volumen configuradas con su propio precio de venta
        if (product && product.costTiers && product.costTiers.length > 0) {
            const matchedTier = product.costTiers.find(tier => qty >= tier.min && qty <= tier.max);
            if (matchedTier && matchedTier.salePrice !== undefined && matchedTier.salePrice !== null && !isNaN(parseFloat(matchedTier.salePrice)) && parseFloat(matchedTier.salePrice) > 0) {
                return parseFloat(matchedTier.salePrice);
            }
            if (matchedTier && matchedTier.margin !== undefined && matchedTier.margin !== null && !isNaN(parseFloat(matchedTier.margin))) {
                return Number((totalUnitCost * (1 + parseFloat(matchedTier.margin) / 100)).toFixed(2));
            }
        }

        // 2. Si qty <= 1 y el producto tiene salePrice guardado
        if (qty <= 1 && product && product.salePrice !== undefined && product.salePrice !== null && !isNaN(parseFloat(product.salePrice)) && parseFloat(product.salePrice) > 0) {
            return parseFloat(product.salePrice);
        }

        // 3. Fallback: calcular aplicando el margen sobre el costo total
        const margin = this.getMarginForQuantity(product, qty);
        return Number((totalUnitCost * (1 + margin / 100)).toFixed(2));
    }

    saveProduct(product) {
        const products = this.getProducts();
        if (!product.id) {
            product.id = 'prod_' + Date.now();
            products.unshift(product);
        } else {
            const index = products.findIndex(p => p.id === product.id);
            if (index !== -1) {
                products[index] = product;
            } else {
                products.unshift(product);
            }
        }
        this.set(DB_KEYS.PRODUCTS, products);
        return product;
    }

    deleteProduct(id) {
        const products = this.getProducts().filter(p => p.id !== id);
        this.set(DB_KEYS.PRODUCTS, products);
        return true;
    }

    // ==========================================
    // CARGA MASIVA Y PARSER CSV (PROVEEDORES Y PRODUCTOS)
    // ==========================================
    parseCSV(text) {
        const lines = text.split(/\r\n|\n|\r/).filter(l => l.trim().length > 0);
        if (lines.length === 0) return [];

        const firstLine = lines[0];
        let sep = ',';
        if (firstLine.includes(';') && firstLine.split(';').length >= firstLine.split(',').length) {
            sep = ';';
        } else if (firstLine.includes('\t')) {
            sep = '\t';
        }

        const parseLine = (line) => {
            const result = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"' || char === "'") {
                    inQuotes = !inQuotes;
                } else if (char === sep && !inQuotes) {
                    result.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            result.push(current.trim());
            return result.map(s => s.replace(/^["']|["']$/g, '').trim());
        };

        return lines.map(parseLine);
    }

    importSuppliersFromCSV(csvText) {
        const rows = this.parseCSV(csvText);
        return this.importSuppliersFromRows(rows);
    }

    importSuppliersFromRows(rows) {
        if (!rows || rows.length < 2) throw new Error('El archivo Excel debe contener al menos una fila de encabezados y una de datos.');

        const headers = rows[0].map(h => String(h || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
        
        const idxName = headers.findIndex(h => h.includes('nombre') || h.includes('proveedor') || h.includes('empresa'));
        const idxRut = headers.findIndex(h => h.includes('rut') || h.includes('nit') || h.includes('identificacion') || h.includes('cif') || h.includes('ruc'));
        const idxContact = headers.findIndex(h => h.includes('contacto') || h.includes('persona') || h.includes('atencion'));
        const idxPhone = headers.findIndex(h => h.includes('telefono') || h.includes('celular') || h.includes('movil') || h.includes('whatsapp'));
        const idxEmail = headers.findIndex(h => h.includes('correo') || h.includes('email') || h.includes('mail'));
        const idxCategory = headers.findIndex(h => h.includes('categoria') || h.includes('rubro'));
        const idxNotes = headers.findIndex(h => h.includes('nota') || h.includes('observacion') || h.includes('detalle'));

        if (idxName === -1) throw new Error('No se encontró la columna "Nombre" o "Empresa" en el archivo Excel.');

        let count = 0;
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;
            const name = String(row[idxName] || '').trim();
            if (!name) continue;

            const rut = idxRut !== -1 ? String(row[idxRut] || '').trim() : '';
            const contact = idxContact !== -1 ? String(row[idxContact] || '').trim() : '';
            const phone = idxPhone !== -1 ? String(row[idxPhone] || '').trim() : '';
            const email = idxEmail !== -1 ? String(row[idxEmail] || '').trim() : '';
            const category = idxCategory !== -1 && row[idxCategory] ? String(row[idxCategory]).trim() : 'General';
            const notes = idxNotes !== -1 ? String(row[idxNotes] || '').trim() : '';

            this.saveSupplier({ name, rut, contact, phone, email, category, notes });
            if (category) this.saveCategory(category);
            count++;
        }
        return count;
    }

    importProductsFromCSV(csvText) {
        const rows = this.parseCSV(csvText);
        return this.importProductsFromRows(rows);
    }

    importProductsFromRows(rows) {
        if (!rows || rows.length < 2) throw new Error('El archivo Excel debe contener al menos una fila de encabezados y una de datos.');

        const cleanHeader = (str) => {
            return String(str || '')
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9]/g, "_")
                .replace(/_+/g, "_")
                .replace(/^_|_$/g, "");
        };

        const headersClean = rows[0].map(cleanHeader);

        const idxSku = headersClean.findIndex(h => h.includes('sku') || h.includes('codigo') || h.includes('cod') || h.includes('ref'));
        const idxName = headersClean.findIndex(h => h.includes('nombre') || h.includes('producto') || h.includes('insumo') || h.includes('descripcion') || h.includes('articulo'));
        const idxSup = headersClean.findIndex(h => h.includes('proveedor') || h.includes('supplier') || h.includes('distribuidor'));
        const idxCat = headersClean.findIndex(h => h.includes('categoria') || h.includes('rubro') || h.includes('familia'));
        const idxUnit = headersClean.findIndex(h => h.includes('unidad') || h.includes('unit') || h.includes('medida') || h.includes('uom'));
        const idxCost = headersClean.findIndex(h => (h.includes('costo') || h.includes('cost') || h.includes('compra')) && !h.includes('rango') && !h.includes('escala') && !h.includes('adicional') && !h.match(/\d/));
        const idxSalePrice = headersClean.findIndex(h => (h.includes('precio_venta') || h.includes('pvp') || (h.includes('precio') && !h.includes('costo') && !h.includes('compra'))) && !h.includes('rango') && !h.includes('escala') && !h.match(/\d/));
        const idxMargin = headersClean.findIndex(h => (h.includes('margen') || h.includes('ganancia') || h.includes('margin') || h.includes('utilidad')) && !h.includes('rango') && !h.includes('escala') && !h.match(/\d/));
        const idxExtraCost = headersClean.findIndex(h => h.includes('adicional') || h.includes('extra_cost') || h.includes('estampado') || h.includes('sublimacion'));
        const idxExtraLabel = headersClean.findIndex(h => h.includes('concepto') || h.includes('etiqueta_adicional') || h.includes('extra_label'));
        const idxUrl = headersClean.findIndex(h => h.includes('url') || h.includes('enlace') || h.includes('link') || h.includes('web') || h.includes('pagina'));
        const idxNotes = headersClean.findIndex(h => h.includes('nota') || h.includes('observacion') || h.includes('especificacion') || h.includes('detalle'));
        const idxTiersText = headersClean.findIndex(h => (h.includes('escalas') || h.includes('rangos') || h.includes('tiers') || h.includes('precios_volumen')) && !h.match(/\d/));

        // 1. Columnas de rangos numerados (Rango1, Rango2, etc.)
        const numberedRangeCols = [];
        for (let k = 1; k <= 15; k++) {
            const minIdx = headersClean.findIndex(h => 
                h === `rango${k}_min` || h === `rango_${k}_min` || h === `rango_${k}_desde` || h === `rango${k}_desde` ||
                h === `min_${k}` || h === `min${k}` || h === `desde_${k}` || h === `desde${k}` ||
                h === `cant_${k}_min` || h === `cant${k}_min` || h === `cantidad_${k}_min` || h === `cantidad${k}_min` ||
                h === `rango_${k}` || h === `rango${k}` || h === `escala_${k}` || h === `escala${k}`
            );
            const maxIdx = headersClean.findIndex(h => 
                h === `rango${k}_max` || h === `rango_${k}_max` || h === `rango_${k}_hasta` || h === `rango${k}_hasta` ||
                h === `max_${k}` || h === `max${k}` || h === `hasta_${k}` || h === `hasta${k}` ||
                h === `cant_${k}_max` || h === `cant${k}_max` || h === `cantidad_${k}_max` || h === `cantidad${k}_max`
            );
            const costIdx = headersClean.findIndex(h => 
                h === `rango${k}_costo` || h === `rango_${k}_costo` || h === `costo_${k}` || h === `costo${k}` ||
                h === `costo_rango_${k}` || h === `costo_escala_${k}` || h === `costo_unitario_${k}` || h === `compra_${k}`
            );
            const salePriceIdx = headersClean.findIndex(h => 
                h === `rango${k}_precio` || h === `rango_${k}_precio` || h === `rango${k}_precio_venta` || h === `rango_${k}_precio_venta` ||
                h === `rango${k}_venta` || h === `rango_${k}_venta` || h === `precio_${k}` || h === `precio${k}` ||
                h === `precio_venta_${k}` || h === `precio_venta${k}` || h === `venta_${k}` || h === `venta${k}` ||
                h === `pvp_${k}` || h === `pvp${k}`
            );
            const marginIdx = headersClean.findIndex(h => 
                h === `rango${k}_margen` || h === `rango_${k}_margen` || h === `margen_${k}` || h === `margen${k}` ||
                h === `margen_%_${k}` || h === `%_${k}` || h === `%${k}` || h === `ganancia_${k}` || h === `ganancia${k}`
            );

            if (minIdx !== -1 || costIdx !== -1 || salePriceIdx !== -1) {
                numberedRangeCols.push({ k, minIdx, maxIdx, costIdx, salePriceIdx, marginIdx });
            }
        }

        // 2. Columnas con rango directo en el nombre del encabezado (ej: "1-12", "1 a 12", "13-50", "51+", "Precio 1-12", "Costo 1-12")
        const directRangeCols = [];
        headersClean.forEach((h, colIdx) => {
            if ([idxSku, idxName, idxSup, idxCat, idxUnit, idxCost, idxSalePrice, idxMargin, idxExtraCost, idxExtraLabel, idxUrl, idxNotes, idxTiersText].includes(colIdx)) return;
            if (numberedRangeCols.some(rc => [rc.minIdx, rc.maxIdx, rc.costIdx, rc.salePriceIdx, rc.marginIdx].includes(colIdx))) return;

            const m = h.match(/^(?:precio_venta_|precio_|costo_|venta_|pvp_)?(?:de_)?(\d+)(?:_a_|_al_|_hasta_|_to_|_|-)(\d+|\+|mas|adelante)?(?:_unid|_unidades|_uds|_cant)?$/i) ||
                      h.match(/^(?:precio_venta_|precio_|costo_|venta_|pvp_)?(\d+)(?:_?\+|_mas|_adelante)$/i);
            if (m) {
                const min = parseInt(m[1], 10);
                const max = (m[2] && !m[2].includes('+') && !m[2].includes('mas') && !m[2].includes('adelante')) ? (parseInt(m[2], 10) || 999999) : 999999;
                const isCost = h.includes('costo') || h.includes('compra');
                const isMargin = h.includes('margen') || h.includes('ganancia') || h.includes('%');
                directRangeCols.push({
                    colIdx,
                    min,
                    max: max >= min ? max : min,
                    isCost,
                    isMargin,
                    isSalePrice: !isCost && !isMargin
                });
            }
        });

        // 3. Columnas de escala por fila individual (formato multi-fila)
        const idxRowMin = headersClean.findIndex(h => (h === 'min' || h === 'desde' || h === 'cant_min' || h === 'cantidad_min'));
        const idxRowMax = headersClean.findIndex(h => (h === 'max' || h === 'hasta' || h === 'cant_max' || h === 'cantidad_max'));
        const idxRowCost = headersClean.findIndex(h => (h === 'costo_escala' || h === 'costo_rango' || h === 'costo' || h === 'precio_costo'));
        const idxRowSalePrice = headersClean.findIndex(h => (h === 'precio_escala' || h === 'precio_rango' || h === 'precio_venta' || h === 'venta'));

        if (idxName === -1 && idxSku === -1) {
            throw new Error('No se encontró la columna "Nombre" o "SKU" en el archivo Excel.');
        }

        const parseBounds = (minRaw, maxRaw) => {
            if (minRaw === undefined || minRaw === null) minRaw = '';
            const minStr = String(minRaw).trim();
            const maxStr = maxRaw !== undefined && maxRaw !== null ? String(maxRaw).trim() : '';

            const rangeMatch = minStr.match(/(?:de\s*)?(\d+)\s*(?:-|a|al|hasta|to|:|\.{2})\s*(\d+|\+)?/i);
            if (rangeMatch) {
                const min = parseInt(rangeMatch[1], 10) || 1;
                const max = rangeMatch[2] && rangeMatch[2] !== '+' ? (parseInt(rangeMatch[2], 10) || 999999) : 999999;
                return { min, max: max >= min ? max : min };
            }

            if (minStr.includes('+') || minStr.toLowerCase().includes('mas') || minStr.includes('>')) {
                const digits = minStr.match(/\d+/);
                const min = digits ? parseInt(digits[0], 10) : 1;
                return { min, max: 999999 };
            }

            const min = parseInt(minStr.replace(/[^\d]/g, ''), 10) || 1;
            let max = 999999;
            if (maxStr && maxStr !== '+' && !maxStr.toLowerCase().includes('mas')) {
                const maxParsed = parseInt(maxStr.replace(/[^\d]/g, ''), 10);
                if (!isNaN(maxParsed) && maxParsed > 0) {
                    max = maxParsed;
                }
            }
            return { min, max: max >= min ? max : min };
        };

        const buildTier = (min, max, costRaw, salePriceRaw, marginRaw, defaultMargin, extraCost, baseCost) => {
            const rawCost = (costRaw !== undefined && costRaw !== null && String(costRaw).trim() !== '') ? window.parseMoney(costRaw) : null;
            const rawSale = (salePriceRaw !== undefined && salePriceRaw !== null && String(salePriceRaw).trim() !== '') ? window.parseMoney(salePriceRaw) : null;
            let rawMargin = null;
            if (marginRaw !== undefined && marginRaw !== null && String(marginRaw).trim() !== '') {
                const m = parseFloat(String(marginRaw).replace('%', '').replace(',', '.'));
                if (!isNaN(m)) rawMargin = m;
            }

            if (rawCost === null && rawSale === null && rawMargin === null) return null;

            let cost = 0;
            let margin = defaultMargin;
            let salePrice = 0;

            if (rawCost !== null && rawSale !== null) {
                cost = rawCost;
                salePrice = rawSale;
                const totalCost = cost + extraCost;
                margin = totalCost > 0 ? Number((((salePrice / totalCost) - 1) * 100).toFixed(2)) : defaultMargin;
            } else if (rawCost !== null && rawMargin !== null) {
                cost = rawCost;
                margin = rawMargin;
                const totalCost = cost + extraCost;
                salePrice = Number((totalCost * (1 + margin / 100)).toFixed(2));
            } else if (rawCost !== null) {
                cost = rawCost;
                margin = defaultMargin;
                const totalCost = cost + extraCost;
                salePrice = Number((totalCost * (1 + defaultMargin / 100)).toFixed(2));
            } else if (rawSale !== null) {
                salePrice = rawSale;
                margin = rawMargin !== null ? rawMargin : defaultMargin;
                if (baseCost > 0) {
                    cost = baseCost;
                    const totalCost = cost + extraCost;
                    margin = totalCost > 0 ? Number((((salePrice / totalCost) - 1) * 100).toFixed(2)) : defaultMargin;
                } else {
                    const totalCost = salePrice / (1 + margin / 100);
                    cost = Math.max(0, Number((totalCost - extraCost).toFixed(2)));
                }
            }

            return { min, max, cost, margin, salePrice };
        };

        const suppliers = this.getSuppliers();
        const existingProducts = this.getProducts();
        const productsMap = new Map();

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;

            const name = idxName !== -1 ? String(row[idxName] || '').trim() : '';
            const sku = idxSku !== -1 && row[idxSku] ? String(row[idxSku]).trim() : '';
            if (!name && !sku) continue;

            const productKey = (sku || name).toLowerCase();

            // Costo adicional (estampado / sublimación)
            const extraCost = idxExtraCost !== -1 ? window.parseMoney(row[idxExtraCost]) : 0;
            const extraCostLabel = idxExtraLabel !== -1 && row[idxExtraLabel] ? String(row[idxExtraLabel]).trim() : (extraCost > 0 ? 'Estampado' : '');

            // Margen base
            let defaultMargin = 50;
            if (idxMargin !== -1 && row[idxMargin] !== undefined && row[idxMargin] !== null && String(row[idxMargin]).trim() !== '') {
                const mVal = parseFloat(String(row[idxMargin]).replace('%', '').replace(',', '.'));
                if (!isNaN(mVal)) defaultMargin = mVal;
            }

            // Costo base
            let costPrice = idxCost !== -1 ? window.parseMoney(row[idxCost]) : 0;
            let typedSalePrice = idxSalePrice !== -1 ? window.parseMoney(row[idxSalePrice]) : 0;

            const costTiers = [];

            // 1. Extraer rangos de columnas numeradas (Rango1, Rango2, etc.)
            for (const rc of numberedRangeCols) {
                const minRaw = rc.minIdx !== -1 ? row[rc.minIdx] : (rc.k === 1 ? '1' : null);
                const maxRaw = rc.maxIdx !== -1 ? row[rc.maxIdx] : null;
                const costRaw = rc.costIdx !== -1 ? row[rc.costIdx] : null;
                const salePriceRaw = rc.salePriceIdx !== -1 ? row[rc.salePriceIdx] : null;
                const marginRaw = rc.marginIdx !== -1 ? row[rc.marginIdx] : null;

                if ((costRaw !== null && String(costRaw).trim() !== '') ||
                    (salePriceRaw !== null && String(salePriceRaw).trim() !== '') ||
                    (marginRaw !== null && String(marginRaw).trim() !== '')) {
                    const { min, max } = parseBounds(minRaw, maxRaw);
                    const tier = buildTier(min, max, costRaw, salePriceRaw, marginRaw, defaultMargin, extraCost, costPrice);
                    if (tier) costTiers.push(tier);
                }
            }

            // 2. Extraer rangos de columnas directas (ej: "1 a 12", "13-50", "51+")
            for (const dc of directRangeCols) {
                const valRaw = row[dc.colIdx];
                if (valRaw !== undefined && valRaw !== null && String(valRaw).trim() !== '') {
                    const costRaw = dc.isCost ? valRaw : null;
                    const salePriceRaw = dc.isSalePrice ? valRaw : null;
                    const marginRaw = dc.isMargin ? valRaw : null;
                    const tier = buildTier(dc.min, dc.max, costRaw, salePriceRaw, marginRaw, defaultMargin, extraCost, costPrice);
                    if (tier) costTiers.push(tier);
                }
            }

            // 3. Extraer rangos de formato multi-fila si existen
            if (idxRowMin !== -1 && (idxRowCost !== -1 || idxRowSalePrice !== -1)) {
                const minRaw = row[idxRowMin];
                const maxRaw = idxRowMax !== -1 ? row[idxRowMax] : null;
                const costRaw = idxRowCost !== -1 ? row[idxRowCost] : null;
                const salePriceRaw = idxRowSalePrice !== -1 ? row[idxRowSalePrice] : null;
                if (minRaw !== undefined && String(minRaw).trim() !== '') {
                    const { min, max } = parseBounds(minRaw, maxRaw);
                    const tier = buildTier(min, max, costRaw, salePriceRaw, null, defaultMargin, extraCost, costPrice);
                    if (tier) costTiers.push(tier);
                }
            }

            // 4. Extraer rangos de columna de texto libre (ej: "1-10: 5000; 11-50: 4500; 51+: 4000")
            if (idxTiersText !== -1 && row[idxTiersText]) {
                const text = String(row[idxTiersText]).trim();
                const parts = text.split(/;|\n|\|/);
                for (const part of parts) {
                    const trimmed = part.trim();
                    if (!trimmed) continue;
                    const match = trimmed.match(/(\d+)\s*(?:-|a|al|to|\+)?\s*(\d+|\+)?\s*(?::|=|\$|\->)?\s*([\d.,]+)(?:\s*\(([\d.,]+)%\))?/i);
                    if (match) {
                        const { min, max } = parseBounds(match[1], match[2]);
                        const val = window.parseMoney(match[3]);
                        const marginVal = match[4] ? parseFloat(match[4].replace(',', '.')) : null;
                        const tier = buildTier(min, max, val, null, marginVal, defaultMargin, extraCost, costPrice);
                        if (tier) costTiers.push(tier);
                    }
                }
            }

            // Si el costo base es 0 y tenemos rangos, tomar el costo del primer rango
            if (costPrice === 0 && costTiers.length > 0) {
                costPrice = costTiers[0].cost;
            }
            if (typedSalePrice === 0 && costTiers.length > 0 && costTiers[0].salePrice > 0) {
                typedSalePrice = costTiers[0].salePrice;
            }

            // Si ya procesamos una fila de este mismo producto en esta carga masiva, combinar los rangos
            if (productsMap.has(productKey)) {
                const existing = productsMap.get(productKey);
                if (costTiers.length > 0) {
                    existing.costTiers = [...existing.costTiers, ...costTiers];
                }
                continue;
            }

            // Proveedor
            const supplierRaw = idxSup !== -1 ? String(row[idxSup] || '').trim() : '';
            let matchedSup = suppliers.find(s => s.name.toLowerCase() === supplierRaw.toLowerCase() || s.id === supplierRaw);
            if (!matchedSup && supplierRaw) {
                matchedSup = this.saveSupplier({ name: supplierRaw, category: 'General' });
            }
            const supplierId = matchedSup ? matchedSup.id : (suppliers[0]?.id || 'sup_1');

            const category = idxCat !== -1 && row[idxCat] ? String(row[idxCat]).trim() : 'General';
            const unit = idxUnit !== -1 && row[idxUnit] ? String(row[idxUnit]).trim() : 'Unidad';
            const url = idxUrl !== -1 ? String(row[idxUrl] || '').trim() : '';
            const notes = idxNotes !== -1 ? String(row[idxNotes] || '').trim() : '';

            // Verificar si el producto ya existe en la base de datos para conservar su ID e imágenes
            const existingDbProd = existingProducts.find(p => (sku && p.sku && p.sku.toLowerCase() === sku.toLowerCase()) || (p.name && p.name.toLowerCase() === name.toLowerCase()));

            if (costPrice === 0 && existingDbProd && existingDbProd.costPrice > 0) {
                costPrice = existingDbProd.costPrice;
            }

            const finalSku = sku || (existingDbProd ? existingDbProd.sku : ('PROD-' + Math.floor(Math.random() * 9000 + 1000)));

            const productObj = {
                id: existingDbProd ? existingDbProd.id : ('prod_' + Date.now() + '_' + i),
                sku: finalSku,
                name: name || (existingDbProd ? existingDbProd.name : finalSku),
                supplierId,
                category,
                unit,
                costPrice,
                salePrice: typedSalePrice > 0 ? typedSalePrice : undefined,
                defaultMargin,
                extraCost,
                extraCostLabel,
                url,
                notes,
                images: existingDbProd?.images || [],
                imageData: existingDbProd?.imageData || '',
                costTiers: costTiers,
                useGlobalTiers: true
            };

            productsMap.set(productKey, productObj);
        }

        // Guardar todos los productos
        let count = 0;
        for (const prod of productsMap.values()) {
            if (prod.costTiers && prod.costTiers.length > 0) {
                const uniqueTiers = [];
                const seenMin = new Set();
                prod.costTiers.sort((a, b) => a.min - b.min);
                for (const t of prod.costTiers) {
                    if (!seenMin.has(t.min)) {
                        seenMin.add(t.min);
                        uniqueTiers.push(t);
                    }
                }
                prod.costTiers = uniqueTiers;
            }
            this.saveProduct(prod);
            if (prod.category) this.saveCategory(prod.category);
            count++;
        }
        return count;
    }

    downloadSuppliersTemplateXLS() {
        const data = [
            ["Nombre", "RUT", "Contacto", "Telefono", "Email", "Categoria", "Notas"],
            ["Distribuidora Gráfica Nacional", "J-29837482-1", "Carlos Rodríguez", "+58 414 5551122", "ventas@distribuidoragrafica.com", "Vinilos", "Descuento 5% pronto pago"],
            ["Textiles & Confección Global", "J-31092834-0", "María Elena Pérez", "+58 424 9998877", "pedidos@textilesglobal.com", "Textil", "Entregas martes y jueves"],
            ["Insumos Tecnológicos UV", "J-40192837-9", "Fernando Mendoza", "+58 416 3334455", "contacto@insumosuv.com", "Insumos", "Consumibles DTF UV"]
        ];

        if (window.XLSX) {
            const ws = window.XLSX.utils.aoa_to_sheet(data);
            const wb = window.XLSX.utils.book_new();
            window.XLSX.utils.book_append_sheet(wb, ws, "Proveedores");
            window.XLSX.writeFile(wb, "Plantilla_Importar_Proveedores.xlsx");
        } else {
            this.downloadSuppliersTemplateCSV();
        }
    }

    downloadProductsTemplateXLS() {
        const data = [
            [
                "SKU", "Nombre", "Proveedor", "Categoria", "Unidad", 
                "Costo_Base", "Margen_%", "Costo_Adicional", 
                "Rango1_Min", "Rango1_Max", "Rango1_Costo", "Rango1_Precio_Venta",
                "Rango2_Min", "Rango2_Max", "Rango2_Costo", "Rango2_Precio_Venta",
                "Rango3_Min", "Rango3_Max", "Rango3_Costo", "Rango3_Precio_Venta",
                "URL_Producto", "Notas"
            ],
            [
                "POL-ALG-01", "Polera Algodón 24/1 Cuello Redondo", "Textiles & Confección Global", "Textil", "Unidad", 
                5000, 50, 2000, 
                1, 12, 5000, 10500, 
                13, 50, 4500, 9750, 
                51, 999999, 4000, 9000, 
                "https://proveedor.com/polera", "Algodón peinado varios colores"
            ],
            [
                "TAZ-CER-01", "Taza de Cerámica Blanca 11oz", "Insumos Tecnológicos UV", "Sublimación", "Unidad", 
                1600, 50, 0, 
                1, 24, 1600, 2400, 
                25, 999999, 1300, 1950, 
                "", "", "", "", 
                "https://proveedor.com/taza", "Con caja individual incluida"
            ],
            [
                "GOR-TRU-01", "Gorra Camionera Trucker Lisa", "Textiles & Confección Global", "Textil", "Unidad", 
                2200, 60, 0, 
                1, 10, 2200, 3520, 
                11, 50, 1900, 3040, 
                51, 999999, 1600, 2560, 
                "https://proveedor.com/gorra", "Frente acolchado poliéster"
            ],
            [
                "VIN-ADH-BLA", "Bobina Vinilo Adhesivo Blanco (1.22m x 50m)", "Distribuidora Gráfica Nacional", "Vinilos", "Rollo", 
                85000, 45, 0, 
                "", "", "", "", 
                "", "", "", "", 
                "", "", "", "", 
                "https://proveedor.com/vinilo", "Marca Oracal 651 exterior"
            ]
        ];

        if (window.XLSX) {
            const ws = window.XLSX.utils.aoa_to_sheet(data);
            const wb = window.XLSX.utils.book_new();
            window.XLSX.utils.book_append_sheet(wb, ws, "Productos");
            window.XLSX.writeFile(wb, "Plantilla_Importar_Productos_Con_Escalas.xlsx");
        } else {
            this.downloadProductsTemplateCSV();
        }
    }

    downloadSuppliersTemplateCSV() {
        const csvContent = "\uFEFF" + "Nombre,RUT,Contacto,Telefono,Email,Categoria,Notas\n" +
            "Distribuidora Gráfica Nacional,J-29837482-1,Carlos Rodríguez,+58 414 5551122,ventas@distribuidoragrafica.com,Vinilos,Descuento 5% pronto pago\n" +
            "Textiles & Confección Global,J-31092834-0,María Elena Pérez,+58 424 9998877,pedidos@textilesglobal.com,Textil,Entregas martes y jueves\n" +
            "Insumos Tecnológicos UV,J-40192837-9,Fernando Mendoza,+58 416 3334455,contacto@insumosuv.com,Insumos,Consumibles DTF UV";
        this.triggerDownloadCSV(csvContent, 'Plantilla_Importar_Proveedores.csv');
    }

    downloadProductsTemplateCSV() {
        const csvContent = "\uFEFF" + 
            "SKU,Nombre,Proveedor,Categoria,Unidad,Costo_Base,Margen_%,Costo_Adicional,Rango1_Min,Rango1_Max,Rango1_Costo,Rango1_Precio_Venta,Rango2_Min,Rango2_Max,Rango2_Costo,Rango2_Precio_Venta,Rango3_Min,Rango3_Max,Rango3_Costo,Rango3_Precio_Venta,URL_Producto,Notas\n" +
            "POL-ALG-01,Polera Algodón 24/1 Cuello Redondo,Textiles & Confección Global,Textil,Unidad,5000,50,2000,1,12,5000,10500,13,50,4500,9750,51,999999,4000,9000,https://proveedor.com/polera,Algodón peinado varios colores\n" +
            "TAZ-CER-01,Taza de Cerámica Blanca 11oz,Insumos Tecnológicos UV,Sublimación,Unidad,1600,50,0,1,24,1600,2400,25,999999,1300,1950,,,,https://proveedor.com/taza,Con caja individual incluida\n" +
            "GOR-TRU-01,Gorra Camionera Trucker Lisa,Textiles & Confección Global,Textil,Unidad,2200,60,0,1,10,2200,3520,11,50,1900,3040,51,999999,1600,2560,https://proveedor.com/gorra,Frente acolchado poliéster\n" +
            "VIN-ADH-BLA,Bobina Vinilo Adhesivo Blanco (1.22m x 50m),Distribuidora Gráfica Nacional,Vinilos,Rollo,85000,45,0,,,,,,,,,,,,https://proveedor.com/vinilo,Marca Oracal 651 exterior";
        this.triggerDownloadCSV(csvContent, 'Plantilla_Importar_Productos_Con_Escalas.csv');
    }

    triggerDownloadCSV(content, filename) {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Calculador de Márgenes Dinámicos según Cantidad
    getMarginForQuantity(product, quantity) {
        const qty = parseFloat(quantity) || 1;
        
        // 1. Si el producto tiene escalas de volumen configuradas con su propio margen
        if (product && product.costTiers && product.costTiers.length > 0) {
            const matchedTier = product.costTiers.find(tier => qty >= tier.min && qty <= tier.max);
            if (matchedTier && matchedTier.margin !== undefined && matchedTier.margin !== null && !isNaN(parseFloat(matchedTier.margin))) {
                return parseFloat(matchedTier.margin);
            }
        }

        // Retrocompatibilidad con customTiers
        if (product && product.customTiers && product.customTiers.length > 0) {
            const matchedTier = product.customTiers.find(tier => qty >= tier.min && qty <= tier.max);
            if (matchedTier && !isNaN(matchedTier.margin)) return parseFloat(matchedTier.margin);
        }

        // 2. Si el producto tiene su margen base configurado (defaultMargin)
        const hasProductMargin = product && product.defaultMargin !== undefined && product.defaultMargin !== null && !isNaN(parseFloat(product.defaultMargin));

        // Para 1 unidad (menudeo / precio base), se respeta SIEMPRE el margen propio del producto
        if (hasProductMargin && qty <= 1) {
            return parseFloat(product.defaultMargin);
        }

        // 3. Si usa las escalas globales para mayores volúmenes (qty > 1)
        if (product && product.useGlobalTiers) {
            const globalTiers = this.getGlobalTiers();
            const matchedTier = globalTiers.find(tier => qty >= tier.min && qty <= tier.max);
            if (matchedTier && matchedTier.min > 1 && !isNaN(matchedTier.margin)) {
                return parseFloat(matchedTier.margin);
            }
        }

        // 4. Margen base del producto
        if (hasProductMargin) {
            return parseFloat(product.defaultMargin);
        }

        // 5. Fallback a escalas globales
        const globalTiers = this.getGlobalTiers();
        const matchedTier = globalTiers.find(tier => qty >= tier.min && qty <= tier.max);
        if (matchedTier && !isNaN(matchedTier.margin)) return parseFloat(matchedTier.margin);

        return 50;
    }

    calculateSalePrice(costPrice, marginPercent) {
        const cost = parseFloat(costPrice) || 0;
        const margin = parseFloat(marginPercent) || 0;
        return Number((cost * (1 + margin / 100)).toFixed(2));
    }

    // ==========================================
    // VINILOS PRESETS (CRUD COMPLETO)
    // ==========================================
    getVinylPresets() {
        return this.get(DB_KEYS.VINYLS, DEFAULT_VINYLS);
    }

    getVinylPresetById(id) {
        return this.getVinylPresets().find(v => v.id === id);
    }

    saveVinylPreset(vinyl) {
        const list = this.getVinylPresets();
        if (!vinyl.id) {
            vinyl.id = 'vin_' + Date.now();
            list.push(vinyl);
        } else {
            const idx = list.findIndex(v => v.id === vinyl.id);
            if (idx !== -1) list[idx] = vinyl;
            else list.push(vinyl);
        }
        this.set(DB_KEYS.VINYLS, list);
        return vinyl;
    }

    deleteVinylPreset(id) {
        const list = this.getVinylPresets().filter(v => v.id !== id);
        this.set(DB_KEYS.VINYLS, list);
        return true;
    }

    // ==========================================
    // COTIZACIONES
    // ==========================================
    getQuotes() {
        return this.get(DB_KEYS.QUOTES, []);
    }

    getQuoteById(id) {
        return this.getQuotes().find(q => q.id === id || q.quoteNumber === id);
    }

    getNextQuoteNumber() {
        const quotes = this.getQuotes();
        let maxNum = 1000;
        quotes.forEach(q => {
            const match = q.quoteNumber?.match(/COT-(\d+)/i);
            if (match) {
                const n = parseInt(match[1], 10);
                if (n > maxNum) maxNum = n;
            }
        });
        return `COT-${maxNum + 1}`;
    }

    saveQuote(quote) {
        const quotes = this.getQuotes();
        if (!quote.id) {
            quote.id = 'COT-' + (Date.now().toString().slice(-6));
            if (!quote.quoteNumber) quote.quoteNumber = this.getNextQuoteNumber();
            quotes.unshift(quote);
        } else {
            const index = quotes.findIndex(q => q.id === quote.id);
            if (index !== -1) {
                quotes[index] = quote;
            } else {
                quotes.unshift(quote);
            }
        }
        this.set(DB_KEYS.QUOTES, quotes);
        return quote;
    }

    deleteQuote(id) {
        const quotes = this.getQuotes().filter(q => q.id !== id);
        this.set(DB_KEYS.QUOTES, quotes);
        return true;
    }

    // ==========================================
    // RESPALDO Y RESTAURACIÓN
    // ==========================================
    exportAllData() {
        return {
            version: '2.0',
            exportDate: new Date().toISOString(),
            categories: this.getCategories(),
            profile: this.getProfile(),
            globalTiers: this.getGlobalTiers(),
            suppliers: this.getSuppliers(),
            products: this.getProducts(),
            vinyls: this.getVinylPresets(),
            quotes: this.getQuotes()
        };
    }

    importAllData(jsonData) {
        if (!jsonData || typeof jsonData !== 'object') {
            throw new Error('Formato de respaldo no válido.');
        }
        if (jsonData.categories) this.set(DB_KEYS.CATEGORIES, jsonData.categories);
        if (jsonData.profile) this.set(DB_KEYS.PROFILE, jsonData.profile);
        if (jsonData.globalTiers) this.set(DB_KEYS.GLOBAL_TIERS, jsonData.globalTiers);
        if (jsonData.suppliers) this.set(DB_KEYS.SUPPLIERS, jsonData.suppliers);
        if (jsonData.products) this.set(DB_KEYS.PRODUCTS, jsonData.products);
        if (jsonData.vinyls) this.set(DB_KEYS.VINYLS, jsonData.vinyls);
        if (jsonData.quotes) this.set(DB_KEYS.QUOTES, jsonData.quotes);
        return true;
    }

    resetToFactory() {
        this.set(DB_KEYS.CATEGORIES, DEFAULT_CATEGORIES);
        this.set(DB_KEYS.PROFILE, DEFAULT_PROFILE);
        this.set(DB_KEYS.GLOBAL_TIERS, DEFAULT_GLOBAL_TIERS);
        this.set(DB_KEYS.SUPPLIERS, DEFAULT_SUPPLIERS);
        this.set(DB_KEYS.PRODUCTS, DEFAULT_PRODUCTS);
        this.set(DB_KEYS.VINYLS, DEFAULT_VINYLS);
        this.set(DB_KEYS.QUOTES, DEFAULT_QUOTES);
        return true;
    }
}

// Instancia global
window.db = new Database();
