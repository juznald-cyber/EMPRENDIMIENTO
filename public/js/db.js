// js/db.js - Base de Datos Local y Gestor de Estado
const DB_KEYS = {
    PROFILE: 'cotizador_profile',
    SUPPLIERS: 'cotizador_suppliers',
    PRODUCTS: 'cotizador_products',
    VINYLS: 'cotizador_vinyls',
    QUOTES: 'cotizador_quotes',
    GLOBAL_TIERS: 'cotizador_global_tiers',
    SETTINGS: 'cotizador_settings'
};

// Datos iniciales de demostración y configuración por defecto
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
    logo: '', // Base64
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
        name: 'Distribuidora Gráfica Nacional',
        contact: 'Carlos Rodríguez',
        phone: '+58 414 5551122',
        email: 'ventas@distribuidoragrafica.com',
        category: 'Vinilos y Materiales Publicitarios',
        notes: 'Descuento del 5% por pronto pago en transferencias.'
    },
    {
        id: 'sup_2',
        name: 'Textiles & Confección Global',
        contact: 'María Elena Pérez',
        phone: '+58 424 9998877',
        email: 'pedidos@textilesglobal.com',
        category: 'Prendas, Gorras y Textil',
        notes: 'Entregas los días martes y jueves.'
    },
    {
        id: 'sup_3',
        name: 'Insumos Tecnológicos UV',
        contact: 'Ing. Fernando Mendoza',
        phone: '+58 416 3334455',
        email: 'contacto@insumosuv.com',
        category: 'Tintas e Impresión UV',
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
        costPerM2: 6.50, // Costo base de material por m2
        laborCostPerM2: 4.00, // Mano de obra de corte / pelado / transfer por m2
        defaultMargin: 55, // Margen de venta %
        wasteRate: 15, // 15% de merma / desperdicio
        description: 'Ideal para rotulación vehicular, vidrieras, señalética y stickers troquelados.',
        unitName: 'm²'
    },
    {
        id: 'vin_uv',
        type: 'uv',
        name: 'Impresión / Transfer DTF UV (Adhesivo para Rígidos)',
        costPerM2: 18.00,
        laborCostPerM2: 6.00,
        defaultMargin: 60,
        wasteRate: 10,
        description: 'Para termos, tazas, plástico, metal, madera y superficies duras sin calor.',
        unitName: 'm²'
    },
    {
        id: 'vin_textil',
        type: 'textil',
        name: 'Vinilo Textil Termotransferible / DTF Textil',
        costPerM2: 12.00,
        laborCostPerM2: 5.00,
        defaultMargin: 50,
        wasteRate: 12,
        description: 'Para estampado de franelas, uniformes, gorras y prendas de vestir.',
        unitName: 'm²'
    },
    {
        id: 'vin_lona',
        type: 'lona',
        name: 'Lona Banner Impresa 13oz con Ojetes',
        costPerM2: 7.00,
        laborCostPerM2: 3.50,
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
                costPrice: 4.50,
                margin: 45,
                quantity: 25,
                unitPrice: 6.53,
                total: 163.25,
                notes: 'Color negro, tallas variadas (S, M, L)'
            },
            {
                id: 'item_2',
                isVinyl: true,
                vinylType: 'uv',
                name: 'Stickers DTF UV para Personalizar Termos (Medida 8x8 cm)',
                unit: 'm²',
                dimensions: { widthCm: 8, heightCm: 8, count: 100, areaM2: 0.64 },
                costPrice: 15.36,
                margin: 60,
                quantity: 1,
                unitPrice: 38.40,
                total: 38.40,
                notes: 'Impresión DTF UV en alta resolución barniz incluido'
            }
        ],
        subtotal: 201.65,
        discountPercentage: 0,
        discountAmount: 0,
        taxRate: 16,
        taxAmount: 32.26,
        total: 233.91,
        status: 'Aprobada',
        notes: 'Tiempo estimado de entrega: 5 días hábiles luego del abono inicial.'
    }
];

// Motor de persistencia y métodos de base de datos
class Database {
    constructor() {
        this.init();
    }

    init() {
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

    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error(`Error guardando ${key} en localStorage:`, e);
            return false;
        }
    }

    // Perfil de la Empresa
    getProfile() {
        return this.get(DB_KEYS.PROFILE, DEFAULT_PROFILE);
    }

    saveProfile(profileData) {
        const current = this.getProfile();
        const updated = { ...current, ...profileData };
        this.set(DB_KEYS.PROFILE, updated);
        return updated;
    }

    // Escalas Globales de Márgenes por Volumen
    getGlobalTiers() {
        return this.get(DB_KEYS.GLOBAL_TIERS, DEFAULT_GLOBAL_TIERS);
    }

    saveGlobalTiers(tiers) {
        this.set(DB_KEYS.GLOBAL_TIERS, tiers);
        return tiers;
    }

    // Proveedores
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

    // Productos / Insumos
    getProducts() {
        return this.get(DB_KEYS.PRODUCTS, []);
    }

    getProductById(id) {
        return this.getProducts().find(p => p.id === id);
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

    // Calculador de Márgenes Dinámicos según Cantidad
    getMarginForQuantity(product, quantity) {
        const qty = parseFloat(quantity) || 1;
        
        // 1. Si el producto tiene escalas personalizadas activas
        if (product && product.customTiers && product.customTiers.length > 0) {
            const matchedTier = product.customTiers.find(tier => qty >= tier.min && qty <= tier.max);
            if (matchedTier) return parseFloat(matchedTier.margin);
        }

        // 2. Si usa las escalas globales
        if (!product || product.useGlobalTiers !== false) {
            const globalTiers = this.getGlobalTiers();
            const matchedTier = globalTiers.find(tier => qty >= tier.min && qty <= tier.max);
            if (matchedTier) return parseFloat(matchedTier.margin);
        }

        // 3. Margen por defecto del producto o perfil
        return product?.defaultMargin !== undefined ? parseFloat(product.defaultMargin) : 40;
    }

    calculateSalePrice(costPrice, marginPercent) {
        const cost = parseFloat(costPrice) || 0;
        const margin = parseFloat(marginPercent) || 0;
        return Number((cost * (1 + margin / 100)).toFixed(2));
    }

    // Vinilos
    getVinylPresets() {
        return this.get(DB_KEYS.VINYLS, DEFAULT_VINYLS);
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

    // Cotizaciones
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

    // Respaldo y Restauración
    exportAllData() {
        return {
            version: '1.0',
            exportDate: new Date().toISOString(),
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
        if (jsonData.profile) this.set(DB_KEYS.PROFILE, jsonData.profile);
        if (jsonData.globalTiers) this.set(DB_KEYS.GLOBAL_TIERS, jsonData.globalTiers);
        if (jsonData.suppliers) this.set(DB_KEYS.SUPPLIERS, jsonData.suppliers);
        if (jsonData.products) this.set(DB_KEYS.PRODUCTS, jsonData.products);
        if (jsonData.vinyls) this.set(DB_KEYS.VINYLS, jsonData.vinyls);
        if (jsonData.quotes) this.set(DB_KEYS.QUOTES, jsonData.quotes);
        return true;
    }

    resetToFactory() {
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
