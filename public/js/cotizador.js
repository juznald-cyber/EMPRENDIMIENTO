// js/cotizador.js - Gestión Integral del Módulo de Cotizaciones
class CotizadorManager {
    constructor() {
        this.currentQuote = this.createNewDraft();
        this.isEditing = false;
    }

    createNewDraft() {
        const profile = window.db.getProfile();
        const today = new Date().toISOString().split('T')[0];
        const validDate = new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0];

        return {
            id: null,
            quoteNumber: window.db.getNextQuoteNumber(),
            date: today,
            validUntil: validDate,
            client: {
                name: '',
                rut: '',
                contact: '',
                phone: '',
                email: '',
                address: ''
            },
            items: [],
            subtotal: 0,
            discountPercentage: 0,
            discountAmount: 0,
            taxRate: profile.enableTax ? (profile.taxRate || 16) : 0,
            taxAmount: 0,
            total: 0,
            status: 'Borrador',
            notes: ''
        };
    }

    resetDraft() {
        this.currentQuote = this.createNewDraft();
        this.isEditing = false;
    }

    loadQuote(id) {
        const found = window.db.getQuoteById(id);
        if (found) {
            this.currentQuote = JSON.parse(JSON.stringify(found));
            if (!this.currentQuote.client) this.currentQuote.client = {};
            if (!this.currentQuote.client.rut) this.currentQuote.client.rut = '';
            this.isEditing = true;
            this.recalculateTotals();
            return this.currentQuote;
        }
        return null;
    }

    duplicateQuote(id) {
        const found = window.db.getQuoteById(id);
        if (found) {
            this.currentQuote = JSON.parse(JSON.stringify(found));
            this.currentQuote.id = null;
            this.currentQuote.quoteNumber = window.db.getNextQuoteNumber();
            this.currentQuote.date = new Date().toISOString().split('T')[0];
            this.currentQuote.validUntil = new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0];
            this.currentQuote.status = 'Borrador';
            if (!this.currentQuote.client) this.currentQuote.client = {};
            this.isEditing = false;
            this.recalculateTotals();
            return this.currentQuote;
        }
        return null;
    }

    addProductItem(productId, quantity = 1, customMargin = null) {
        const product = window.db.getProductById(productId);
        if (!product) return false;

        const qty = parseInt(quantity, 10) || 1;
        // Obtener costo según escala de cantidad del proveedor
        const costPrice = window.db.getCostForQuantity(product, qty);

        // Calcular margen dinámico según volumen si no se forzó uno personalizado
        const margin = customMargin !== null && !isNaN(customMargin) 
            ? parseFloat(customMargin) 
            : window.db.getMarginForQuantity(product, qty);

        const unitPrice = window.db.calculateSalePrice(costPrice, margin);
        const lineTotal = Number((unitPrice * qty).toFixed(2));

        const newItem = {
            id: 'item_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            productId: product.id,
            name: product.name,
            unit: product.unit || 'Unid',
            costPrice: costPrice,
            margin: margin,
            quantity: qty,
            unitPrice: unitPrice,
            total: lineTotal,
            notes: product.notes || '',
            useGlobalTiers: product.useGlobalTiers
        };

        this.currentQuote.items.push(newItem);
        this.recalculateTotals();
        return newItem;
    }

    addVinylItem(vinylItem) {
        if (!vinylItem) return false;
        this.currentQuote.items.push(vinylItem);
        this.recalculateTotals();
        return vinylItem;
    }

    addCustomItem(name, unit, costPrice, margin, quantity, notes = '') {
        const qty = parseInt(quantity, 10) || 1;
        const cost = parseFloat(costPrice) || 0;
        const marg = parseFloat(margin) || 40;
        const unitPrice = window.db.calculateSalePrice(cost, marg);
        const lineTotal = Number((unitPrice * qty).toFixed(2));

        const newItem = {
            id: 'custom_item_' + Date.now(),
            productId: null,
            name: name || 'Servicio / Producto Personalizado',
            unit: unit || 'Servicio',
            costPrice: cost,
            margin: marg,
            quantity: qty,
            unitPrice: unitPrice,
            total: lineTotal,
            notes: notes
        };

        this.currentQuote.items.push(newItem);
        this.recalculateTotals();
        return newItem;
    }

    updateItemQuantity(index, newQty) {
        const item = this.currentQuote.items[index];
        if (!item) return;

        const qty = Math.max(1, parseInt(newQty, 10) || 1);
        item.quantity = qty;

        // Si proviene de un producto del catálogo, recalcular costo por escala y margen por volumen
        if (item.productId) {
            const product = window.db.getProductById(item.productId);
            if (product) {
                item.costPrice = window.db.getCostForQuantity(product, qty);
                item.margin = window.db.getMarginForQuantity(product, qty);
                item.unitPrice = window.db.calculateSalePrice(item.costPrice, item.margin);
            }
        }

        item.total = Number((item.unitPrice * qty).toFixed(2));
        this.recalculateTotals();
    }

    updateItemMargin(index, newMargin) {
        const item = this.currentQuote.items[index];
        if (!item) return;

        const margin = parseFloat(newMargin) || 0;
        item.margin = margin;
        item.unitPrice = window.db.calculateSalePrice(item.costPrice, margin);
        item.total = Number((item.unitPrice * item.quantity).toFixed(2));
        this.recalculateTotals();
    }

    updateItemUnitPrice(index, newUnitPrice) {
        const item = this.currentQuote.items[index];
        if (!item) return;

        const price = parseFloat(newUnitPrice) || 0;
        item.unitPrice = price;
        // Recalcular margen hacia atrás si hay costo base
        if (item.costPrice > 0) {
            item.margin = Number((((price - item.costPrice) / item.costPrice) * 100).toFixed(1));
        }
        item.total = Number((price * item.quantity).toFixed(2));
        this.recalculateTotals();
    }

    removeItem(index) {
        if (this.currentQuote.items[index]) {
            this.currentQuote.items.splice(index, 1);
            this.recalculateTotals();
            return true;
        }
        return false;
    }

    recalculateTotals() {
        const profile = window.db.getProfile();
        let subtotal = 0;

        this.currentQuote.items.forEach(item => {
            subtotal += (parseFloat(item.total) || 0);
        });
        this.currentQuote.subtotal = Number(subtotal.toFixed(2));

        // Descuento
        const discountPct = parseFloat(this.currentQuote.discountPercentage) || 0;
        const discountAmount = Number(((this.currentQuote.subtotal * discountPct) / 100).toFixed(2));
        this.currentQuote.discountAmount = discountAmount;

        // Base Imponible
        const taxableBase = Math.max(0, this.currentQuote.subtotal - discountAmount);

        // Impuestos (IVA)
        if (profile.enableTax) {
            const taxRate = parseFloat(this.currentQuote.taxRate !== undefined ? this.currentQuote.taxRate : profile.taxRate) || 0;
            const taxAmount = Number(((taxableBase * taxRate) / 100).toFixed(2));
            this.currentQuote.taxRate = taxRate;
            this.currentQuote.taxAmount = taxAmount;
            this.currentQuote.total = Number((taxableBase + taxAmount).toFixed(2));
        } else {
            this.currentQuote.taxRate = 0;
            this.currentQuote.taxAmount = 0;
            this.currentQuote.total = Number(taxableBase.toFixed(2));
        }
    }

    saveCurrentQuote() {
        this.recalculateTotals();
        if (!this.currentQuote.client.name.trim()) {
            this.currentQuote.client.name = 'Cliente Particular';
        }
        const saved = window.db.saveQuote(this.currentQuote);
        this.currentQuote = JSON.parse(JSON.stringify(saved));
        this.isEditing = true;
        return saved;
    }
}

window.cotizador = new CotizadorManager();
