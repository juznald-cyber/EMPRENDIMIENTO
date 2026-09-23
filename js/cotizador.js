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
        const defaultTax = (profile.taxRate !== undefined && profile.taxRate !== null) ? parseFloat(profile.taxRate) : 19;

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
            taxRate: defaultTax,
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
        const baseCost = window.db.getCostForQuantity(product, qty);
        const extraCost = parseFloat(product.extraCost) || 0;
        const totalUnitCost = baseCost + extraCost;

        const profile = window.db.getProfile();
        const taxRate = parseFloat(profile.taxRate !== undefined ? profile.taxRate : 19) || 19;
        const taxFactor = 1 + (taxRate / 100);

        let grossUnitPrice;
        let margin;
        if (customMargin !== null && !isNaN(customMargin)) {
            margin = parseFloat(customMargin);
            grossUnitPrice = Number((totalUnitCost * (1 + margin / 100)).toFixed(2));
        } else {
            grossUnitPrice = window.db.getSalePriceForQuantity(product, qty);
            margin = totalUnitCost > 0
                ? Number((((grossUnitPrice / totalUnitCost) - 1) * 100).toFixed(2))
                : window.db.getMarginForQuantity(product, qty);
        }

        // El precio de venta registrado ya incluye IVA. 
        // Se descuenta el IVA para dejar solo el valor NETO en el ítem de la cotización:
        const netUnitPrice = Number((grossUnitPrice / taxFactor).toFixed(2));
        const lineTotal = Number((netUnitPrice * qty).toFixed(2));

        const newItem = {
            id: 'item_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            productId: product.id,
            name: product.name,
            unit: product.unit || 'Unid',
            costPrice: totalUnitCost,
            margin: margin,
            quantity: qty,
            grossUnitPrice: grossUnitPrice,
            unitPrice: netUnitPrice,
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

        const profile = window.db.getProfile();
        const taxRate = parseFloat(profile.taxRate !== undefined ? profile.taxRate : 19) || 19;
        const taxFactor = 1 + (taxRate / 100);

        // Si el ítem de vinilo tiene precio con IVA, descontamos para dejar precio neto unitario
        if (vinylItem.unitPrice && !vinylItem.isNetCalculated) {
            vinylItem.grossUnitPrice = vinylItem.unitPrice;
            vinylItem.unitPrice = Number((vinylItem.unitPrice / taxFactor).toFixed(2));
            vinylItem.total = Number((vinylItem.unitPrice * (vinylItem.quantity || 1)).toFixed(2));
            vinylItem.isNetCalculated = true;
        }

        this.currentQuote.items.push(vinylItem);
        this.recalculateTotals();
        return vinylItem;
    }

    addCustomItem(name, unit, costPrice, margin, quantity, notes = '') {
        const qty = parseInt(quantity, 10) || 1;
        const cost = parseFloat(costPrice) || 0;
        const marg = parseFloat(margin) || 40;
        const grossUnitPrice = window.db.calculateSalePrice(cost, marg);

        const profile = window.db.getProfile();
        const taxRate = parseFloat(profile.taxRate !== undefined ? profile.taxRate : 19) || 19;
        const taxFactor = 1 + (taxRate / 100);

        const netUnitPrice = Number((grossUnitPrice / taxFactor).toFixed(2));
        const lineTotal = Number((netUnitPrice * qty).toFixed(2));

        const newItem = {
            id: 'custom_item_' + Date.now(),
            productId: null,
            name: name || 'Servicio / Producto Personalizado',
            unit: unit || 'Servicio',
            costPrice: cost,
            margin: marg,
            quantity: qty,
            grossUnitPrice: grossUnitPrice,
            unitPrice: netUnitPrice,
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

        const profile = window.db.getProfile();
        const taxRate = parseFloat(profile.taxRate !== undefined ? profile.taxRate : 19) || 19;
        const taxFactor = 1 + (taxRate / 100);

        if (item.productId) {
            const product = window.db.getProductById(item.productId);
            if (product) {
                const baseCost = window.db.getCostForQuantity(product, qty);
                const extraCost = parseFloat(product.extraCost) || 0;
                item.costPrice = baseCost + extraCost;

                const grossUnitPrice = window.db.getSalePriceForQuantity(product, qty);
                item.grossUnitPrice = grossUnitPrice;
                item.unitPrice = Number((grossUnitPrice / taxFactor).toFixed(2));
                item.margin = item.costPrice > 0 
                    ? Number((((grossUnitPrice / item.costPrice) - 1) * 100).toFixed(2))
                    : window.db.getMarginForQuantity(product, qty);
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

        const profile = window.db.getProfile();
        const taxRate = parseFloat(profile.taxRate !== undefined ? profile.taxRate : 19) || 19;
        const taxFactor = 1 + (taxRate / 100);

        const grossUnitPrice = window.db.calculateSalePrice(item.costPrice, margin);
        item.grossUnitPrice = grossUnitPrice;
        item.unitPrice = Number((grossUnitPrice / taxFactor).toFixed(2));
        item.total = Number((item.unitPrice * item.quantity).toFixed(2));
        this.recalculateTotals();
    }

    updateItemUnitPrice(index, newUnitPrice) {
        const item = this.currentQuote.items[index];
        if (!item) return;

        const price = parseFloat(newUnitPrice) || 0;
        item.unitPrice = price;
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

        // Descuento sobre subtotal neto
        const discountPct = parseFloat(this.currentQuote.discountPercentage) || 0;
        const discountAmount = Number(((this.currentQuote.subtotal * discountPct) / 100).toFixed(2));
        this.currentQuote.discountAmount = discountAmount;

        // Base Imponible (Neto)
        const taxableBase = Math.max(0, this.currentQuote.subtotal - discountAmount);

        // Impuestos (IVA 19%) sumado en el total
        if (profile.enableTax !== false) {
            const taxRate = parseFloat(profile.taxRate !== undefined ? profile.taxRate : 19) || 19;
            const taxAmount = Number(((taxableBase * taxRate) / 100).toFixed(2));
            this.currentQuote.taxRate = taxRate;
            this.currentQuote.taxAmount = taxAmount;
            this.currentQuote.total = Number((taxableBase + taxAmount).toFixed(2));
        } else {
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
