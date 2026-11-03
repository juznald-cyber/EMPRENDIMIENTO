// js/costos.js - Módulo de Costos Operativos, Insumos por Rendimiento, Depreciación de Maquinaria (Alcancía) y Electricidad
class CostosManager {
    constructor() {
        this.currentCategoryFilter = 'all';
        this.composerSelection = new Map(); // costId -> multiplier
        this.modalPickerSelection = new Map(); // costId -> multiplier (para #modal-pick-extra-costs)
    }

    init() {
        // Inicializar selección por defecto en el simulador/armador si está vacía
        const costs = window.db.getOperationalCosts();
        if (this.composerSelection.size === 0 && costs.length > 0) {
            costs.slice(0, 4).forEach(c => {
                this.composerSelection.set(c.id, 1);
            });
        }
        this.render();
    }

    escapeHTML(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    setCategoryFilter(cat) {
        this.currentCategoryFilter = cat || 'all';
        document.querySelectorAll('[data-costos-filter]').forEach(btn => {
            const isMatch = btn.getAttribute('data-costos-filter') === this.currentCategoryFilter;
            if (isMatch) {
                btn.className = 'px-3.5 py-2 text-xs font-bold rounded-xl bg-indigo-600 text-white shadow-sm transition-all flex items-center gap-1.5 shrink-0';
            } else {
                btn.className = 'px-3.5 py-2 text-xs font-bold rounded-xl text-slate-600 hover:bg-slate-200 transition-all flex items-center gap-1.5 shrink-0';
            }
        });
        this.renderItemsGrid();
    }

    onGlobalSettingsChange() {
        const kwhEl = document.getElementById('costos-setting-kwh');
        const hrEl = document.getElementById('costos-setting-hourly');
        const kwhPrice = Math.max(0, parseFloat(kwhEl?.value) || 0);
        const operatorHourlyRate = Math.max(0, parseFloat(hrEl?.value) || 0);

        window.db.saveCostSettings({ kwhPrice, operatorHourlyRate });
        this.render();
        if (window.app) {
            window.app.showToast('Tarifas globales de electricidad y mano de obra actualizadas.', 'success');
        }
    }

    render() {
        const costs = window.db.getOperationalCosts();
        const settings = window.db.getCostSettings();
        const profile = window.db.getProfile();
        const currency = profile.currency || '$';

        // 1. Poblar inputs de configuración global (kWh y Hora Operador)
        const kwhEl = document.getElementById('costos-setting-kwh');
        const hrEl = document.getElementById('costos-setting-hourly');
        if (kwhEl && document.activeElement !== kwhEl) kwhEl.value = settings.kwhPrice;
        if (hrEl && document.activeElement !== hrEl) hrEl.value = settings.operatorHourlyRate;

        // 2. Calcular KPIs superiores
        const insumos = costs.filter(c => c.category === 'insumo');
        const maquinas = costs.filter(c => c.category === 'maquinaria');
        const electricidad = costs.filter(c => c.category === 'electricidad');
        const operativos = costs.filter(c => c.category === 'operativo');

        let totalMaquinariaUnitCost = 0;
        let totalAlcanciaSaved = 0;
        let totalMaquinariaTarget = 0;

        maquinas.forEach(m => {
            const unitCost = window.db.calculateOperationalUnitCost(m, settings);
            const used = Math.max(0, parseFloat(m.usedCount) || 0);
            const purchase = Math.max(0, parseFloat(m.purchaseCost) || 0);
            const salvage = Math.max(0, parseFloat(m.salvageValue) || 0);
            const target = Math.max(0, purchase - salvage);

            totalMaquinariaUnitCost += unitCost;
            totalAlcanciaSaved += (used * unitCost);
            totalMaquinariaTarget += target;
        });

        const elKpiInsumos = document.getElementById('costos-kpi-insumos-count');
        const elKpiInsumosSub = document.getElementById('costos-kpi-insumos-sub');
        const elKpiMaqCount = document.getElementById('costos-kpi-maquinaria-count');
        const elKpiMaqSub = document.getElementById('costos-kpi-maquinaria-sub');
        const elKpiAlcancia = document.getElementById('costos-kpi-alcancia-amount');
        const elKpiAlcanciaSub = document.getElementById('costos-kpi-alcancia-sub');

        const sumInsumosUnit = insumos.reduce((acc, it) => acc + window.db.calculateOperationalUnitCost(it, settings), 0);

        if (elKpiInsumos) elKpiInsumos.textContent = `${insumos.length} insumos`;
        if (elKpiInsumosSub) elKpiInsumosSub.textContent = `Suma unitaria: ${currency} ${window.formatMoney(sumInsumosUnit)} / u`;

        if (elKpiMaqCount) elKpiMaqCount.textContent = `${maquinas.length} equipos`;
        if (elKpiMaqSub) elKpiMaqSub.textContent = `Desgaste total: ${currency} ${window.formatMoney(totalMaquinariaUnitCost)} / uso`;

        if (elKpiAlcancia) elKpiAlcancia.textContent = `${currency} ${window.formatMoney(totalAlcanciaSaved)}`;
        if (elKpiAlcanciaSub) {
            const pct = totalMaquinariaTarget > 0 ? Math.min(100, (totalAlcanciaSaved / totalMaquinariaTarget) * 100) : 0;
            elKpiAlcanciaSub.textContent = `Meta reposición: ${currency} ${window.formatMoney(totalMaquinariaTarget)} (${window.formatNumber(pct, 1)}%)`;
        }

        // Actualizar contadores en botones de filtro
        const setBadge = (id, n) => { const el = document.getElementById(id); if (el) el.textContent = `(${n})`; };
        setBadge('costos-count-all', costs.length);
        setBadge('costos-count-insumo', insumos.length);
        setBadge('costos-count-maquinaria', maquinas.length);
        setBadge('costos-count-electricidad', electricidad.length);
        setBadge('costos-count-operativo', operativos.length);

        this.renderItemsGrid();
        this.renderComposer();
        this.populateApplyProductSelect();

        if (window.lucide) window.lucide.createIcons();
    }

    renderItemsGrid() {
        const container = document.getElementById('costos-items-grid');
        if (!container) return;

        const costs = window.db.getOperationalCosts();
        const settings = window.db.getCostSettings();
        const profile = window.db.getProfile();
        const currency = profile.currency || '$';
        const query = (document.getElementById('costos-search-input')?.value || '').toLowerCase().trim();

        const filtered = costs.filter(c => {
            const matchCat = this.currentCategoryFilter === 'all' || c.category === this.currentCategoryFilter;
            const matchQ = !query ||
                (c.name || '').toLowerCase().includes(query) ||
                (c.notes || '').toLowerCase().includes(query) ||
                (c.unitLabel || '').toLowerCase().includes(query);
            return matchCat && matchQ;
        });

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="col-span-full py-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-6">
                    <p class="text-xs font-bold text-slate-500">No hay costos registrados en esta categoría.</p>
                    <p class="text-[11px] text-slate-400 mt-1">Usa el botón "+ Nuevo Costo / Equipo" para registrar tintas, papel, planchas, plotters o consumo eléctrico.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filtered.map(item => this._renderCostCardHTML(item, settings, currency)).join('');
        if (window.lucide) window.lucide.createIcons();
    }

    _renderCostCardHTML(item, settings, currency) {
        const unitCost = window.db.calculateOperationalUnitCost(item, settings);
        const unitLabel = this.escapeHTML(item.unitLabel || 'unidad');
        const cat = item.category || 'insumo';

        const badgeMeta = {
            'insumo': { label: '💧 Insumo por Rendimiento', cls: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
            'maquinaria': { label: '⚙️ Maquinaria & Depreciación', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
            'electricidad': { label: '⚡ Consumo Eléctrico (Wh)', cls: 'bg-yellow-50 text-yellow-800 border-yellow-300' },
            'operativo': { label: '⏱️ Mano de Obra / Logística', cls: 'bg-purple-50 text-purple-700 border-purple-200' }
        }[cat] || { label: 'Costo', cls: 'bg-slate-100 text-slate-700 border-slate-200' };

        let bodyDetailsHTML = '';

        if (cat === 'insumo') {
            const cost = parseFloat(item.purchaseCost) || 0;
            const yieldU = Math.max(1, parseFloat(item.yieldUnits) || 1);
            bodyDetailsHTML = `
                <div class="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
                    <div>
                        <span class="text-[10px] text-slate-400 font-bold uppercase block">Costo de Compra</span>
                        <span class="font-mono font-bold text-slate-800">${currency} ${window.formatMoney(cost)}</span>
                    </div>
                    <div>
                        <span class="text-[10px] text-slate-400 font-bold uppercase block">Rendimiento Estimado</span>
                        <span class="font-mono font-bold text-cyan-700">${window.formatNumber(yieldU, 0)} ${unitLabel}s</span>
                    </div>
                </div>
                <div class="text-[11px] text-slate-500 flex items-center justify-between px-1">
                    <span>Fórmula: <strong class="font-mono">${currency}${window.formatMoney(cost)} ÷ ${window.formatNumber(yieldU, 0)}</strong></span>
                    <span class="text-cyan-700 font-bold">Automático ✓</span>
                </div>
            `;
        } else if (cat === 'maquinaria') {
            const cost = parseFloat(item.purchaseCost) || 0;
            const salvage = parseFloat(item.salvageValue) || 0;
            const lifespan = Math.max(1, parseFloat(item.lifespanUses) || 15000);
            const used = Math.max(0, parseFloat(item.usedCount) || 0);
            const remaining = Math.max(0, lifespan - used);
            const pctUsed = Math.min(100, (used / lifespan) * 100);
            const alcanciaSaved = used * unitCost;
            const targetSave = Math.max(0, cost - salvage);

            bodyDetailsHTML = `
                <div class="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
                    <div>
                        <span class="text-[10px] text-slate-400 font-bold uppercase block">Valor Máquina</span>
                        <span class="font-mono font-bold text-slate-800">${currency} ${window.formatMoney(cost)}</span>
                    </div>
                    <div>
                        <span class="text-[10px] text-slate-400 font-bold uppercase block">Vida Útil Total</span>
                        <span class="font-mono font-bold text-amber-700">${window.formatNumber(lifespan, 0)} ${unitLabel}s</span>
                    </div>
                </div>

                <!-- Barra de Desgaste y Usos -->
                <div class="space-y-1.5 pt-1">
                    <div class="flex items-center justify-between text-[11px]">
                        <span class="font-bold text-slate-700">Uso Acumulado: <strong class="font-mono text-amber-700">${window.formatNumber(used, 0)}</strong> / ${window.formatNumber(lifespan, 0)}</span>
                        <span class="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">${window.formatNumber(pctUsed, 1)}%</span>
                    </div>
                    <div class="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div class="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all" style="width: ${pctUsed}%"></div>
                    </div>
                    <div class="flex items-center justify-between text-[10px] text-slate-400">
                        <span>Quedan: <strong class="text-slate-600">${window.formatNumber(remaining, 0)} ${unitLabel}s</strong></span>
                        <span>${item.autoTrackOnExtraCost !== false ? '⚡ Auto-suma en Aprobadas' : 'Manual'}</span>
                    </div>
                </div>

                <!-- Alcancía / Fondo de Reposición -->
                <div class="p-2.5 bg-emerald-50/90 border border-emerald-200 rounded-xl flex items-center justify-between">
                    <div>
                        <span class="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 block">🐷 Alcancía para Nueva Máquina</span>
                        <span class="text-[11px] text-emerald-700">Debes tener ahorrado:</span>
                    </div>
                    <div class="text-right">
                        <span class="font-mono font-black text-sm text-emerald-800 block">${currency} ${window.formatMoney(alcanciaSaved)}</span>
                        <span class="text-[10px] font-mono text-emerald-600">de ${currency} ${window.formatMoney(targetSave)}</span>
                    </div>
                </div>

                <!-- Controles Rápidos de Uso -->
                <div class="flex items-center justify-between gap-1 pt-1">
                    <span class="text-[10px] font-bold text-slate-500">Sumar uso manual:</span>
                    <div class="flex items-center gap-1">
                        <button type="button" onclick="costos.quickAdjustMachine('${item.id}', 1)" class="px-2 py-1 text-[10px] font-black bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg transition-colors cursor-pointer">+1</button>
                        <button type="button" onclick="costos.quickAdjustMachine('${item.id}', 10)" class="px-2 py-1 text-[10px] font-black bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg transition-colors cursor-pointer">+10</button>
                        <button type="button" onclick="costos.quickAdjustMachine('${item.id}', 50)" class="px-2 py-1 text-[10px] font-black bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg transition-colors cursor-pointer">+50</button>
                        <button type="button" onclick="costos.promptExactMachineUses('${item.id}')" class="px-2 py-1 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer" title="Fijar cantidad exacta de usos">Fijar</button>
                    </div>
                </div>
            `;
        } else if (cat === 'electricidad') {
            const watts = parseFloat(item.watts) || 0;
            const mins = parseFloat(item.minutesPerUse) || 0;
            const whPerMin = watts / 60;
            const whPerUse = watts * (mins / 60);
            const kwhPerUse = whPerUse / 1000;
            const kwhRate = (parseFloat(item.customKwhPrice) > 0) ? parseFloat(item.customKwhPrice) : (parseFloat(settings.kwhPrice) || 220);

            bodyDetailsHTML = `
                <div class="grid grid-cols-3 gap-1.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-center">
                    <div>
                        <span class="text-[10px] text-slate-400 font-bold uppercase block">Potencia</span>
                        <span class="font-mono font-bold text-slate-800">${window.formatNumber(watts, 0)} W</span>
                    </div>
                    <div>
                        <span class="text-[10px] text-slate-400 font-bold uppercase block">Tiempo</span>
                        <span class="font-mono font-bold text-amber-700">${window.formatNumber(mins, 2)} min</span>
                    </div>
                    <div>
                        <span class="text-[10px] text-slate-400 font-bold uppercase block">Consumo</span>
                        <span class="font-mono font-bold text-indigo-700">${window.formatNumber(whPerUse, 1)} Wh</span>
                    </div>
                </div>
                <div class="text-[11px] text-slate-500 flex items-center justify-between px-1">
                    <span>Ritmo: <strong class="font-mono">${window.formatNumber(whPerMin, 1)} Wh/min</strong> (${window.formatNumber(kwhPerUse, 4)} kWh)</span>
                    <span>Tarifa: <strong class="font-mono">${currency}${window.formatMoney(kwhRate)}/kWh</strong></span>
                </div>
            `;
        } else {
            const mode = item.calcMode || 'fijo';
            if (mode === 'tiempo') {
                const rate = (parseFloat(item.hourlyRate) > 0) ? parseFloat(item.hourlyRate) : (parseFloat(settings.operatorHourlyRate) || 4500);
                const mins = parseFloat(item.minutesPerUse) || 0;
                bodyDetailsHTML = `
                    <div class="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
                        <div>
                            <span class="text-[10px] text-slate-400 font-bold uppercase block">Valor Hora</span>
                            <span class="font-mono font-bold text-slate-800">${currency} ${window.formatMoney(rate)}/hr</span>
                        </div>
                        <div>
                            <span class="text-[10px] text-slate-400 font-bold uppercase block">Tiempo Dedicado</span>
                            <span class="font-mono font-bold text-purple-700">${window.formatNumber(mins, 1)} min / ${unitLabel}</span>
                        </div>
                    </div>
                `;
            } else if (mode === 'lote') {
                const cost = parseFloat(item.purchaseCost) || 0;
                const yieldU = Math.max(1, parseFloat(item.yieldUnits) || 1);
                bodyDetailsHTML = `
                    <div class="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
                        <div>
                            <span class="text-[10px] text-slate-400 font-bold uppercase block">Gasto Lote / Viaje</span>
                            <span class="font-mono font-bold text-slate-800">${currency} ${window.formatMoney(cost)}</span>
                        </div>
                        <div>
                            <span class="text-[10px] text-slate-400 font-bold uppercase block">Unidades del Lote</span>
                            <span class="font-mono font-bold text-purple-700">${window.formatNumber(yieldU, 0)} ${unitLabel}s</span>
                        </div>
                    </div>
                `;
            } else {
                bodyDetailsHTML = `
                    <div class="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs flex items-center justify-between">
                        <span class="text-[10px] text-slate-400 font-bold uppercase">Modalidad Costo Fijo Directo</span>
                        <span class="font-mono font-bold text-purple-700">${currency} ${window.formatMoney(unitCost)} / ${unitLabel}</span>
                    </div>
                `;
            }
        }

        const isCheckedInComposer = this.composerSelection.has(item.id);

        return `
            <div class="bg-white p-4 rounded-2xl border ${isCheckedInComposer ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200/90'} shadow-sm flex flex-col justify-between space-y-3 transition-all">
                <div class="space-y-2.5">
                    <div class="flex items-start justify-between gap-2">
                        <span class="inline-block px-2.5 py-0.5 text-[10px] font-extrabold rounded-full border ${badgeMeta.cls}">
                            ${badgeMeta.label}
                        </span>
                        <div class="flex items-center gap-1 shrink-0">
                            <button type="button" onclick="costos.openCostModal('${item.id}')" class="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Editar">
                                <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                            </button>
                            <button type="button" onclick="costos.deleteCostItem('${item.id}')" class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Eliminar">
                                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                            </button>
                        </div>
                    </div>

                    <div>
                        <h4 class="font-bold text-sm text-slate-800 leading-snug">${this.escapeHTML(item.name)}</h4>
                        ${item.notes ? `<p class="text-[11px] text-slate-400 mt-0.5 line-clamp-2">${this.escapeHTML(item.notes)}</p>` : ''}
                    </div>

                    ${bodyDetailsHTML}
                </div>

                <!-- Pie de Tarjeta: Costo Unitario Resultante + Botón para Armador -->
                <div class="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div>
                        <span class="text-[10px] font-bold uppercase text-slate-400 block">Costo por ${unitLabel}</span>
                        <span class="font-mono font-black text-base text-indigo-700">${currency} ${window.formatMoney(unitCost)}</span>
                    </div>
                    <button type="button" onclick="costos.toggleComposerItem('${item.id}')" 
                        class="px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${isCheckedInComposer ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700'}">
                        <i data-lucide="${isCheckedInComposer ? 'check-square' : 'plus-circle'}" class="w-3.5 h-3.5"></i>
                        <span>${isCheckedInComposer ? 'En Calculadora' : 'Sumar al Cálculo'}</span>
                    </button>
                </div>
            </div>
        `;
    }

    quickAdjustMachine(machineId, delta) {
        const updated = window.db.adjustMachineUsage(machineId, delta, null);
        if (updated) {
            this.render();
            if (window.app) {
                const unitCost = window.db.calculateOperationalUnitCost(updated);
                const savedTotal = (updated.usedCount || 0) * unitCost;
                const currency = window.db.getProfile().currency || '$';
                window.app.showToast(`+${delta} usos en "${updated.name}". Alcancía acumulada: ${currency} ${window.formatMoney(savedTotal)}`, 'success');
            }
        }
    }

    promptExactMachineUses(machineId) {
        const item = window.db.getOperationalCostById(machineId);
        if (!item) return;
        const current = parseFloat(item.usedCount) || 0;
        const val = prompt(`Ingresa la cantidad total de usos/prendas actuales para "${item.name}":`, String(current));
        if (val === null) return;
        const num = parseFloat(val);
        if (isNaN(num) || num < 0) {
            if (window.app) window.app.showToast('Por favor ingresa un número válido mayor o igual a 0.', 'warning');
            return;
        }
        window.db.adjustMachineUsage(machineId, 0, num);
        this.render();
        if (window.app) window.app.showToast(`Contador de "${item.name}" actualizado a ${window.formatNumber(num, 0)} usos.`, 'success');
    }

    // ==========================================
    // SIMULADOR / ARMADOR DE COSTO ADICIONAL POR PRENDA
    // ==========================================
    toggleComposerItem(costId) {
        if (this.composerSelection.has(costId)) {
            this.composerSelection.delete(costId);
        } else {
            this.composerSelection.set(costId, 1);
        }
        this.render();
    }

    updateComposerMultiplier(costId, val) {
        const mult = Math.max(0.01, parseFloat(val) || 1);
        this.composerSelection.set(costId, mult);
        this.renderComposer();
    }

    selectAllInComposer(selectAll = true) {
        const costs = window.db.getOperationalCosts();
        if (selectAll) {
            costs.forEach(c => {
                if (!this.composerSelection.has(c.id)) {
                    this.composerSelection.set(c.id, 1);
                }
            });
        } else {
            this.composerSelection.clear();
        }
        this.render();
    }

    renderComposer() {
        const listEl = document.getElementById('costos-composer-selected-list');
        const totalEl = document.getElementById('costos-composer-total-display');
        const labelInput = document.getElementById('costos-composer-label-input');
        if (!listEl || !totalEl) return;

        const costs = window.db.getOperationalCosts();
        const settings = window.db.getCostSettings();
        const currency = window.db.getProfile().currency || '$';

        let grandTotal = 0;
        const selectedNames = [];
        const rowsHtml = [];

        this.composerSelection.forEach((mult, costId) => {
            const item = costs.find(c => c.id === costId);
            if (!item) return;
            const unitCost = window.db.calculateOperationalUnitCost(item, settings);
            const sub = Number((unitCost * mult).toFixed(2));
            grandTotal += sub;
            selectedNames.push(mult !== 1 ? `${item.name} (x${mult})` : item.name);

            rowsHtml.push(`
                <div class="flex items-center justify-between gap-2 p-2 bg-white rounded-xl border border-indigo-100 text-xs">
                    <div class="min-w-0 flex-1">
                        <span class="font-bold text-slate-800 block truncate">${this.escapeHTML(item.name)}</span>
                        <span class="text-[10px] text-slate-400 font-mono">${currency} ${window.formatMoney(unitCost)} / ${this.escapeHTML(item.unitLabel || 'u')}</span>
                    </div>
                    <div class="flex items-center gap-1.5 shrink-0">
                        <span class="text-[10px] text-slate-400 font-bold">Cant:</span>
                        <input type="number" step="any" min="0.1" value="${mult}" 
                            oninput="costos.updateComposerMultiplier('${item.id}', this.value)"
                            class="w-14 px-1.5 py-1 text-xs font-bold text-center bg-slate-50 border border-slate-200 rounded-lg outline-none" />
                        <span class="font-mono font-bold text-indigo-700 w-20 text-right">${currency} ${window.formatMoney(sub)}</span>
                        <button type="button" onclick="costos.toggleComposerItem('${item.id}')" class="p-1 text-slate-400 hover:text-rose-600 rounded">
                            <i data-lucide="x" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                </div>
            `);
        });

        if (rowsHtml.length === 0) {
            listEl.innerHTML = `<div class="p-4 text-center text-xs text-slate-400 italic bg-white/60 rounded-xl border border-dashed border-indigo-200">Selecciona cualquier tinta, papel, máquina o electricidad de las tarjetas de abajo haciendo clic en "Sumar al Cálculo" para armar el costo adicional por prenda.</div>`;
        } else {
            listEl.innerHTML = rowsHtml.join('');
        }

        totalEl.textContent = `${currency} ${window.formatMoney(grandTotal)}`;
        if (labelInput && !labelInput.dataset.userEdited) {
            labelInput.value = selectedNames.length > 0 ? (`Sublimación / Producción (${selectedNames.length} costos)`) : 'Estampado / Sublimación';
        }
        if (window.lucide) window.lucide.createIcons();
    }

    populateApplyProductSelect() {
        const sel = document.getElementById('costos-apply-product-select');
        if (!sel) return;
        const currentVal = sel.value;
        const products = window.db.getProducts();
        const currency = window.db.getProfile().currency || '$';

        sel.innerHTML = `<option value="">-- Selecciona un producto del catálogo para cargarle este costo adicional --</option>` +
            products.map(p => {
                const extra = parseFloat(p.extraCost) || 0;
                const extraTxt = extra > 0 ? ` [Adic. actual: +${currency}${window.formatMoney(extra)}]` : '';
                return `<option value="${p.id}">${this.escapeHTML(p.name)} (${this.escapeHTML(p.sku || '')})${extraTxt}</option>`;
            }).join('');

        if (currentVal && products.some(p => p.id === currentVal)) {
            sel.value = currentVal;
        }
    }

    applyComposerToSelectedProduct() {
        const sel = document.getElementById('costos-apply-product-select');
        const productId = sel?.value;
        if (!productId) {
            if (window.app) window.app.showToast('Selecciona primero un producto del catálogo en la lista desplegable.', 'warning');
            return;
        }

        const prod = window.db.getProductById(productId);
        if (!prod) return;

        const costs = window.db.getOperationalCosts();
        const settings = window.db.getCostSettings();
        let totalExtra = 0;
        const extraCostItems = [];

        this.composerSelection.forEach((mult, costId) => {
            const item = costs.find(c => c.id === costId);
            if (!item) return;
            const unitCost = window.db.calculateOperationalUnitCost(item, settings);
            totalExtra += unitCost * mult;
            extraCostItems.push({
                costId: item.id,
                name: item.name,
                category: item.category,
                multiplier: mult,
                unitCost: unitCost
            });
        });

        totalExtra = Number(totalExtra.toFixed(2));
        const labelInput = document.getElementById('costos-composer-label-input');
        const label = (labelInput?.value || '').trim() || 'Costo Operativo / Sublimación';

        prod.extraCost = totalExtra;
        prod.extraCostLabel = label;
        prod.extraCostItems = extraCostItems;

        // Recalcular precio de venta 1u respetando el margen del producto
        const baseCost = parseFloat(prod.costPrice) || 0;
        const margin = parseFloat(prod.defaultMargin) || 50;
        const totalUnitCost = baseCost + totalExtra;
        prod.salePrice = Number((totalUnitCost * (1 + margin / 100)).toFixed(2));

        // Actualizar también escalas por volumen si existen
        if (Array.isArray(prod.costTiers) && prod.costTiers.length > 0) {
            prod.costTiers = prod.costTiers.map(t => {
                const tCost = parseFloat(t.cost) || baseCost;
                const tMargin = (t.margin !== undefined && !isNaN(parseFloat(t.margin))) ? parseFloat(t.margin) : margin;
                return {
                    ...t,
                    salePrice: Number(((tCost + totalExtra) * (1 + tMargin / 100)).toFixed(2))
                };
            });
        }

        window.db.saveProduct(prod);
        this.populateApplyProductSelect();
        if (window.app) {
            window.app.renderProducts();
            const currency = window.db.getProfile().currency || '$';
            window.app.showToast(`¡Listo! "${prod.name}" ahora tiene Costo Adicional de +${currency} ${window.formatMoney(totalExtra)} (${label}).`, 'success');
        }
    }

    // ==========================================
    // MODAL CRUD: CREAR / EDITAR ÍTEM DE COSTO O MAQUINARIA
    // ==========================================
    openCostModal(id = null, defaultCategory = null) {
        const titleEl = document.getElementById('cost-modal-title');
        const idInp = document.getElementById('cost-form-id');
        const catSel = document.getElementById('cost-form-category');
        const nameInp = document.getElementById('cost-form-name');
        const unitInp = document.getElementById('cost-form-unit-label');
        const purchaseInp = document.getElementById('cost-form-purchase-cost');
        const purchaseMaqInp = document.getElementById('cost-form-purchase-cost-maq');
        const yieldInp = document.getElementById('cost-form-yield-units');
        const salvageInp = document.getElementById('cost-form-salvage-value');
        const lifespanInp = document.getElementById('cost-form-lifespan-uses');
        const usedInp = document.getElementById('cost-form-used-count');
        const autoTrackCheck = document.getElementById('cost-form-auto-track');
        const wattsInp = document.getElementById('cost-form-watts');
        const minsInp = document.getElementById('cost-form-minutes');
        const opMinsInp = document.getElementById('cost-form-op-minutes');
        const customKwhInp = document.getElementById('cost-form-custom-kwh');
        const calcModeSel = document.getElementById('cost-form-calc-mode');
        const hourlyInp = document.getElementById('cost-form-hourly-rate');
        const fixedInp = document.getElementById('cost-form-fixed-cost');
        const notesInp = document.getElementById('cost-form-notes');

        const settings = window.db.getCostSettings();

        if (id) {
            const item = window.db.getOperationalCostById(id);
            if (!item) return;
            if (titleEl) titleEl.textContent = 'Editar Costo Operativo / Equipo';
            if (idInp) idInp.value = item.id;
            if (catSel) catSel.value = item.category || 'insumo';
            if (nameInp) nameInp.value = item.name || '';
            if (unitInp) unitInp.value = item.unitLabel || 'prenda';
            if (purchaseInp) purchaseInp.value = item.purchaseCost ?? 0;
            if (purchaseMaqInp) purchaseMaqInp.value = item.purchaseCost ?? 180000;
            if (yieldInp) yieldInp.value = item.yieldUnits ?? 100;
            if (salvageInp) salvageInp.value = item.salvageValue ?? 0;
            if (lifespanInp) lifespanInp.value = item.lifespanUses ?? 15000;
            if (usedInp) usedInp.value = item.usedCount ?? 0;
            if (autoTrackCheck) autoTrackCheck.checked = item.autoTrackOnExtraCost !== false;
            if (wattsInp) wattsInp.value = item.watts ?? 1800;
            if (minsInp) minsInp.value = item.minutesPerUse ?? 1;
            if (opMinsInp) opMinsInp.value = item.minutesPerUse ?? 4;
            if (customKwhInp) customKwhInp.value = item.customKwhPrice || '';
            if (calcModeSel) calcModeSel.value = item.calcMode || 'tiempo';
            if (hourlyInp) hourlyInp.value = item.hourlyRate || settings.operatorHourlyRate || 4500;
            if (fixedInp) fixedInp.value = item.fixedUnitCost ?? 0;
            if (notesInp) notesInp.value = item.notes || '';
        } else {
            if (titleEl) titleEl.textContent = 'Nuevo Insumo, Maquinaria o Costo Operativo';
            if (idInp) idInp.value = '';
            const initialCat = defaultCategory || (this.currentCategoryFilter !== 'all' ? this.currentCategoryFilter : 'insumo');
            if (catSel) catSel.value = initialCat;
            if (nameInp) nameInp.value = '';
            if (unitInp) unitInp.value = initialCat === 'insumo' ? 'impresión' : 'prenda';
            if (purchaseInp) purchaseInp.value = initialCat === 'maquinaria' ? '180000' : '15000';
            if (purchaseMaqInp) purchaseMaqInp.value = '180000';
            if (yieldInp) yieldInp.value = '500';
            if (salvageInp) salvageInp.value = '0';
            if (lifespanInp) lifespanInp.value = '15000';
            if (usedInp) usedInp.value = '0';
            if (autoTrackCheck) autoTrackCheck.checked = true;
            if (wattsInp) wattsInp.value = '1800';
            if (minsInp) minsInp.value = '1';
            if (opMinsInp) opMinsInp.value = '4';
            if (customKwhInp) customKwhInp.value = '';
            if (calcModeSel) calcModeSel.value = 'tiempo';
            if (hourlyInp) hourlyInp.value = settings.operatorHourlyRate || 4500;
            if (fixedInp) fixedInp.value = '300';
            if (notesInp) notesInp.value = '';
        }

        this.onCostModalCategoryChange();
        if (window.app) window.app.openModal('modal-cost-item');
    }

    onCostModalCategoryChange() {
        const cat = document.getElementById('cost-form-category')?.value || 'insumo';
        const secInsumo = document.getElementById('cost-modal-sec-insumo');
        const secMaq = document.getElementById('cost-modal-sec-maquinaria');
        const secElec = document.getElementById('cost-modal-sec-electricidad');
        const secOp = document.getElementById('cost-modal-sec-operativo');

        if (secInsumo) secInsumo.classList.toggle('hidden', !(cat === 'insumo' || (cat === 'operativo' && document.getElementById('cost-form-calc-mode')?.value === 'lote')));
        if (secMaq) secMaq.classList.toggle('hidden', cat !== 'maquinaria');
        if (secElec) secElec.classList.toggle('hidden', cat !== 'electricidad');
        if (secOp) secOp.classList.toggle('hidden', cat !== 'operativo');

        if (cat === 'operativo') {
            const mode = document.getElementById('cost-form-calc-mode')?.value || 'tiempo';
            const opTiempo = document.getElementById('cost-modal-op-tiempo');
            const opFijo = document.getElementById('cost-modal-op-fijo');
            if (opTiempo) opTiempo.classList.toggle('hidden', mode !== 'tiempo');
            if (secInsumo) secInsumo.classList.toggle('hidden', mode !== 'lote');
            if (opFijo) opFijo.classList.toggle('hidden', mode !== 'fijo');
        }

        this.updateCostModalLivePreview();
    }

    _buildDraftItemFromModal() {
        const cat = document.getElementById('cost-form-category')?.value || 'insumo';
        const calcMode = document.getElementById('cost-form-calc-mode')?.value || 'tiempo';
        const minutesVal = cat === 'operativo'
            ? (parseFloat(document.getElementById('cost-form-op-minutes')?.value) || 0)
            : (parseFloat(document.getElementById('cost-form-minutes')?.value) || 0);

        const purchaseVal = cat === 'maquinaria'
            ? (parseFloat(document.getElementById('cost-form-purchase-cost-maq')?.value) || parseFloat(document.getElementById('cost-form-purchase-cost')?.value) || 0)
            : (parseFloat(document.getElementById('cost-form-purchase-cost')?.value) || 0);

        return {
            id: document.getElementById('cost-form-id')?.value || undefined,
            category: cat,
            name: (document.getElementById('cost-form-name')?.value || '').trim(),
            unitLabel: (document.getElementById('cost-form-unit-label')?.value || 'prenda').trim(),
            purchaseCost: purchaseVal,
            yieldUnits: Math.max(1, parseFloat(document.getElementById('cost-form-yield-units')?.value) || 1),
            salvageValue: Math.max(0, parseFloat(document.getElementById('cost-form-salvage-value')?.value) || 0),
            lifespanUses: Math.max(1, parseFloat(document.getElementById('cost-form-lifespan-uses')?.value) || 15000),
            usedCount: Math.max(0, parseFloat(document.getElementById('cost-form-used-count')?.value) || 0),
            autoTrackOnExtraCost: document.getElementById('cost-form-auto-track')?.checked !== false,
            watts: Math.max(0, parseFloat(document.getElementById('cost-form-watts')?.value) || 0),
            minutesPerUse: minutesVal,
            customKwhPrice: parseFloat(document.getElementById('cost-form-custom-kwh')?.value) || 0,
            calcMode: calcMode,
            hourlyRate: parseFloat(document.getElementById('cost-form-hourly-rate')?.value) || 0,
            fixedUnitCost: parseFloat(document.getElementById('cost-form-fixed-cost')?.value) || 0,
            notes: (document.getElementById('cost-form-notes')?.value || '').trim()
        };
    }

    updateCostModalLivePreview() {
        const draft = this._buildDraftItemFromModal();
        const unitCost = window.db.calculateOperationalUnitCost(draft);
        const currency = window.db.getProfile().currency || '$';
        const previewEl = document.getElementById('cost-modal-live-unit-cost');
        const previewSub = document.getElementById('cost-modal-live-formula');

        if (previewEl) {
            previewEl.textContent = `${currency} ${window.formatMoney(unitCost)} / ${draft.unitLabel || 'unidad'}`;
        }
        if (previewSub) {
            if (draft.category === 'maquinaria') {
                const saved = (draft.usedCount || 0) * unitCost;
                previewSub.textContent = `Alcancía actual con ${window.formatNumber(draft.usedCount, 0)} usos: ${currency} ${window.formatMoney(saved)}`;
            } else if (draft.category === 'electricidad') {
                const wh = draft.watts * (draft.minutesPerUse / 60);
                previewSub.textContent = `Consumo por ciclo: ${window.formatNumber(wh, 1)} Wh (${window.formatNumber(wh / 1000, 4)} kWh)`;
            } else {
                previewSub.textContent = `Se sumará automáticamente cuando vincules este costo a un producto.`;
            }
        }
    }

    submitCostModal() {
        const draft = this._buildDraftItemFromModal();
        if (!draft.name) {
            if (window.app) window.app.showToast('Escribe un nombre descriptivo (ej. Tinta Sublimación, Plancha 38x38...).', 'warning');
            return;
        }

        const saved = window.db.saveOperationalCostItem(draft);
        if (!this.composerSelection.has(saved.id)) {
            this.composerSelection.set(saved.id, 1);
        }
        this.render();
        if (window.app) {
            window.app.closeModal('modal-cost-item');
            window.app.showToast(`"${saved.name}" guardado en Costos & Maquinaria.`, 'success');
        }
    }

    deleteCostItem(id) {
        const item = window.db.getOperationalCostById(id);
        if (!item) return;
        if (confirm(`¿Deseas eliminar "${item.name}" del módulo de Costos & Maquinaria?`)) {
            window.db.deleteOperationalCostItem(id);
            this.composerSelection.delete(id);
            this.render();
            if (window.app) window.app.showToast('Costo eliminado.', 'info');
        }
    }

    // ==========================================
    // SELECTOR DE COSTOS DESDE EL MODAL DE PRODUCTO (#modal-pick-extra-costs)
    // ==========================================
    openPickerForProductModal() {
        const costs = window.db.getOperationalCosts();
        this.modalPickerSelection.clear();

        // Si el producto que se está editando ya tenía extraCostItems, pre-cargarlos
        const currentExtraItems = window.app?._currentProductExtraCostItems;
        if (Array.isArray(currentExtraItems) && currentExtraItems.length > 0) {
            currentExtraItems.forEach(ref => {
                if (ref && ref.costId) {
                    this.modalPickerSelection.set(ref.costId, parseFloat(ref.multiplier) || 1);
                }
            });
        } else {
            // Si no tenía, pre-cargar la selección actual del simulador
            this.composerSelection.forEach((mult, costId) => {
                if (costs.some(c => c.id === costId)) {
                    this.modalPickerSelection.set(costId, mult);
                }
            });
        }

        this.renderModalPickerList();
        if (window.app) window.app.openModal('modal-pick-extra-costs');
    }

    toggleModalPickerItem(costId) {
        if (this.modalPickerSelection.has(costId)) {
            this.modalPickerSelection.delete(costId);
        } else {
            this.modalPickerSelection.set(costId, 1);
        }
        this.renderModalPickerList();
    }

    updateModalPickerMultiplier(costId, val) {
        const mult = Math.max(0.01, parseFloat(val) || 1);
        this.modalPickerSelection.set(costId, mult);
        this.renderModalPickerList();
    }

    renderModalPickerList() {
        const container = document.getElementById('picker-extra-costs-list');
        const totalEl = document.getElementById('picker-extra-costs-total');
        if (!container || !totalEl) return;

        const costs = window.db.getOperationalCosts();
        const settings = window.db.getCostSettings();
        const currency = window.db.getProfile().currency || '$';

        let total = 0;

        container.innerHTML = costs.map(item => {
            const checked = this.modalPickerSelection.has(item.id);
            const mult = checked ? (this.modalPickerSelection.get(item.id) || 1) : 1;
            const unitCost = window.db.calculateOperationalUnitCost(item, settings);
            const sub = unitCost * mult;
            if (checked) total += sub;

            const catIcons = {
                'insumo': '💧',
                'maquinaria': '⚙️',
                'electricidad': '⚡',
                'operativo': '⏱️'
            };

            return `
                <div class="p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 ${checked ? 'bg-amber-50/80 border-amber-400' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}">
                    <label class="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                        <input type="checkbox" ${checked ? 'checked' : ''} onchange="costos.toggleModalPickerItem('${item.id}')" class="w-4 h-4 rounded accent-amber-600 cursor-pointer shrink-0" />
                        <div class="min-w-0 flex-1">
                            <span class="font-bold text-xs text-slate-800 block truncate">${catIcons[item.category] || '•'} ${this.escapeHTML(item.name)}</span>
                            <span class="text-[10px] text-slate-500 font-mono">Unitario: ${currency} ${window.formatMoney(unitCost)} / ${this.escapeHTML(item.unitLabel || 'u')}</span>
                        </div>
                    </label>
                    <div class="flex items-center gap-1.5 shrink-0">
                        <span class="text-[10px] font-bold text-slate-400">x</span>
                        <input type="number" step="any" min="0.1" value="${mult}" ${!checked ? 'disabled' : ''}
                            oninput="costos.updateModalPickerMultiplier('${item.id}', this.value)"
                            class="w-14 px-1.5 py-1 text-xs font-bold text-center bg-white border border-slate-200 rounded-lg outline-none ${!checked ? 'opacity-40' : ''}" />
                        <span class="font-mono font-black text-xs ${checked ? 'text-amber-800' : 'text-slate-400'} w-20 text-right">
                            ${currency} ${window.formatMoney(checked ? sub : unitCost)}
                        </span>
                    </div>
                </div>
            `;
        }).join('');

        totalEl.textContent = `${currency} ${window.formatMoney(total)}`;
    }

    confirmPickerToProductModal() {
        const costs = window.db.getOperationalCosts();
        const settings = window.db.getCostSettings();
        let total = 0;
        const names = [];
        const extraCostItems = [];

        this.modalPickerSelection.forEach((mult, costId) => {
            const item = costs.find(c => c.id === costId);
            if (!item) return;
            const unitCost = window.db.calculateOperationalUnitCost(item, settings);
            total += unitCost * mult;
            names.push(mult !== 1 ? `${item.name} (x${mult})` : item.name);
            extraCostItems.push({
                costId: item.id,
                name: item.name,
                category: item.category,
                multiplier: mult,
                unitCost: unitCost
            });
        });

        total = Number(total.toFixed(2));
        const extraInput = document.getElementById('prod-form-extra-cost');
        const labelInput = document.getElementById('prod-form-extra-cost-label');

        if (extraInput) extraInput.value = total;
        if (labelInput && names.length > 0) {
            labelInput.value = names.length <= 2 ? names.join(' + ') : `${names[0]} + ${names.length - 1} costos más`;
        }

        if (window.app) {
            window.app._currentProductExtraCostItems = extraCostItems;
            window.app.onProductCostChange();
            window.app.closeModal('modal-pick-extra-costs');
            window.app.showToast('Costos operativos cargados en el producto ✓', 'success');
        }
    }
}

window.costos = new CostosManager();
