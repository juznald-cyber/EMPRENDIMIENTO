/**
 * Gestor de Formatos y Precios de Estampados (js/estampados.js)
 * Módulo independiente para registrar y administrar formatos de estampados,
 * técnicas (DTF Textil, Sublimación, Vinilo, etc.), medidas, costos y precios
 * para su asociación a prendas y productos textiles.
 */

class EstampadosManager {
    constructor() {
        this.currentTechnique = 'todas';
        this.searchQuery = '';
        this.tierCounter = 0;
    }

    init() {
        this.render();
    }

    escapeHTML(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    render() {
        this.renderFilterPills();
        this.renderCardsGrid();
        this.updateBadge();
    }

    updateBadge() {
        const list = window.db.getEstampados();
        const badge = document.getElementById('estampados-count-badge');
        if (badge) {
            badge.innerText = list.length;
            badge.classList.toggle('hidden', list.length === 0);
        }
        const totalSpan = document.getElementById('estampados-total-count');
        if (totalSpan) {
            totalSpan.innerText = `${list.length} formato${list.length === 1 ? '' : 's'}`;
        }
    }

    renderFilterPills() {
        const container = document.getElementById('estampados-technique-filters');
        if (!container) return;

        const list = window.db.getEstampados();
        const techCounts = {};
        list.forEach(item => {
            const tech = item.technique || 'Otros';
            techCounts[tech] = (techCounts[tech] || 0) + 1;
        });

        const techniques = Object.keys(techCounts).sort();

        let pillsHtml = `
            <button type="button" onclick="estampados.setTechniqueFilter('todas')" 
                class="px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer shrink-0 ${this.currentTechnique === 'todas' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">
                Todos (${list.length})
            </button>
        `;

        techniques.forEach(tech => {
            const count = techCounts[tech];
            const isActive = this.currentTechnique === tech;
            pillsHtml += `
                <button type="button" onclick="estampados.setTechniqueFilter('${this.escapeHTML(tech)}')" 
                    class="px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer shrink-0 ${isActive ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">
                    ${this.escapeHTML(tech)} (${count})
                </button>
            `;
        });

        container.innerHTML = pillsHtml;
    }

    setTechniqueFilter(tech) {
        this.currentTechnique = tech;
        this.renderFilterPills();
        this.renderCardsGrid();
    }

    onSearchInput(value) {
        this.searchQuery = (value || '').trim().toLowerCase();
        this.renderCardsGrid();
    }

    renderCardsGrid() {
        const grid = document.getElementById('estampados-cards-grid');
        if (!grid) return;

        const allItems = window.db.getEstampados();
        const profile = window.db.getProfile();
        const currency = profile.currency || '$';

        let filtered = allItems.filter(item => {
            if (this.currentTechnique !== 'todas' && item.technique !== this.currentTechnique) {
                return false;
            }
            if (this.searchQuery) {
                const matchName = (item.name || '').toLowerCase().includes(this.searchQuery);
                const matchTech = (item.technique || '').toLowerCase().includes(this.searchQuery);
                const matchLoc = (item.location || '').toLowerCase().includes(this.searchQuery);
                const matchDesc = (item.description || '').toLowerCase().includes(this.searchQuery);
                if (!matchName && !matchTech && !matchLoc && !matchDesc) return false;
            }
            return true;
        });

        if (filtered.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full py-12 text-center bg-white rounded-2xl border border-slate-200/80 p-8 space-y-3">
                    <div class="w-12 h-12 bg-pink-50 text-pink-500 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                        <i data-lucide="shirt" class="w-6 h-6"></i>
                    </div>
                    <h4 class="text-sm font-bold text-slate-700">No hay formatos de estampados para mostrar</h4>
                    <p class="text-xs text-slate-400 max-w-sm mx-auto">
                        ${this.searchQuery || this.currentTechnique !== 'todas' ? 'No se encontraron coincidencias para la búsqueda o técnica seleccionada.' : 'Comienza registrando tus formatos (A3, A4, Pecho, etc.) y precios para aplicarlos a prendas textiles.'}
                    </p>
                    <button type="button" onclick="estampados.openModal()" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition-all cursor-pointer">
                        <i data-lucide="plus" class="w-4 h-4"></i>
                        Nuevo Formato de Estampado
                    </button>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        grid.innerHTML = filtered.map(item => {
            const cost = parseFloat(item.costPrice) || 0;
            const margin = parseFloat(item.defaultMargin) || 0;
            const salePrice = (item.salePrice !== undefined && item.salePrice !== null && !isNaN(parseFloat(item.salePrice)))
                ? parseFloat(item.salePrice)
                : Number((cost * (1 + margin / 100)).toFixed(2));
            const width = item.widthCm ? `${item.widthCm} cm` : '';
            const height = item.heightCm ? `${item.heightCm} cm` : '';
            const dimensions = (width && height) ? `${width} x ${height}` : (width || height || 'Medida estándar');

            const hasTiers = Array.isArray(item.costTiers) && item.costTiers.length > 0;

            // Técnica con badge coloreado
            let techColor = 'bg-indigo-50 text-indigo-700 border-indigo-200';
            const techLower = (item.technique || '').toLowerCase();
            if (techLower.includes('dtf')) techColor = 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200';
            else if (techLower.includes('sublima')) techColor = 'bg-cyan-50 text-cyan-700 border-cyan-200';
            else if (techLower.includes('vinilo')) techColor = 'bg-amber-50 text-amber-700 border-amber-200';
            else if (techLower.includes('serigra')) techColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
            else if (techLower.includes('bordad')) techColor = 'bg-purple-50 text-purple-700 border-purple-200';

            return `
                <div class="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all p-4 flex flex-col justify-between space-y-3.5 group">
                    <div>
                        <!-- Encabezado Tarjeta -->
                        <div class="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                            <div class="space-y-1 min-w-0">
                                <div class="flex flex-wrap items-center gap-1.5">
                                    <span class="px-2 py-0.5 text-[10px] font-extrabold rounded-md border ${techColor}">
                                        ${this.escapeHTML(item.technique || 'Estampado')}
                                    </span>
                                    ${item.location ? `
                                        <span class="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                                            📍 ${this.escapeHTML(item.location)}
                                        </span>
                                    ` : ''}
                                </div>
                                <h3 class="font-extrabold text-sm text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug">
                                    ${this.escapeHTML(item.name)}
                                </h3>
                            </div>
                            <div class="flex items-center gap-1 shrink-0">
                                <button type="button" onclick="estampados.duplicateItem('${item.id}')" 
                                    class="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer" title="Duplicar formato">
                                    <i data-lucide="copy" class="w-4 h-4"></i>
                                </button>
                                <button type="button" onclick="estampados.openModal('${item.id}')" 
                                    class="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer" title="Editar formato">
                                    <i data-lucide="edit-3" class="w-4 h-4"></i>
                                </button>
                                <button type="button" onclick="estampados.deleteItem('${item.id}')" 
                                    class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer" title="Eliminar">
                                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                                </button>
                            </div>
                        </div>

                        <!-- Detalles Medidas y Descripción -->
                        <div class="pt-2 space-y-1.5 text-xs text-slate-600">
                            <div class="flex items-center justify-between text-[11px]">
                                <span class="text-slate-400 font-medium">Dimensiones / Área:</span>
                                <span class="font-bold font-mono text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60">
                                    📏 ${this.escapeHTML(dimensions)}
                                </span>
                            </div>
                            ${item.description ? `
                                <p class="text-[11px] text-slate-500 line-clamp-2 pt-1 italic">
                                    "${this.escapeHTML(item.description)}"
                                </p>
                            ` : ''}
                        </div>
                    </div>

                    <!-- Cuadro de Precios y Rentabilidad -->
                    <div class="space-y-2 pt-1 border-t border-slate-100">
                        <div class="grid grid-cols-3 gap-1.5 text-center p-2 rounded-xl bg-slate-50 border border-slate-200/70">
                            <div>
                                <span class="text-[9px] font-bold text-slate-400 uppercase block">Costo Base</span>
                                <span class="text-xs font-bold text-slate-700 font-mono">${currency} ${window.formatMoney(cost)}</span>
                            </div>
                            <div>
                                <span class="text-[9px] font-bold text-indigo-500 uppercase block">Margen</span>
                                <span class="text-xs font-bold text-indigo-700 font-mono">+${margin}%</span>
                            </div>
                            <div>
                                <span class="text-[9px] font-bold text-emerald-600 uppercase block">Precio Venta</span>
                                <span class="text-xs font-black text-emerald-700 font-mono">${currency} ${window.formatMoney(salePrice)}</span>
                            </div>
                        </div>

                        ${hasTiers ? `
                            <div class="text-[10px] text-indigo-700 bg-indigo-50/70 px-2.5 py-1 rounded-lg border border-indigo-200/60 flex items-center justify-between">
                                <span class="font-bold flex items-center gap-1">
                                    <i data-lucide="layers" class="w-3 h-3"></i> Escala x Cantidad:
                                </span>
                                <span>${item.costTiers.length} rangos configurados</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

        if (window.lucide) window.lucide.createIcons();
    }

    openModal(id = null) {
        this.tierCounter = 0;
        const tiersContainer = document.getElementById('estampado-tiers-container');
        if (tiersContainer) tiersContainer.innerHTML = '';

        const titleEl = document.getElementById('estampado-modal-title');
        const idInput = document.getElementById('estampado-form-id');
        const nameInput = document.getElementById('estampado-form-name');
        const techInput = document.getElementById('estampado-form-technique');
        const locInput = document.getElementById('estampado-form-location');
        const widthInput = document.getElementById('estampado-form-width');
        const heightInput = document.getElementById('estampado-form-height');
        const costInput = document.getElementById('estampado-form-cost');
        const marginInput = document.getElementById('estampado-form-margin');
        const salePriceInput = document.getElementById('estampado-form-sale-price');
        const descInput = document.getElementById('estampado-form-desc');

        if (id) {
            const item = window.db.getEstampadoById(id);
            if (!item) return;

            if (titleEl) titleEl.innerText = 'Editar Formato de Estampado';
            if (idInput) idInput.value = item.id;
            if (nameInput) nameInput.value = item.name || '';
            if (techInput) techInput.value = item.technique || 'DTF Textil';
            if (locInput) locInput.value = item.location || 'Pecho';
            if (widthInput) widthInput.value = item.widthCm || '';
            if (heightInput) heightInput.value = item.heightCm || '';
            if (costInput) costInput.value = item.costPrice || 0;
            if (marginInput) marginInput.value = item.defaultMargin !== undefined ? item.defaultMargin : 50;
            if (salePriceInput) salePriceInput.value = item.salePrice || 0;
            if (descInput) descInput.value = item.description || '';

            if (Array.isArray(item.costTiers) && item.costTiers.length > 0) {
                item.costTiers.forEach(t => {
                    this.addTierRow(t.min, t.max, t.cost, t.margin, t.salePrice);
                });
            }
        } else {
            if (titleEl) titleEl.innerText = 'Nuevo Formato de Estampado';
            if (idInput) idInput.value = '';
            if (nameInput) nameInput.value = '';
            if (techInput) techInput.value = 'DTF Textil';
            if (locInput) locInput.value = 'Pecho';
            if (widthInput) widthInput.value = '';
            if (heightInput) heightInput.value = '';
            if (costInput) costInput.value = '1.50';
            if (marginInput) marginInput.value = '50';
            if (salePriceInput) salePriceInput.value = '3.00';
            if (descInput) descInput.value = '';
        }

        window.app.openModal('modal-estampado-form');
        if (window.lucide) window.lucide.createIcons();
    }

    onCostChange() {
        const cost = parseFloat(String(document.getElementById('estampado-form-cost')?.value).replace(',', '.')) || 0;
        const margin = parseFloat(String(document.getElementById('estampado-form-margin')?.value).replace(',', '.')) || 0;
        const spEl = document.getElementById('estampado-form-sale-price');
        if (spEl) {
            spEl.value = Number((cost * (1 + margin / 100)).toFixed(2));
        }
    }

    onMarginChange() {
        this.onCostChange();
    }

    onSalePriceChange() {
        const cost = parseFloat(String(document.getElementById('estampado-form-cost')?.value).replace(',', '.')) || 0;
        const salePrice = parseFloat(String(document.getElementById('estampado-form-sale-price')?.value).replace(',', '.')) || 0;
        const marginEl = document.getElementById('estampado-form-margin');
        if (marginEl && cost > 0 && salePrice > 0) {
            marginEl.value = Number((((salePrice / cost) - 1) * 100).toFixed(2));
        }
    }

    addTierRow(minVal = null, maxVal = null, costVal = null, marginVal = null, spVal = null) {
        const container = document.getElementById('estampado-tiers-container');
        if (!container) return;

        this.tierCounter++;
        const baseCost = parseFloat(String(document.getElementById('estampado-form-cost')?.value).replace(',', '.')) || 0;
        const baseMargin = parseFloat(String(document.getElementById('estampado-form-margin')?.value).replace(',', '.')) || 50;

        let min = minVal;
        let max = maxVal;
        let cost = costVal !== null ? costVal : baseCost;
        let margin = marginVal !== null ? marginVal : baseMargin;
        let salePrice = spVal !== null ? spVal : Number((cost * (1 + margin / 100)).toFixed(2));

        if (min === null) {
            const rows = container.querySelectorAll('.estampado-tier-row');
            if (rows.length === 0) {
                min = 12;
                max = 49;
            } else {
                const lastMax = parseInt(rows[rows.length - 1].querySelector('.tier-max')?.value, 10);
                min = !isNaN(lastMax) && lastMax < 999999 ? lastMax + 1 : 50;
                max = min + 49;
            }
        }

        const row = document.createElement('div');
        row.className = 'estampado-tier-row grid grid-cols-12 gap-2 items-center p-2 bg-white rounded-xl border border-slate-200 text-xs';
        row.innerHTML = `
            <div class="col-span-3 flex items-center gap-1">
                <input type="number" min="1" value="${min}" placeholder="Min" class="tier-min w-1/2 p-1.5 text-center font-bold bg-slate-50 border border-slate-200 rounded-lg outline-none" />
                <span class="text-slate-400">-</span>
                <input type="number" min="1" value="${max >= 999999 ? '' : max}" placeholder="+" class="tier-max w-1/2 p-1.5 text-center font-bold bg-slate-50 border border-slate-200 rounded-lg outline-none" />
            </div>
            <div class="col-span-3">
                <input type="number" step="any" min="0" value="${cost}" placeholder="Costo" oninput="estampados.onTierCostOrMarginChange(this)" class="tier-cost w-full p-1.5 text-center font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg outline-none" />
            </div>
            <div class="col-span-2">
                <input type="number" step="any" value="${margin}" placeholder="%" oninput="estampados.onTierCostOrMarginChange(this)" class="tier-margin w-full p-1.5 text-center font-bold text-indigo-700 bg-indigo-50/50 border border-indigo-200 rounded-lg outline-none" />
            </div>
            <div class="col-span-3">
                <input type="number" step="any" min="0" value="${salePrice}" placeholder="Venta" oninput="estampados.onTierSalePriceChange(this)" class="tier-sale-price w-full p-1.5 text-center font-black text-emerald-700 bg-emerald-50/50 border border-emerald-200 rounded-lg outline-none" />
            </div>
            <div class="col-span-1 text-center">
                <button type="button" onclick="this.closest('.estampado-tier-row').remove()" class="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors" title="Eliminar">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
            </div>
        `;

        container.appendChild(row);
        if (window.lucide) window.lucide.createIcons();
    }

    onTierCostOrMarginChange(input) {
        const row = input.closest('.estampado-tier-row');
        if (!row) return;
        const cost = parseFloat(String(row.querySelector('.tier-cost')?.value).replace(',', '.')) || 0;
        const margin = parseFloat(String(row.querySelector('.tier-margin')?.value).replace(',', '.')) || 0;
        const spInp = row.querySelector('.tier-sale-price');
        if (spInp) {
            spInp.value = Number((cost * (1 + margin / 100)).toFixed(2));
        }
    }

    onTierSalePriceChange(input) {
        const row = input.closest('.estampado-tier-row');
        if (!row) return;
        const cost = parseFloat(String(row.querySelector('.tier-cost')?.value).replace(',', '.')) || 0;
        const sp = parseFloat(String(row.querySelector('.tier-sale-price')?.value).replace(',', '.')) || 0;
        const marginInp = row.querySelector('.tier-margin');
        if (marginInp && cost > 0 && sp > 0) {
            marginInp.value = Number((((sp / cost) - 1) * 100).toFixed(2));
        }
    }

    saveModal() {
        const id = document.getElementById('estampado-form-id')?.value;
        const name = (document.getElementById('estampado-form-name')?.value || '').trim();
        const technique = (document.getElementById('estampado-form-technique')?.value || '').trim() || 'DTF Textil';
        const location = (document.getElementById('estampado-form-location')?.value || '').trim() || 'Pecho';
        const widthCm = parseFloat(document.getElementById('estampado-form-width')?.value) || 0;
        const heightCm = parseFloat(document.getElementById('estampado-form-height')?.value) || 0;
        const costPrice = parseFloat(String(document.getElementById('estampado-form-cost')?.value).replace(',', '.')) || 0;
        const defaultMargin = parseFloat(String(document.getElementById('estampado-form-margin')?.value).replace(',', '.')) || 0;
        const salePrice = parseFloat(String(document.getElementById('estampado-form-sale-price')?.value).replace(',', '.')) || 0;
        const description = (document.getElementById('estampado-form-desc')?.value || '').trim();

        if (!name) {
            window.app.showToast('Por favor escribe un nombre o formato para el estampado.', 'warning');
            return;
        }

        // Extraer rangos de precios por volumen si existen
        const tierRows = document.querySelectorAll('#estampado-tiers-container .estampado-tier-row');
        const costTiers = [];
        tierRows.forEach(row => {
            const min = parseInt(row.querySelector('.tier-min')?.value, 10);
            const maxVal = row.querySelector('.tier-max')?.value;
            const max = maxVal === '' || isNaN(parseInt(maxVal, 10)) ? 999999 : parseInt(maxVal, 10);
            const tCost = parseFloat(String(row.querySelector('.tier-cost')?.value).replace(',', '.')) || 0;
            const tMargin = parseFloat(String(row.querySelector('.tier-margin')?.value).replace(',', '.')) || 0;
            const tSalePrice = parseFloat(String(row.querySelector('.tier-sale-price')?.value).replace(',', '.')) || 0;

            if (!isNaN(min) && min > 0) {
                costTiers.push({ min, max, cost: tCost, margin: tMargin, salePrice: tSalePrice });
            }
        });

        const item = {
            id: id || null,
            name,
            technique,
            location,
            widthCm,
            heightCm,
            costPrice,
            defaultMargin,
            salePrice,
            costTiers,
            description,
            updatedAt: Date.now()
        };

        const saved = window.db.saveEstampado(item);
        if (saved) {
            window.app.closeModal('modal-estampado-form');
            this.render();
            window.app.showToast(`Formato de estampado "${saved.name}" guardado exitosamente.`, 'success');

            // Si el modal de producto está abierto en categoría Textil, refrescar la lista de estampados
            const prodModal = document.getElementById('modal-product-form');
            if (prodModal && prodModal.classList.contains('active') && typeof window.app.renderTextilEstampadosList === 'function') {
                window.app.renderTextilEstampadosList();
            }
        }
    }

    duplicateItem(id) {
        const item = window.db.getEstampadoById(id);
        if (!item) return;

        this.openModal();
        document.getElementById('estampado-form-id').value = '';
        document.getElementById('estampado-form-name').value = `${item.name} (Copia)`;
        document.getElementById('estampado-form-technique').value = item.technique || 'DTF Textil';
        document.getElementById('estampado-form-location').value = item.location || 'Pecho';
        document.getElementById('estampado-form-width').value = item.widthCm || '';
        document.getElementById('estampado-form-height').value = item.heightCm || '';
        document.getElementById('estampado-form-cost').value = item.costPrice || 0;
        document.getElementById('estampado-form-margin').value = item.defaultMargin || 50;
        document.getElementById('estampado-form-sale-price').value = item.salePrice || 0;
        document.getElementById('estampado-form-desc').value = item.description || '';

        const tiersContainer = document.getElementById('estampado-tiers-container');
        if (tiersContainer) tiersContainer.innerHTML = '';
        if (Array.isArray(item.costTiers)) {
            item.costTiers.forEach(t => {
                this.addTierRow(t.min, t.max, t.cost, t.margin, t.salePrice);
            });
        }

        window.app.showToast('Copia generada. Puedes ajustar los datos y guardarla.', 'info');
    }

    deleteItem(id) {
        const item = window.db.getEstampadoById(id);
        if (!item) return;

        if (confirm(`¿Estás seguro de eliminar el formato de estampado "${item.name}"?`)) {
            window.db.deleteEstampado(id);
            this.render();
            window.app.showToast(`Estampado "${item.name}" eliminado.`, 'info');

            // Si el modal de producto está abierto, refrescarlo
            if (typeof window.app.renderTextilEstampadosList === 'function') {
                window.app.renderTextilEstampadosList();
            }
        }
    }
}

// Instancia global
window.estampados = new EstampadosManager();
