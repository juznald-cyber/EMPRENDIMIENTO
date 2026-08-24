// js/db.js - Base de Datos Local, Autenticación y Gestor de Estado
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
        costPerM2: 6.50,
        laborCostPerM2: 4.00,
        defaultMargin: 55,
        wasteRate: 15,
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
        this.init();
    }

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

    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error(`Error guardando ${key} en localStorage:`, e);
            return false;
        }
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

        const headers = rows[0].map(h => String(h || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));

        const idxSku = headers.findIndex(h => h.includes('sku') || h.includes('codigo') || h.includes('ref'));
        const idxName = headers.findIndex(h => h.includes('nombre') || h.includes('producto') || h.includes('insumo') || h.includes('descripcion'));
        const idxSup = headers.findIndex(h => h.includes('proveedor') || h.includes('supplier'));
        const idxCat = headers.findIndex(h => h.includes('categoria') || h.includes('rubro'));
        const idxUnit = headers.findIndex(h => h.includes('unidad') || h.includes('unit') || h.includes('medida'));
        const idxCost = headers.findIndex(h => h.includes('costo') || h.includes('cost') || h.includes('precio'));
        const idxMargin = headers.findIndex(h => h.includes('margen') || h.includes('ganancia') || h.includes('margin'));
        const idxUrl = headers.findIndex(h => h.includes('url') || h.includes('enlace') || h.includes('link') || h.includes('web') || h.includes('pagina'));
        const idxNotes = headers.findIndex(h => h.includes('nota') || h.includes('observacion') || h.includes('especificacion'));

        if (idxName === -1) throw new Error('No se encontró la columna "Nombre" o "Producto" en el archivo Excel.');

        const suppliers = this.getSuppliers();
        let count = 0;

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;
            const name = String(row[idxName] || '').trim();
            if (!name) continue;

            const sku = idxSku !== -1 && row[idxSku] ? String(row[idxSku]).trim() : ('PROD-' + Math.floor(Math.random() * 9000 + 1000));
            const supplierRaw = idxSup !== -1 ? String(row[idxSup] || '').trim() : '';
            let matchedSup = suppliers.find(s => s.name.toLowerCase() === supplierRaw.toLowerCase() || s.id === supplierRaw);
            if (!matchedSup && supplierRaw) {
                matchedSup = this.saveSupplier({ name: supplierRaw, category: 'General' });
            }
            const supplierId = matchedSup ? matchedSup.id : (suppliers[0]?.id || 'sup_1');

            const category = idxCat !== -1 && row[idxCat] ? String(row[idxCat]).trim() : 'General';
            const unit = idxUnit !== -1 && row[idxUnit] ? String(row[idxUnit]).trim() : 'Unidad';
            const costPrice = idxCost !== -1 ? (parseFloat(String(row[idxCost] || '0').replace('$', '').replace(',', '.')) || 0) : 0;
            const defaultMargin = idxMargin !== -1 ? (parseFloat(String(row[idxMargin] || '50').replace('%', '')) || 50) : 50;
            const url = idxUrl !== -1 ? String(row[idxUrl] || '').trim() : '';
            const notes = idxNotes !== -1 ? String(row[idxNotes] || '').trim() : '';

            this.saveProduct({
                sku,
                name,
                supplierId,
                category,
                unit,
                costPrice,
                defaultMargin,
                url,
                notes,
                costTiers: [],
                useGlobalTiers: true
            });
            if (category) this.saveCategory(category);
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
            ["SKU", "Nombre", "Proveedor", "Categoria", "Unidad", "Costo", "Margen", "URL_Producto", "Notas"],
            ["VIN-ADH-BLA", "Bobina Vinilo Adhesivo Blanco (1.22m x 50m)", "Distribuidora Gráfica Nacional", "Vinilos", "Rollo", 85.00, 45, "https://proveedor.com/vinilo-blanco", "Marca Oracal 651"],
            ["FRA-ALG-NEG", "Franela de Algodón 24/1 Cuello Redondo", "Textiles & Confección Global", "Textil", "Unidad", 4.20, 50, "https://proveedor.com/franela-algodon", "Colores variados"],
            ["LAM-UV-500", "Lámina Acrílico Transparente 3mm 120x240", "Insumos Tecnológicos UV", "Insumos", "Plancha", 38.00, 40, "https://proveedor.com/acrilico-3mm", "Corte láser"]
        ];

        if (window.XLSX) {
            const ws = window.XLSX.utils.aoa_to_sheet(data);
            const wb = window.XLSX.utils.book_new();
            window.XLSX.utils.book_append_sheet(wb, ws, "Productos");
            window.XLSX.writeFile(wb, "Plantilla_Importar_Productos.xlsx");
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
        const csvContent = "\uFEFF" + "SKU,Nombre,Proveedor,Categoria,Unidad,Costo,Margen,URL_Producto,Notas\n" +
            "VIN-ADH-BLA,Bobina Vinilo Adhesivo Blanco (1.22m x 50m),Distribuidora Gráfica Nacional,Vinilos,Rollo,85.00,45,https://proveedor.com/vinilo-blanco,Marca Oracal 651\n" +
            "FRA-ALG-NEG,Franela de Algodón 24/1 Cuello Redondo,Textiles & Confección Global,Textil,Unidad,4.20,50,https://proveedor.com/franela-algodon,Colores variados\n" +
            "LAM-UV-500,Lámina Acrílico Transparente 3mm 120x240,Insumos Tecnológicos UV,Insumos,Plancha,38.00,40,https://proveedor.com/acrilico-3mm,Corte láser";
        this.triggerDownloadCSV(csvContent, 'Plantilla_Importar_Productos.csv');
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

        // 3. Margen por defecto del producto
        return product?.defaultMargin !== undefined ? parseFloat(product.defaultMargin) : 40;
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
