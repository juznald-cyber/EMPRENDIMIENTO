// js/vinilos.js - Calculadora Especializada de Vinilos por Metro Cuadrado
class VinylCalculator {
    constructor() {
        this.currentPresetId = 'vin_adh';
        this.unitMode = 'cm'; // 'cm' o 'm'
    }

    getPreset(id) {
        const presets = window.db.getVinylPresets();
        return presets.find(p => p.id === id) || presets[0];
    }

    calculate(params) {
        const {
            presetId = this.currentPresetId,
            width = 0,
            height = 0,
            unitMode = 'cm',
            quantity = 1,
            customCostM2 = null,
            customLaborM2 = null,
            customMargin = null,
            customWaste = null,
            extraFinishCost = 0,
            notes = ''
        } = params;

        const preset = this.getPreset(presetId);

        // Convertir ancho y alto a metros
        const widthM = unitMode === 'cm' ? (parseFloat(width) || 0) / 100 : (parseFloat(width) || 0);
        const heightM = unitMode === 'cm' ? (parseFloat(height) || 0) / 100 : (parseFloat(height) || 0);
        const qty = parseInt(quantity, 10) || 1;

        // Área unitaria y total neta en m²
        const unitAreaM2 = widthM * heightM;
        const totalNetAreaM2 = unitAreaM2 * qty;

        // Porcentaje de merma / desperdicio
        const wasteRate = customWaste !== null && !isNaN(customWaste) ? parseFloat(customWaste) : (preset?.wasteRate || 10);
        const totalGrossAreaM2 = totalNetAreaM2 * (1 + (wasteRate / 100));

        // Costos base por m²
        const costPerM2 = customCostM2 !== null && !isNaN(customCostM2) ? parseFloat(customCostM2) : (preset?.costPerM2 || 0);
        const laborCostPerM2 = customLaborM2 !== null && !isNaN(customLaborM2) ? parseFloat(customLaborM2) : (preset?.laborCostPerM2 || 0);
        const extraCost = parseFloat(extraFinishCost) || 0;

        // Costos totales
        const materialCostTotal = totalGrossAreaM2 * costPerM2;
        const laborCostTotal = totalGrossAreaM2 * laborCostPerM2;
        const totalBaseCost = materialCostTotal + laborCostTotal + extraCost;

        // Margen de ganancia
        const margin = customMargin !== null && !isNaN(customMargin) ? parseFloat(customMargin) : (preset?.defaultMargin || 50);

        // Precio final de venta
        const totalSalePrice = totalBaseCost * (1 + (margin / 100));
        const unitPrice = qty > 0 ? (totalSalePrice / qty) : 0;
        const unitCost = qty > 0 ? (totalBaseCost / qty) : 0;

        return {
            preset,
            widthInput: width,
            heightInput: height,
            unitMode,
            widthM: Number(widthM.toFixed(4)),
            heightM: Number(heightM.toFixed(4)),
            quantity: qty,
            unitAreaM2: Number(unitAreaM2.toFixed(4)),
            totalNetAreaM2: Number(totalNetAreaM2.toFixed(4)),
            totalGrossAreaM2: Number(totalGrossAreaM2.toFixed(4)),
            wasteRate,
            costPerM2: Number(costPerM2.toFixed(2)),
            laborCostPerM2: Number(laborCostPerM2.toFixed(2)),
            extraFinishCost: Number(extraCost.toFixed(2)),
            materialCostTotal: Number(materialCostTotal.toFixed(2)),
            laborCostTotal: Number(laborCostTotal.toFixed(2)),
            totalBaseCost: Number(totalBaseCost.toFixed(2)),
            margin,
            totalSalePrice: Number(totalSalePrice.toFixed(2)),
            unitPrice: Number(unitPrice.toFixed(2)),
            unitCost: Number(unitCost.toFixed(2)),
            profitAmount: Number((totalSalePrice - totalBaseCost).toFixed(2)),
            notes
        };
    }

    createQuoteItemFromCalc(calcResult, customTitle = '') {
        const p = calcResult.preset;
        const title = customTitle.trim() || `${p.name} (${calcResult.widthInput}x${calcResult.heightInput} ${calcResult.unitMode})`;
        
        return {
            id: 'vinyl_item_' + Date.now(),
            isVinyl: true,
            vinylPresetId: p.id,
            vinylType: p.type,
            name: title,
            unit: 'Pza / m²',
            dimensions: {
                width: calcResult.widthInput,
                height: calcResult.heightInput,
                unitMode: calcResult.unitMode,
                areaM2: calcResult.totalNetAreaM2,
                grossAreaM2: calcResult.totalGrossAreaM2,
                wasteRate: calcResult.wasteRate
            },
            quantity: calcResult.quantity,
            costPrice: calcResult.unitCost, // Costo unitario
            margin: calcResult.margin,
            unitPrice: calcResult.unitPrice, // Precio unitario de venta
            total: calcResult.totalSalePrice,
            notes: calcResult.notes || `Área total: ${calcResult.totalNetAreaM2} m² (${calcResult.totalGrossAreaM2} m² con ${calcResult.wasteRate}% merma). Incluye material y mano de obra.`
        };
    }
}

window.vinylCalc = new VinylCalculator();
