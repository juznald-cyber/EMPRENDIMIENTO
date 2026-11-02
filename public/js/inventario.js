// js/inventario.js - Módulo de Control de Stock, Hojas de Salida y Kardex
class InventarioManager {
    constructor() {
        this.activeSubTab = 'inventory'; // 'inventory' | 'dispatches' | 'movements'
        this.dispatchDraftItems = [];
        this.searchQuery = '';
        this.categoryFilter = 'ALL';
        this.stockFilter = 'ALL'; // 'ALL' | 'IN_STOCK' | 'LOW' | 'OUT'
        this.kardexTypeFilter = 'ALL';
        this.kardexSearch = '';
    }

    init() {
        // Event listeners de filtros de inventario
        const searchInput = document.getElementById('stock-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.toLowerCase().trim();
                this.renderInventoryTable();
            });
        }

        const catFilter = document.getElementById('stock-category-filter');
        if (catFilter) {
            catFilter.addEventListener('change', (e) => {
                this.categoryFilter = e.target.value;
                this.renderInventoryTable();
            });
        }

        const levelFilter = document.getElementById('stock-level-filter');
        if (levelFilter) {
            levelFilter.addEventListener('change', (e) => {
                this.stockFilter = e.target.value;
                this.renderInventoryTable();
            });
        }

        const kardexSearch = document.getElementById('kardex-search-input');
        if (kardexSearch) {
            kardexSearch.addEventListener('input', (e) => {
                this.kardexSearch = e.target.value.toLowerCase().trim();
                this.renderMovementsTable();
            });
        }

        const kardexType = document.getElementById('kardex-type-filter');
        if (kardexType) {
            kardexType.addEventListener('change', (e) => {
                this.kardexTypeFilter = e.target.value;
                this.renderMovementsTable();
            });
        }
    }

    render() {
        this.renderCategoryFilterOptions();
        this.renderKPIs();
        if (this.activeSubTab === 'inventory') {
            this.renderInventoryTable();
        } else if (this.activeSubTab === 'dispatches') {
            this.renderDispatchesTable();
        } else if (this.activeSubTab === 'movements') {
            this.renderMovementsTable();
        }
        this.updateLowStockBadge();
        if (window.lucide) window.lucide.createIcons();
    }

    switchSubTab(subTabId) {
        this.activeSubTab = subTabId;
        const subtabs = ['inventory', 'dispatches', 'movements'];
        subtabs.forEach(tab => {
            const btn = document.getElementById(`subtab-stock-btn-${tab}`);
            const view = document.getElementById(`subtab-stock-view-${tab}`);
            const isActive = tab === subTabId;

            if (btn) {
                btn.classList.toggle('bg-amber-600', isActive);
                btn.classList.toggle('text-white', isActive);
                btn.classList.toggle('text-slate-600', !isActive);
                btn.classList.toggle('hover:bg-slate-200', !isActive);
            }
            if (view) {
                view.classList.toggle('hidden', !isActive);
            }
        });

        if (subTabId === 'inventory') this.renderInventoryTable();
        if (subTabId === 'dispatches') this.renderDispatchesTable();
        if (subTabId === 'movements') this.renderMovementsTable();

        if (window.lucide) window.lucide.createIcons();
    }

    renderCategoryFilterOptions() {
        const catSelect = document.getElementById('stock-category-filter');
        if (!catSelect) return;
        const categories = window.db.getCategories();
        const currentVal = this.categoryFilter;

        let html = '<option value="ALL">Todas las Categorías</option>';
        categories.forEach(c => {
            html += `<option value="${c}">${c}</option>`;
        });
        catSelect.innerHTML = html;
        catSelect.value = currentVal;
    }

    renderKPIs() {
        const products = window.db.getProducts();
        const movements = window.db.getStockMovements();
        const dispatches = window.db.getStockDispatches();
        const profile = window.db.getProfile();
        const currency = profile.currency || '$';

        let totalUnits = 0;
        let totalValuation = 0;
        let lowStockCount = 0;
        let outOfStockCount = 0;

        products.forEach(p => {
            const stock = (p.stock !== undefined && p.stock !== null) ? Number(p.stock) : 0;
            const minStock = (p.minStock !== undefined && p.minStock !== null) ? Number(p.minStock) : 5;
            const cost = Number(p.costPrice) || 0;

            totalUnits += stock;
            totalValuation += (stock * cost);

            if (stock === 0) {
                outOfStockCount++;
                lowStockCount++;
            } else if (stock <= minStock) {
                lowStockCount++;
            }
        });

        const elTotalProds = document.getElementById('kpi-stock-total-products');
        const elTotalUnits = document.getElementById('kpi-stock-total-units');
        const elLowStock = document.getElementById('kpi-stock-low-count');
        const elValuation = document.getElementById('kpi-stock-valuation');
        const elDispatches = document.getElementById('kpi-stock-dispatches-count');

        if (elTotalProds) elTotalProds.innerText = products.length;
        if (elTotalUnits) elTotalUnits.innerText = window.formatNumber ? window.formatNumber(totalUnits, 0) : totalUnits;
        if (elLowStock) {
            elLowStock.innerText = lowStockCount;
            const badgeParent = elLowStock.closest('.kpi-card');
            if (badgeParent) {
                if (lowStockCount > 0) {
                    badgeParent.classList.add('border-amber-300', 'bg-amber-50/40');
                } else {
                    badgeParent.classList.remove('border-amber-300', 'bg-amber-50/40');
                }
            }
        }
        if (elValuation) elValuation.innerText = `${currency} ${window.formatMoney ? window.formatMoney(totalValuation) : totalValuation.toFixed(2)}`;
        if (elDispatches) elDispatches.innerText = dispatches.length;
    }

    updateLowStockBadge() {
        const products = window.db.getProducts();
        let lowCount = 0;
        products.forEach(p => {
            const stock = (p.stock !== undefined && p.stock !== null) ? Number(p.stock) : 0;
            const minStock = (p.minStock !== undefined && p.minStock !== null) ? Number(p.minStock) : 5;
            if (stock <= minStock) lowCount++;
        });

        const badge = document.getElementById('low-stock-alert-badge');
        if (badge) {
            if (lowCount > 0) {
                badge.innerText = lowCount;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
    }

    renderInventoryTable() {
        const tbody = document.getElementById('stock-table-body');
        if (!tbody) return;

        const products = window.db.getProducts();
        const profile = window.db.getProfile();
        const currency = profile.currency || '$';

        const filtered = products.filter(p => {
            // Filtro de búsqueda
            if (this.searchQuery) {
                const name = (p.name || '').toLowerCase();
                const sku = (p.sku || '').toLowerCase();
                const cat = (p.category || '').toLowerCase();
                if (!name.includes(this.searchQuery) && !sku.includes(this.searchQuery) && !cat.includes(this.searchQuery)) {
                    return false;
                }
            }
            // Filtro de categoría
            if (this.categoryFilter !== 'ALL' && p.category !== this.categoryFilter) {
                return false;
            }
            // Filtro de nivel de stock
            const stock = (p.stock !== undefined && p.stock !== null) ? Number(p.stock) : 0;
            const minStock = (p.minStock !== undefined && p.minStock !== null) ? Number(p.minStock) : 5;

            if (this.stockFilter === 'OUT' && stock !== 0) return false;
            if (this.stockFilter === 'LOW' && (stock > minStock || stock === 0)) return false;
            if (this.stockFilter === 'IN_STOCK' && stock === 0) return false;

            return true;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-12 text-slate-400">
                        <div class="flex flex-col items-center justify-center gap-2">
                            <i data-lucide="package-search" class="w-10 h-10 text-slate-300"></i>
                            <p class="text-sm font-semibold">No se encontraron productos con los filtros seleccionados.</p>
                            <p class="text-xs text-slate-400">Prueba cambiando la búsqueda o agregando stock inicial.</p>
                        </div>
                    </td>
                </tr>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        tbody.innerHTML = filtered.map(p => {
            const stock = (p.stock !== undefined && p.stock !== null) ? Number(p.stock) : 0;
            const minStock = (p.minStock !== undefined && p.minStock !== null) ? Number(p.minStock) : 5;
            const cost = Number(p.costPrice) || 0;
            const valuation = stock * cost;

            // Determinar estado de stock y color
            let statusBadge = '';
            if (stock === 0) {
                statusBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                    <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Agotado (0)
                </span>`;
            } else if (stock <= minStock) {
                statusBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> Stock Bajo (${stock})
                </span>`;
            } else {
                statusBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Óptimo (${stock})
                </span>`;
            }

            // Imagen / Thumbnail
            const imgUrl = (p.images && p.images.length > 0) ? p.images[0] : (p.imageData || '');
            const imgHtml = imgUrl 
                ? `<img src="${imgUrl}" class="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0 cursor-pointer shadow-sm" onclick="app.openLightbox('${p.id}', 0)" />`
                : `<div class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200 shrink-0">
                    <i data-lucide="package" class="w-5 h-5"></i>
                   </div>`;

            return `
                <tr class="hover:bg-slate-50/80 transition-colors border-b border-slate-100 text-xs">
                    <td class="py-3 px-3">
                        <div class="flex items-center gap-3">
                            ${imgHtml}
                            <div>
                                <span class="font-mono text-[10px] text-slate-400 font-bold block leading-none mb-1">${p.sku || 'S/N'}</span>
                                <span class="font-bold text-slate-800 leading-tight block">${p.name}</span>
                            </div>
                        </div>
                    </td>
                    <td class="py-3 px-3">
                        <span class="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200/60 font-medium">${p.category || 'General'}</span>
                    </td>
                    <td class="py-3 px-3 text-center">
                        ${statusBadge}
                    </td>
                    <td class="py-3 px-3 text-center font-bold text-slate-600">
                        ${minStock}
                    </td>
                    <td class="py-3 px-3 text-center text-slate-500 font-medium">
                        ${p.unit || 'Unidad'}
                    </td>
                    <td class="py-3 px-3 text-right font-mono text-slate-700 font-semibold">
                        ${currency} ${window.formatMoney ? window.formatMoney(cost) : cost.toFixed(2)}
                    </td>
                    <td class="py-3 px-3 text-right font-mono font-bold text-indigo-700">
                        ${currency} ${window.formatMoney ? window.formatMoney(valuation) : valuation.toFixed(2)}
                    </td>
                    <td class="py-3 px-3 text-right whitespace-nowrap">
                        <div class="flex items-center justify-end gap-1.5">
                            <button onclick="inventario.openQuickEntryModal('${p.id}')" title="Ingresar Stock (+) Compra / Carga" 
                                class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-200 transition-all shadow-sm">
                                <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                                <span>Entrada</span>
                            </button>
                            <button onclick="inventario.openQuickExitModal('${p.id}')" title="Rebaja Manual (-) Merma / Uso Taller" 
                                class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white border border-rose-200 transition-all shadow-sm">
                                <i data-lucide="minus" class="w-3.5 h-3.5"></i>
                                <span>Salida</span>
                            </button>
                            <button onclick="inventario.openAdjustStockModal('${p.id}')" title="Ajuste Físico de Inventario" 
                                class="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-slate-200 transition-colors">
                                <i data-lucide="sliders" class="w-4 h-4"></i>
                            </button>
                            <button onclick="inventario.openProductKardexModal('${p.id}')" title="Ver Historial / Kardex de este producto" 
                                class="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg border border-slate-200 transition-colors">
                                <i data-lucide="history" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        if (window.lucide) window.lucide.createIcons();
    }

    renderDispatchesTable() {
        const tbody = document.getElementById('stock-dispatches-table-body');
        if (!tbody) return;

        const dispatches = window.db.getStockDispatches();

        if (dispatches.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-12 text-slate-400">
                        <div class="flex flex-col items-center justify-center gap-2">
                            <i data-lucide="clipboard-list" class="w-10 h-10 text-slate-300"></i>
                            <p class="text-sm font-semibold">Aún no se han emitido Hojas de Salida.</p>
                            <p class="text-xs text-slate-400">Crea una nueva Hoja de Salida para registrar el retiro de materiales a producción o clientes.</p>
                            <button onclick="inventario.openNewDispatchModal()" class="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 text-white hover:bg-amber-700 shadow-sm transition-all">
                                <i data-lucide="plus-circle" class="w-4 h-4"></i>
                                Crear Primera Hoja de Salida
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        tbody.innerHTML = dispatches.map(d => {
            const itemsCount = (d.items || []).length;
            const itemsSummary = (d.items || []).slice(0, 2).map(it => `${it.quantity}x ${it.productName}`).join(', ');
            const moreSuffix = itemsCount > 2 ? ` (+${itemsCount - 2} más)` : '';

            return `
                <tr class="hover:bg-slate-50/80 transition-colors border-b border-slate-100 text-xs">
                    <td class="py-3 px-3">
                        <span class="font-mono font-black text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 inline-block">
                            ${d.dispatchNumber || 'HS-0000'}
                        </span>
                    </td>
                    <td class="py-3 px-3 text-slate-600 font-medium">
                        ${d.date || ''} ${d.time ? `<span class="text-[10px] text-slate-400">${d.time}</span>` : ''}
                    </td>
                    <td class="py-3 px-3">
                        <div class="font-bold text-slate-800">${d.destination || 'Producción / Taller'}</div>
                        ${d.reference ? `<div class="text-[11px] text-indigo-600 font-semibold">${d.reference}</div>` : ''}
                    </td>
                    <td class="py-3 px-3 text-slate-600">
                        ${d.recipient || 'Taller Interno'}
                    </td>
                    <td class="py-3 px-3 text-center">
                        <span class="font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-full text-xs">
                            ${d.totalUnits || 0} unid.
                        </span>
                    </td>
                    <td class="py-3 px-3 text-slate-500 text-[11px] max-w-xs truncate" title="${itemsSummary}${moreSuffix}">
                        ${itemsSummary}${moreSuffix}
                    </td>
                    <td class="py-3 px-3 text-right whitespace-nowrap">
                        <div class="flex items-center justify-end gap-2">
                            <button onclick="inventario.openDispatchViewModal('${d.id}')" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-indigo-700 hover:bg-indigo-50 border border-indigo-200 shadow-sm transition-all">
                                <i data-lucide="printer" class="w-3.5 h-3.5"></i>
                                <span>Ver / Imprimir Vale</span>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        if (window.lucide) window.lucide.createIcons();
    }

    renderMovementsTable() {
        const tbody = document.getElementById('stock-movements-table-body');
        if (!tbody) return;

        const movements = window.db.getStockMovements();

        const filtered = movements.filter(m => {
            if (this.kardexTypeFilter !== 'ALL' && m.type !== this.kardexTypeFilter) {
                return false;
            }
            if (this.kardexSearch) {
                const prod = (m.productName || '').toLowerCase();
                const sku = (m.productSku || '').toLowerCase();
                const reason = (m.reason || '').toLowerCase();
                const ref = (m.reference || '').toLowerCase();
                if (!prod.includes(this.kardexSearch) && !sku.includes(this.kardexSearch) && !reason.includes(this.kardexSearch) && !ref.includes(this.kardexSearch)) {
                    return false;
                }
            }
            return true;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-12 text-slate-400">
                        <div class="flex flex-col items-center justify-center gap-2">
                            <i data-lucide="history" class="w-10 h-10 text-slate-300"></i>
                            <p class="text-sm font-semibold">No hay movimientos registrados con los filtros aplicados.</p>
                        </div>
                    </td>
                </tr>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        tbody.innerHTML = filtered.map(m => {
            let typeBadge = '';
            let qtyDisplay = '';

            switch (m.type) {
                case 'entry':
                    typeBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <i data-lucide="arrow-down-left" class="w-3 h-3"></i> Entrada (+)
                    </span>`;
                    qtyDisplay = `<span class="text-emerald-700 font-bold font-mono">+${m.quantity}</span>`;
                    break;
                case 'manual_exit':
                    typeBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                        <i data-lucide="arrow-up-right" class="w-3 h-3"></i> Salida Manual (-)
                    </span>`;
                    qtyDisplay = `<span class="text-rose-700 font-bold font-mono">${m.quantity}</span>`;
                    break;
                case 'dispatch':
                    typeBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        <i data-lucide="clipboard-check" class="w-3 h-3"></i> Hoja Salida (-)
                    </span>`;
                    qtyDisplay = `<span class="text-amber-700 font-bold font-mono">${m.quantity}</span>`;
                    break;
                case 'adjustment':
                default:
                    typeBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                        <i data-lucide="sliders" class="w-3 h-3"></i> Ajuste
                    </span>`;
                    qtyDisplay = `<span class="text-purple-700 font-bold font-mono">${m.quantity >= 0 ? '+' : ''}${m.quantity}</span>`;
                    break;
            }

            return `
                <tr class="hover:bg-slate-50/80 transition-colors border-b border-slate-100 text-xs">
                    <td class="py-2.5 px-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        ${m.date || ''}
                    </td>
                    <td class="py-2.5 px-3">
                        ${typeBadge}
                    </td>
                    <td class="py-2.5 px-3">
                        <div class="font-bold text-slate-800 leading-tight">${m.productName || 'Producto'}</div>
                        <div class="font-mono text-[10px] text-slate-400">${m.productSku || ''}</div>
                    </td>
                    <td class="py-2.5 px-3 text-center">
                        ${qtyDisplay}
                    </td>
                    <td class="py-2.5 px-3 text-center text-slate-600 font-mono font-medium">
                        <span class="text-slate-400">${m.previousStock}</span> ➔ <span class="font-bold text-slate-800">${m.newStock}</span>
                    </td>
                    <td class="py-2.5 px-3 text-slate-700">
                        <div class="font-medium">${m.reason || 'Movimiento'}</div>
                        ${m.reference ? `<div class="text-[10px] text-indigo-600 font-mono font-bold">${m.reference}</div>` : ''}
                    </td>
                    <td class="py-2.5 px-3 text-slate-500 text-[11px]">
                        ${m.notes || m.recipient || '-'}
                    </td>
                </tr>
            `;
        }).join('');

        if (window.lucide) window.lucide.createIcons();
    }

    // ==========================================
    // EXPORTAR KARDEX A EXCEL (.XLSX)
    // ==========================================
    exportKardexToExcel() {
        const movements = window.db.getStockMovements();
        if (movements.length === 0) {
            window.app.showToast('No hay movimientos de inventario para exportar.', 'warning');
            return;
        }

        if (!window.XLSX) {
            window.app.showToast('Librería de Excel no disponible.', 'error');
            return;
        }

        const dataToExport = movements.map(m => ({
            'Fecha y Hora': m.date,
            'Tipo': m.type === 'entry' ? 'Entrada (+)' : (m.type === 'manual_exit' ? 'Salida Manual (-)' : (m.type === 'dispatch' ? 'Hoja de Salida (-)' : 'Ajuste')),
            'SKU': m.productSku || '',
            'Producto / Insumo': m.productName || '',
            'Cantidad': m.quantity,
            'Stock Anterior': m.previousStock,
            'Stock Resultante': m.newStock,
            'Motivo / Concepto': m.reason || '',
            'Referencia / Folio': m.reference || '',
            'Destino / Solicitante': m.recipient || '',
            'Notas': m.notes || ''
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Kardex_Inventario");
        const filename = `Kardex_Inventario_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, filename);

        window.app.showToast('Archivo Excel del Kardex descargado exitosamente.', 'success');
    }

    // ==========================================
    // GESTIÓN DE HOJA DE SALIDA (NUEVA HOJA)
    // ==========================================
    openNewDispatchModal() {
        const nextFolio = window.db.getNextDispatchNumber();
        const folioInput = document.getElementById('dispatch-form-folio');
        const dateInput = document.getElementById('dispatch-form-date');
        const destInput = document.getElementById('dispatch-form-destination');
        const refInput = document.getElementById('dispatch-form-reference');
        const delInput = document.getElementById('dispatch-form-delivered-by');
        const recInput = document.getElementById('dispatch-form-recipient');
        const notesInput = document.getElementById('dispatch-form-notes');

        if (folioInput) folioInput.value = nextFolio;
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
        if (destInput) destInput.value = 'Producción / Taller';
        if (refInput) refInput.value = '';
        if (delInput) delInput.value = 'Bodega Principal';
        if (recInput) recInput.value = '';
        if (notesInput) notesInput.value = '';

        this.dispatchDraftItems = [];
        // Agregar al menos 1 fila vacía para comodidad
        this.addDispatchItemRow();

        window.app.openModal('modal-create-dispatch');
        if (window.lucide) window.lucide.createIcons();
    }

    addDispatchItemRow(productId = '', quantity = 1, notes = '') {
        this.dispatchDraftItems.push({
            productId: productId || '',
            quantity: quantity || 1,
            notes: notes || ''
        });
        this.renderDispatchDraftItems();
    }

    removeDispatchItemRow(index) {
        if (this.dispatchDraftItems.length <= 1) {
            window.app.showToast('La hoja de salida debe tener al menos un producto.', 'info');
            return;
        }
        this.dispatchDraftItems.splice(index, 1);
        this.renderDispatchDraftItems();
    }

    onDispatchProductChange(index, productId) {
        if (this.dispatchDraftItems[index]) {
            this.dispatchDraftItems[index].productId = productId;
            this.renderDispatchDraftItems();
        }
    }

    onDispatchQtyChange(index, qty) {
        if (this.dispatchDraftItems[index]) {
            this.dispatchDraftItems[index].quantity = Math.max(1, parseFloat(qty) || 1);
            this.updateDispatchDraftTotals();
        }
    }

    onDispatchNotesChange(index, notes) {
        if (this.dispatchDraftItems[index]) {
            this.dispatchDraftItems[index].notes = notes;
        }
    }

    renderDispatchDraftItems() {
        const container = document.getElementById('dispatch-items-container');
        if (!container) return;

        const products = window.db.getProducts();

        container.innerHTML = this.dispatchDraftItems.map((item, idx) => {
            const selectedProd = products.find(p => p.id === item.productId);
            const currentStock = selectedProd ? ((selectedProd.stock !== undefined && selectedProd.stock !== null) ? Number(selectedProd.stock) : 0) : 0;
            const unit = selectedProd?.unit || 'Unid';
            const willBeNegative = selectedProd && (currentStock - item.quantity < 0);

            let optionsHtml = '<option value="">-- Selecciona un producto / insumo --</option>';
            products.forEach(p => {
                const pStock = (p.stock !== undefined && p.stock !== null) ? Number(p.stock) : 0;
                const isSel = p.id === item.productId ? 'selected' : '';
                optionsHtml += `<option value="${p.id}" ${isSel}>${p.name} (${p.sku || 'S/N'}) - Disp: ${pStock} ${p.unit || 'u'}</option>`;
            });

            return `
                <div class="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                    <div class="flex items-start justify-between gap-2">
                        <div class="flex-1">
                            <label class="block text-[11px] font-bold text-slate-600 mb-1">Producto / Insumo *</label>
                            <select onchange="inventario.onDispatchProductChange(${idx}, this.value)" class="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-200 rounded-xl focus:border-amber-500 outline-none">
                                ${optionsHtml}
                            </select>
                        </div>
                        <div class="w-28">
                            <label class="block text-[11px] font-bold text-slate-600 mb-1">Cantidad *</label>
                            <input type="number" step="any" min="1" value="${item.quantity}" 
                                oninput="inventario.onDispatchQtyChange(${idx}, this.value)"
                                class="w-full px-3 py-2 text-xs font-bold text-center bg-white border border-slate-200 rounded-xl focus:border-amber-500 outline-none" />
                        </div>
                        <div class="pt-6">
                            <button type="button" onclick="inventario.removeDispatchItemRow(${idx})" class="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors" title="Eliminar fila">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </div>

                    <div class="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60">
                        <div class="flex items-center gap-2">
                            <span class="text-slate-500">Stock Actual: <strong class="text-slate-800">${currentStock} ${unit}</strong></span>
                            ➔ 
                            <span class="${willBeNegative ? 'text-rose-600 font-bold' : 'text-slate-600 font-semibold'}">
                                Quedará: ${currentStock - item.quantity} ${unit}
                            </span>
                            ${willBeNegative ? '<span class="text-[10px] bg-rose-100 text-rose-700 font-bold px-1.5 py-0.5 rounded">¡Alerta: Stock insuficiente!</span>' : ''}
                        </div>
                        <div class="flex-1 max-w-xs ml-4">
                            <input type="text" placeholder="Observación específica de este ítem (ej. Talla L, Bobina #2)..." 
                                value="${item.notes || ''}"
                                oninput="inventario.onDispatchNotesChange(${idx}, this.value)"
                                class="w-full px-2.5 py-1 text-[11px] bg-white border border-slate-200 rounded-lg outline-none" />
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        this.updateDispatchDraftTotals();
        if (window.lucide) window.lucide.createIcons();
    }

    updateDispatchDraftTotals() {
        const totalUnits = this.dispatchDraftItems.reduce((acc, it) => acc + (parseFloat(it.quantity) || 0), 0);
        const totalItemsCount = this.dispatchDraftItems.filter(it => !!it.productId).length;

        const elUnits = document.getElementById('dispatch-draft-total-units');
        const elCount = document.getElementById('dispatch-draft-total-items');

        if (elUnits) elUnits.innerText = totalUnits;
        if (elCount) elCount.innerText = totalItemsCount;
    }

    submitDispatch() {
        const folio = document.getElementById('dispatch-form-folio')?.value.trim();
        const date = document.getElementById('dispatch-form-date')?.value || new Date().toISOString().split('T')[0];
        const destination = document.getElementById('dispatch-form-destination')?.value.trim() || 'Producción / Taller';
        const reference = document.getElementById('dispatch-form-reference')?.value.trim() || '';
        const deliveredBy = document.getElementById('dispatch-form-delivered-by')?.value.trim() || 'Bodega';
        const recipient = document.getElementById('dispatch-form-recipient')?.value.trim() || 'Taller';
        const notes = document.getElementById('dispatch-form-notes')?.value.trim() || '';

        // Validar que hay ítems seleccionados
        const validItems = this.dispatchDraftItems.filter(it => it.productId && it.quantity > 0);
        if (validItems.length === 0) {
            window.app.showToast('Por favor selecciona al menos un producto e indica su cantidad.', 'warning');
            return;
        }

        // Procesar despacho y rebajar stock
        const createdDispatch = window.db.createDispatch({
            dispatchNumber: folio,
            date,
            destination,
            reference,
            deliveredBy,
            recipient,
            notes,
            items: validItems
        });

        window.app.closeModal('modal-create-dispatch');
        this.render();
        window.app.showToast(`Hoja de Salida ${createdDispatch.dispatchNumber} procesada y stock rebajado correctamente.`, 'success');

        if (window.confetti) {
            window.confetti({ particleCount: 40, spread: 60 });
        }

        // Abrir vista previa del comprobante para imprimir
        this.openDispatchViewModal(createdDispatch.id);
    }

    // ==========================================
    // VISTA PREVIA E IMPRESIÓN DE HOJA DE SALIDA
    // ==========================================
    openDispatchViewModal(dispatchId) {
        const dispatch = window.db.getDispatchById(dispatchId);
        if (!dispatch) {
            window.app.showToast('No se encontró la Hoja de Salida.', 'error');
            return;
        }

        const profile = window.db.getProfile();
        const renderArea = document.getElementById('dispatch-preview-render-area');
        if (renderArea) {
            renderArea.innerHTML = this.generateDispatchHTML(dispatch, profile);
        }

        window.app.openModal('modal-view-dispatch');
        if (window.lucide) window.lucide.createIcons();
    }

    generateDispatchHTML(dispatch, profile) {
        const logoHtml = profile.logo 
            ? `<img src="${profile.logo}" alt="Logo" class="max-h-16 max-w-[160px] object-contain rounded" />`
            : `<div class="h-12 w-12 bg-amber-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-md">
                ${(profile.companyName || 'HS').substring(0, 2).toUpperCase()}
               </div>`;

        const itemsRows = (dispatch.items || []).map((it, idx) => `
            <tr class="${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} border-b border-slate-200 text-xs">
                <td class="py-2.5 px-3 text-slate-500 font-medium text-center">${idx + 1}</td>
                <td class="py-2.5 px-3 font-mono font-bold text-slate-600 text-center">${it.productSku || '-'}</td>
                <td class="py-2.5 px-3 text-slate-800">
                    <div class="font-bold">${it.productName}</div>
                    ${it.notes ? `<div class="text-[11px] text-slate-500 italic mt-0.5">${it.notes}</div>` : ''}
                </td>
                <td class="py-2.5 px-3 text-center text-slate-600">${it.unit || 'Unid'}</td>
                <td class="py-2.5 px-3 text-center font-black text-slate-900 text-sm">${it.quantity}</td>
                <td class="py-2.5 px-3 text-center text-slate-500 text-[11px]">
                    ${it.previousStock} ➔ <strong>${it.newStock}</strong>
                </td>
            </tr>
        `).join('');

        return `
        <div id="dispatch-voucher-doc" class="bg-white p-8 max-w-3xl mx-auto text-slate-800 font-sans text-xs antialiased border border-slate-200 rounded-2xl shadow-sm print:border-none print:shadow-none print:p-0">
            <!-- Cabecera -->
            <div class="flex justify-between items-start border-b-2 border-amber-600 pb-5 mb-5">
                <div class="flex items-center gap-4">
                    ${logoHtml}
                    <div>
                        <h1 class="text-xl font-black text-slate-900 tracking-tight leading-tight">${profile.companyName || 'Mi Empresa'}</h1>
                        <p class="text-xs text-slate-500 font-medium">RUT / ID: <span class="text-slate-800 font-bold">${profile.taxId || 'N/A'}</span></p>
                        <p class="text-[11px] text-slate-400 font-medium">${profile.address || ''} ${profile.phone ? `• Tel: ${profile.phone}` : ''}</p>
                    </div>
                </div>
                <div class="text-right">
                    <div class="inline-block px-3 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black uppercase tracking-wider mb-1">
                        HOJA DE SALIDA / VALE DE ALMACÉN
                    </div>
                    <p class="text-lg font-black text-amber-700 font-mono tracking-tight">${dispatch.dispatchNumber || 'HS-0000'}</p>
                    <p class="text-xs text-slate-500">Fecha: <span class="text-slate-800 font-bold">${dispatch.date} ${dispatch.time || ''}</span></p>
                </div>
            </div>

            <!-- Datos de Entrega y Destino -->
            <div class="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 mb-5 text-xs">
                <div>
                    <h4 class="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Destino / Área de Uso</h4>
                    <p class="font-bold text-slate-800 text-sm">${dispatch.destination || 'Producción / Taller'}</p>
                    ${dispatch.reference ? `<p class="text-xs text-indigo-700 font-bold mt-1">Referencia: ${dispatch.reference}</p>` : ''}
                </div>
                <div>
                    <h4 class="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Responsables</h4>
                    <p class="text-xs text-slate-700">Entregado por: <strong class="text-slate-900">${dispatch.deliveredBy || 'Bodega'}</strong></p>
                    <p class="text-xs text-slate-700 mt-0.5">Recibido por: <strong class="text-slate-900">${dispatch.recipient || 'Taller / Operador'}</strong></p>
                </div>
            </div>

            <!-- Tabla de Materiales e Insumos Entregados -->
            <div class="overflow-hidden border border-slate-200 rounded-xl mb-5">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="bg-amber-600/10 text-[11px] font-bold text-amber-950 uppercase tracking-wider border-b border-amber-600/20">
                            <th class="py-2 px-3 text-center w-8">#</th>
                            <th class="py-2 px-3 text-center w-24">Código</th>
                            <th class="py-2 px-3">Descripción del Material / Insumo</th>
                            <th class="py-2 px-3 text-center w-20">Unidad</th>
                            <th class="py-2 px-3 text-center w-24">Cant. Salida</th>
                            <th class="py-2 px-3 text-center w-24">Stock Taller</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsRows}
                    </tbody>
                    <tfoot>
                        <tr class="bg-slate-50 border-t-2 border-slate-300 font-bold text-xs">
                            <td colspan="4" class="py-2.5 px-3 text-right uppercase tracking-wider text-slate-600">Total Unidades Retiradas:</td>
                            <td class="py-2.5 px-3 text-center text-amber-700 font-black text-sm">${dispatch.totalUnits || 0}</td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            ${dispatch.notes ? `
            <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 mb-6 text-xs">
                <strong class="text-slate-700 block mb-1">Observaciones Generales:</strong>
                <p class="text-slate-600 leading-relaxed">${dispatch.notes}</p>
            </div>
            ` : ''}

            <!-- Firmas de Entrega y Recepción -->
            <div class="grid grid-cols-2 gap-8 pt-8 mt-8 border-t border-slate-200">
                <div class="text-center">
                    <div class="border-b border-slate-400 w-3/4 mx-auto mb-2"></div>
                    <p class="text-xs font-bold text-slate-800">${dispatch.deliveredBy || 'Bodega / Almacén'}</p>
                    <p class="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Entregó Conforme</p>
                </div>
                <div class="text-center">
                    <div class="border-b border-slate-400 w-3/4 mx-auto mb-2"></div>
                    <p class="text-xs font-bold text-slate-800">${dispatch.recipient || 'Taller / Operador'}</p>
                    <p class="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Recibió Conforme</p>
                </div>
            </div>
        </div>
        `;
    }

    printCurrentDispatch() {
        window.print();
    }

    // ==========================================
    // ENTRADA RÁPIDA DE STOCK (+)
    // ==========================================
    openQuickEntryModal(productId = null) {
        const prodSelect = document.getElementById('entry-stock-product-select');
        const qtyInput = document.getElementById('entry-stock-quantity');
        const reasonSelect = document.getElementById('entry-stock-reason');
        const refInput = document.getElementById('entry-stock-ref');
        const costInput = document.getElementById('entry-stock-cost');
        const notesInput = document.getElementById('entry-stock-notes');

        const products = window.db.getProducts();
        if (prodSelect) {
            let html = '<option value="">-- Seleccionar producto --</option>';
            products.forEach(p => {
                const stock = (p.stock !== undefined && p.stock !== null) ? Number(p.stock) : 0;
                const isSel = p.id === productId ? 'selected' : '';
                html += `<option value="${p.id}" ${isSel}>${p.name} (${p.sku || 'S/N'}) - Stock actual: ${stock}</option>`;
            });
            prodSelect.innerHTML = html;
        }

        if (qtyInput) qtyInput.value = '1';
        if (reasonSelect) reasonSelect.value = 'Compra a Proveedor';
        if (refInput) refInput.value = '';
        if (notesInput) notesInput.value = '';

        if (costInput) {
            const p = productId ? window.db.getProductById(productId) : null;
            costInput.value = p ? p.costPrice : '';
        }

        window.app.openModal('modal-stock-entry');
        if (window.lucide) window.lucide.createIcons();
    }

    onEntryProductChange(productId) {
        const p = window.db.getProductById(productId);
        const costInput = document.getElementById('entry-stock-cost');
        if (costInput && p) {
            costInput.value = p.costPrice || '';
        }
    }

    submitQuickEntry() {
        const productId = document.getElementById('entry-stock-product-select')?.value;
        const qty = parseFloat(document.getElementById('entry-stock-quantity')?.value) || 0;
        const reason = document.getElementById('entry-stock-reason')?.value || 'Compra a Proveedor';
        const reference = document.getElementById('entry-stock-ref')?.value.trim() || '';
        const costVal = document.getElementById('entry-stock-cost')?.value;
        const cost = (costVal !== '' && !isNaN(parseFloat(costVal))) ? parseFloat(costVal) : null;
        const notes = document.getElementById('entry-stock-notes')?.value.trim() || '';

        if (!productId) {
            window.app.showToast('Por favor selecciona un producto.', 'warning');
            return;
        }
        if (qty <= 0) {
            window.app.showToast('La cantidad debe ser mayor a 0.', 'warning');
            return;
        }

        const updated = window.db.addStockToProduct(productId, qty, reason, reference, cost, notes);
        if (updated) {
            window.app.closeModal('modal-stock-entry');
            this.render();
            window.app.showToast(`Se agregaron +${qty} unidades a "${updated.name}". Stock actual: ${updated.stock}`, 'success');
        }
    }

    // ==========================================
    // SALIDA MANUAL RÁPIDA DE STOCK (-)
    // ==========================================
    openQuickExitModal(productId = null) {
        const prodSelect = document.getElementById('exit-stock-product-select');
        const qtyInput = document.getElementById('exit-stock-quantity');
        const reasonSelect = document.getElementById('exit-stock-reason');
        const recipientInput = document.getElementById('exit-stock-recipient');
        const refInput = document.getElementById('exit-stock-ref');
        const notesInput = document.getElementById('exit-stock-notes');
        const currentStockSpan = document.getElementById('exit-stock-current-display');

        const products = window.db.getProducts();
        if (prodSelect) {
            let html = '<option value="">-- Seleccionar producto --</option>';
            products.forEach(p => {
                const stock = (p.stock !== undefined && p.stock !== null) ? Number(p.stock) : 0;
                const isSel = p.id === productId ? 'selected' : '';
                html += `<option value="${p.id}" ${isSel}>${p.name} (${p.sku || 'S/N'}) - Disp: ${stock}</option>`;
            });
            prodSelect.innerHTML = html;
        }

        if (qtyInput) qtyInput.value = '1';
        if (reasonSelect) reasonSelect.value = 'Merma / Error de Estampado o Impresión';
        if (recipientInput) recipientInput.value = '';
        if (refInput) refInput.value = '';
        if (notesInput) notesInput.value = '';

        const p = productId ? window.db.getProductById(productId) : null;
        if (currentStockSpan) {
            const stock = p ? ((p.stock !== undefined && p.stock !== null) ? Number(p.stock) : 0) : 0;
            currentStockSpan.innerText = `${stock} ${p?.unit || 'unidades'}`;
        }

        window.app.openModal('modal-stock-exit');
        if (window.lucide) window.lucide.createIcons();
    }

    onExitProductChange(productId) {
        const p = window.db.getProductById(productId);
        const currentStockSpan = document.getElementById('exit-stock-current-display');
        if (currentStockSpan) {
            const stock = p ? ((p.stock !== undefined && p.stock !== null) ? Number(p.stock) : 0) : 0;
            currentStockSpan.innerText = `${stock} ${p?.unit || 'unidades'}`;
        }
    }

    submitQuickExit() {
        const productId = document.getElementById('exit-stock-product-select')?.value;
        const qty = parseFloat(document.getElementById('exit-stock-quantity')?.value) || 0;
        const reason = document.getElementById('exit-stock-reason')?.value || 'Salida Manual';
        const recipient = document.getElementById('exit-stock-recipient')?.value.trim() || '';
        const reference = document.getElementById('exit-stock-ref')?.value.trim() || '';
        const notes = document.getElementById('exit-stock-notes')?.value.trim() || '';

        if (!productId) {
            window.app.showToast('Por favor selecciona un producto.', 'warning');
            return;
        }
        if (qty <= 0) {
            window.app.showToast('La cantidad a rebajar debe ser mayor a 0.', 'warning');
            return;
        }

        const p = window.db.getProductById(productId);
        const currentStock = (p?.stock !== undefined && p?.stock !== null) ? Number(p.stock) : 0;
        if (qty > currentStock) {
            if (!confirm(`La cantidad a rebajar (${qty}) supera el stock actual disponible (${currentStock}). El stock quedará en 0. ¿Deseas continuar?`)) {
                return;
            }
        }

        const updated = window.db.reduceStockFromProduct(productId, qty, reason, reference, notes, recipient);
        if (updated) {
            window.app.closeModal('modal-stock-exit');
            this.render();
            window.app.showToast(`Se rebajaron -${qty} unidades de "${updated.name}". Stock restante: ${updated.stock}`, 'info');
        }
    }

    // ==========================================
    // AJUSTE FÍSICO DIRECTO DE STOCK
    // ==========================================
    openAdjustStockModal(productId) {
        const p = window.db.getProductById(productId);
        if (!p) return;

        const idInput = document.getElementById('adjust-stock-product-id');
        const nameDisplay = document.getElementById('adjust-stock-product-name');
        const currentStockDisplay = document.getElementById('adjust-stock-current');
        const exactInput = document.getElementById('adjust-stock-exact-qty');
        const minStockInput = document.getElementById('adjust-stock-min-qty');
        const reasonInput = document.getElementById('adjust-stock-reason');
        const notesInput = document.getElementById('adjust-stock-notes');

        const currentStock = (p.stock !== undefined && p.stock !== null) ? Number(p.stock) : 0;
        const minStock = (p.minStock !== undefined && p.minStock !== null) ? Number(p.minStock) : 5;

        if (idInput) idInput.value = p.id;
        if (nameDisplay) nameDisplay.innerText = `${p.name} (${p.sku || 'S/N'})`;
        if (currentStockDisplay) currentStockDisplay.innerText = `${currentStock} ${p.unit || 'unidades'}`;
        if (exactInput) exactInput.value = currentStock;
        if (minStockInput) minStockInput.value = minStock;
        if (reasonInput) reasonInput.value = 'Conteo / Inventario Físico';
        if (notesInput) notesInput.value = '';

        window.app.openModal('modal-stock-adjust');
        if (window.lucide) window.lucide.createIcons();
    }

    submitAdjustStock() {
        const productId = document.getElementById('adjust-stock-product-id')?.value;
        const exactQty = parseFloat(document.getElementById('adjust-stock-exact-qty')?.value);
        const minQty = parseFloat(document.getElementById('adjust-stock-min-qty')?.value);
        const reason = document.getElementById('adjust-stock-reason')?.value.trim() || 'Ajuste Físico';
        const notes = document.getElementById('adjust-stock-notes')?.value.trim() || '';

        if (!productId || isNaN(exactQty)) {
            window.app.showToast('Por favor indica la cantidad física exacta.', 'warning');
            return;
        }

        const updated = window.db.adjustProductStock(productId, exactQty, minQty, reason, notes);
        if (updated) {
            window.app.closeModal('modal-stock-adjust');
            this.render();
            window.app.showToast(`Stock de "${updated.name}" actualizado a ${updated.stock} unidades.`, 'success');
        }
    }

    // ==========================================
    // VER KARDEX DE UN PRODUCTO ESPECÍFICO
    // ==========================================
    openProductKardexModal(productId) {
        const p = window.db.getProductById(productId);
        if (!p) return;

        const nameSpan = document.getElementById('product-kardex-modal-title');
        const tbody = document.getElementById('product-kardex-table-body');
        const currentStockSpan = document.getElementById('product-kardex-current-stock');

        if (nameSpan) nameSpan.innerText = `${p.name} (${p.sku || 'S/N'})`;
        if (currentStockSpan) currentStockSpan.innerText = `${p.stock || 0} ${p.unit || 'u'}`;

        const movements = window.db.getStockMovements().filter(m => m.productId === productId);

        if (tbody) {
            if (movements.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="text-center py-8 text-slate-400">
                            No hay movimientos registrados para este producto todavía.
                        </td>
                    </tr>
                `;
            } else {
                tbody.innerHTML = movements.map(m => {
                    let typeBadge = '';
                    switch (m.type) {
                        case 'entry': typeBadge = '<span class="text-emerald-700 font-bold">+ Entrada</span>'; break;
                        case 'manual_exit': typeBadge = '<span class="text-rose-700 font-bold">- Salida Manual</span>'; break;
                        case 'dispatch': typeBadge = '<span class="text-amber-700 font-bold">- Hoja Salida</span>'; break;
                        default: typeBadge = '<span class="text-purple-700 font-bold">Ajuste</span>'; break;
                    }

                    return `
                        <tr class="border-b border-slate-100 text-xs">
                            <td class="py-2.5 px-3 font-mono text-[11px] text-slate-500">${m.date}</td>
                            <td class="py-2.5 px-3">${typeBadge}</td>
                            <td class="py-2.5 px-3 text-center font-bold font-mono">${m.quantity >= 0 ? '+' : ''}${m.quantity}</td>
                            <td class="py-2.5 px-3 text-center font-mono text-slate-600">${m.previousStock} ➔ <strong>${m.newStock}</strong></td>
                            <td class="py-2.5 px-3 text-slate-700">${m.reason || '-'} ${m.reference ? `(${m.reference})` : ''}</td>
                            <td class="py-2.5 px-3 text-slate-500 text-[11px]">${m.notes || m.recipient || '-'}</td>
                        </tr>
                    `;
                }).join('');
            }
        }

        window.app.openModal('modal-product-kardex');
        if (window.lucide) window.lucide.createIcons();
    }
}

// Instanciar globalmente
window.inventario = new InventarioManager();
