// js/app.js - Controlador Principal de la Aplicación con Firebase Authentication
class AppController {
    constructor() {
        this.currentTab = 'tab-cotizador';
        this.catalogSubTab = 'products';
        this.currentUser = null;
    }

    init() {
        // Inicializar Iconos Lucide
        if (window.lucide) {
            window.lucide.createIcons();
        }

        // Configurar Listener de Firebase Authentication
        this.setupFirebaseAuthListener();

        // Cargar Datos del Perfil y UI inicial
        this.loadProfileIntoUI();
        this.renderCategoriesDataLists();
        this.renderSuppliersDataList();
        this.renderGlobalTiersSettings();
        this.renderVinylTypeSelectors();
        this.calculateVinylLive();
        this.renderQuoteDraft();
        this.renderHistory();
        this.renderProducts();
        this.renderSuppliers();
        this.bindEvents();

        console.log('Cotizador Pro App Inicializada con Firebase Authentication.');
    }

    // ==========================================
    // FIREBASE AUTHENTICATION (LOGIN & LOGOUT)
    // ==========================================
    setupFirebaseAuthListener() {
        const authScreen = document.getElementById('auth-screen');
        const sidebarUserName = document.getElementById('sidebar-user-name');

        if (typeof firebase !== 'undefined' && firebase.auth) {
            firebase.auth().onAuthStateChanged((user) => {
                this.currentUser = user;
                if (user) {
                    // Usuario autenticado en Firebase
                    if (authScreen) authScreen.classList.add('hidden');
                    if (sidebarUserName) sidebarUserName.innerText = user.email || 'Usuario';
                    console.log('Usuario autenticado en Firebase:', user.email);
                } else {
                    // Sin sesión activa
                    if (authScreen) authScreen.classList.remove('hidden');
                    if (sidebarUserName) sidebarUserName.innerText = 'Sin Sesión';
                }
            });
        } else {
            console.warn('Firebase Auth SDK no disponible de momento.');
        }
    }

    togglePasswordVisibility(inputId, iconWrapId) {
        const input = document.getElementById(inputId);
        const wrap = document.getElementById(iconWrapId);
        if (!input) return;

        if (input.type === 'password') {
            input.type = 'text';
            if (wrap) wrap.innerHTML = `<i data-lucide="eye-off" class="w-4 h-4 text-slate-500"></i>`;
        } else {
            input.type = 'password';
            if (wrap) wrap.innerHTML = `<i data-lucide="eye" class="w-4 h-4 text-slate-400"></i>`;
        }
        if (window.lucide) window.lucide.createIcons();
    }

    async handleLoginSubmit(e) {
        e.preventDefault();
        const email = (document.getElementById('login-email')?.value || '').trim();
        const pass = document.getElementById('login-password')?.value || '';
        const submitBtn = document.getElementById('login-submit-btn');

        if (!email || !pass) {
            this.showToast('Por favor introduce tu correo y contraseña.', 'warning');
            return;
        }

        if (typeof firebase === 'undefined' || !firebase.auth) {
            this.showToast('Cargando servicios de autenticación... Por favor reintenta en un momento.', 'warning');
            return;
        }

        try {
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerText = 'Verificando...';
            }

            const userCredential = await firebase.auth().signInWithEmailAndPassword(email, pass);
            this.showToast(`¡Bienvenido! Sesión iniciada con éxito.`, 'success');
            if (window.confetti) window.confetti({ particleCount: 30, spread: 60 });
        } catch (error) {
            console.error('Error de autenticación en Firebase:', error);
            const msg = window.getFirebaseAuthErrorMessage ? window.getFirebaseAuthErrorMessage(error.code) : error.message;
            this.showToast(msg, 'error');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i data-lucide="log-in" class="w-4 h-4"></i> INGRESAR`;
                if (window.lucide) window.lucide.createIcons();
            }
        }
    }

    async logout() {
        if (confirm('¿Deseas cerrar tu sesión actual?')) {
            try {
                if (typeof firebase !== 'undefined' && firebase.auth) {
                    await firebase.auth().signOut();
                }
                this.showToast('Sesión cerrada correctamente.', 'info');
            } catch (error) {
                this.showToast('Error al cerrar sesión: ' + error.message, 'error');
            }
        }
    }

    // ==========================================
    // VINCULACIÓN DE EVENTOS
    // ==========================================
    bindEvents() {
        // Eventos de la Calculadora de Vinilos
        const vinylInputs = ['vinyl-width-input', 'vinyl-height-input', 'vinyl-quantity-input', 
                             'vinyl-cost-m2-input', 'vinyl-labor-m2-input', 'vinyl-waste-input', 'vinyl-margin-input'];
        vinylInputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', () => this.calculateVinylLive());
        });

        // Eventos del Cotizador
        const quoteInputs = ['quote-client-name', 'quote-client-rut', 'quote-client-contact', 'quote-client-phone', 
                             'quote-client-email', 'quote-client-address', 'quote-number-input', 
                             'quote-date-input', 'quote-valid-until-input', 'quote-status-select', 
                             'quote-notes-input'];
        quoteInputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', () => this.syncQuoteHeaderFromUI());
        });

        const discountInput = document.getElementById('quote-discount-input');
        if (discountInput) {
            discountInput.addEventListener('input', (e) => {
                window.cotizador.currentQuote.discountPercentage = parseFloat(e.target.value) || 0;
                window.cotizador.recalculateTotals();
                this.updateQuoteTotalsDisplay();
            });
        }

        // Toggle de IVA con recálculo instantáneo
        const taxToggle = document.getElementById('quote-tax-toggle');
        if (taxToggle) {
            taxToggle.addEventListener('change', (e) => {
                const profile = window.db.getProfile();
                profile.enableTax = e.target.checked;
                window.db.saveProfile({ enableTax: e.target.checked });
                window.cotizador.recalculateTotals();
                this.updateQuoteTotalsDisplay();
            });
        }

        // Buscadores en vivo
        const histSearch = document.getElementById('history-search-input');
        if (histSearch) histSearch.addEventListener('input', () => this.renderHistory());

        const histFilter = document.getElementById('history-status-filter');
        if (histFilter) histFilter.addEventListener('change', () => this.renderHistory());

        const prodSearch = document.getElementById('products-search-input');
        if (prodSearch) prodSearch.addEventListener('input', () => this.renderProducts());

        const prodCatFilter = document.getElementById('products-category-filter');
        if (prodCatFilter) prodCatFilter.addEventListener('change', () => this.renderProducts());

        const modalProdSearch = document.getElementById('modal-search-product-input');
        if (modalProdSearch) modalProdSearch.addEventListener('input', () => this.filterModalProducts());
    }

    // ==========================================
    // NAVEGACIÓN Y TABS
    // ==========================================
    switchTab(tabId) {
        this.currentTab = tabId;
        
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        const targetTab = document.getElementById(tabId);
        if (targetTab) targetTab.classList.add('active');

        document.querySelectorAll('.nav-btn').forEach(btn => {
            const isMatch = btn.getAttribute('data-nav-tab') === tabId;
            btn.classList.toggle('bg-slate-800', isMatch);
            btn.classList.toggle('text-white', isMatch);
            btn.classList.toggle('text-slate-300', !isMatch);
        });

        document.querySelectorAll('[data-mobile-nav]').forEach(btn => {
            const isMatch = btn.getAttribute('data-mobile-nav') === tabId;
            btn.classList.toggle('text-indigo-600', isMatch);
            btn.classList.toggle('text-slate-400', !isMatch);
        });

        const titleMap = {
            'tab-cotizador': { title: 'Creador de Cotizaciones', sub: 'Borrador Activo' },
            'tab-vinilos': { title: 'Calculadora de Vinilos por m²', sub: 'Corte, UV y Textil' },
            'tab-historial': { title: 'Historial de Cotizaciones', sub: 'Gestión y Seguimiento' },
            'tab-catalogo': { title: 'Catálogo de Precios & Proveedores', sub: 'Costos y Márgenes' },
            'tab-ajustes': { title: 'Configuración & Identidad', sub: 'Logotipo y Empresa' }
        };

        const pageTitle = document.getElementById('page-current-title');
        const pageSub = document.getElementById('page-current-subtitle');
        if (pageTitle && titleMap[tabId]) pageTitle.innerText = titleMap[tabId].title;
        if (pageSub && titleMap[tabId]) pageSub.innerText = titleMap[tabId].sub;

        if (window.lucide) window.lucide.createIcons();
    }

    switchCatalogSubTab(subTab) {
        this.catalogSubTab = subTab;
        const btnProd = document.getElementById('subtab-btn-products');
        const btnSup = document.getElementById('subtab-btn-suppliers');
        const viewProd = document.getElementById('subtab-view-products');
        const viewSup = document.getElementById('subtab-view-suppliers');

        if (subTab === 'products') {
            btnProd.className = 'px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 text-white transition-all';
            btnSup.className = 'px-4 py-2 text-xs font-bold rounded-xl text-slate-600 hover:bg-slate-200 transition-all';
            viewProd.classList.remove('hidden');
            viewSup.classList.add('hidden');
            this.renderProducts();
        } else {
            btnSup.className = 'px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 text-white transition-all';
            btnProd.className = 'px-4 py-2 text-xs font-bold rounded-xl text-slate-600 hover:bg-slate-200 transition-all';
            viewSup.classList.remove('hidden');
            viewProd.classList.add('hidden');
            this.renderSuppliers();
        }
    }

    // ==========================================
    // GESTOR DE CATEGORÍAS
    // ==========================================
    renderCategoriesDataLists() {
        const categories = window.db.getCategories();
        
        const dl = document.getElementById('categories-datalist');
        if (dl) {
            dl.innerHTML = categories.map(c => `<option value="${this.escapeHTML(c)}"></option>`).join('');
        }

        const catFilter = document.getElementById('products-category-filter');
        if (catFilter) {
            const curVal = catFilter.value;
            catFilter.innerHTML = `<option value="todas">Todas las Categorías</option>` + 
                categories.map(c => `<option value="${this.escapeHTML(c)}">${this.escapeHTML(c)}</option>`).join('');
            if (curVal) catFilter.value = curVal;
        }

        const listContainer = document.getElementById('categories-list-container');
        if (listContainer) {
            listContainer.innerHTML = categories.map(c => `
                <div class="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <span class="font-bold text-slate-700">${this.escapeHTML(c)}</span>
                    <button onclick="app.deleteCategory('${this.escapeHTML(c)}')" class="p-1 text-slate-400 hover:text-rose-600 rounded">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    </button>
                </div>
            `).join('');
        }
    }

    openCategoryManagerModal() {
        this.renderCategoriesDataLists();
        document.getElementById('new-category-input').value = '';
        this.openModal('modal-category-manager');
        if (window.lucide) window.lucide.createIcons();
    }

    addNewCategoryFromModal() {
        const input = document.getElementById('new-category-input');
        const name = input.value.trim();
        if (!name) {
            this.showToast('Escribe el nombre de la categoría.', 'warning');
            return;
        }
        window.db.saveCategory(name);
        this.renderCategoriesDataLists();
        this.renderProducts();
        input.value = '';
        this.showToast(`Categoría "${name}" agregada.`, 'success');
        if (window.lucide) window.lucide.createIcons();
    }

    deleteCategory(name) {
        if (confirm(`¿Deseas eliminar la categoría "${name}"?`)) {
            window.db.deleteCategory(name);
            this.renderCategoriesDataLists();
            this.renderProducts();
            this.showToast('Categoría eliminada.', 'info');
        }
    }

    // ==========================================
    // GESTOR DE PROVEEDORES EN DATALIST
    // ==========================================
    renderSuppliersDataList() {
        const suppliers = window.db.getSuppliers();
        const dl = document.getElementById('suppliers-datalist');
        if (dl) {
            dl.innerHTML = suppliers.map(s => `<option value="${this.escapeHTML(s.name)}">${s.rut ? 'RUT: ' + this.escapeHTML(s.rut) : ''}</option>`).join('');
        }
    }

    // ==========================================
    // CALCULADORA DE VINILOS (CRUD PRESETS)
    // ==========================================
    renderVinylTypeSelectors() {
        const presets = window.db.getVinylPresets();
        const container = document.getElementById('vinyl-type-selector-cards');
        if (!container) return;

        container.innerHTML = presets.map((p) => {
            const isSelected = p.id === window.vinylCalc.currentPresetId;
            return `
                <div id="preset-card-${p.id}" class="vinyl-preset-btn p-3 rounded-2xl border transition-all flex flex-col justify-between ${isSelected ? 'bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-200' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}">
                    <div class="flex items-start justify-between mb-2">
                        <button type="button" onclick="app.selectVinylPreset('${p.id}')" class="flex-1 text-left">
                            <h5 class="text-xs font-bold text-slate-900 leading-tight">${this.escapeHTML(p.name)}</h5>
                            <p class="text-[10px] text-indigo-600 font-semibold mt-0.5">Base: $${(parseFloat(p.costPerM2) || 0).toFixed(2)}/m² | M.O: $${(parseFloat(p.laborCostPerM2) || 0).toFixed(2)}</p>
                        </button>
                        <div class="flex items-center gap-1 shrink-0 ml-2">
                            <button onclick="app.openVinylPresetModal('${p.id}')" class="p-1 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors" title="Editar este tipo">
                                <i data-lucide="edit" class="w-3.5 h-3.5"></i>
                            </button>
                        </div>
                    </div>
                    <div class="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-200/60 pt-1.5 mt-1">
                        <span>Merma: ${p.wasteRate || 10}%</span>
                        <span class="font-bold text-slate-600">Margen: +${p.defaultMargin || 50}%</span>
                    </div>
                </div>
            `;
        }).join('');

        if (presets.length > 0 && !presets.find(p => p.id === window.vinylCalc.currentPresetId)) {
            this.selectVinylPreset(presets[0].id, false);
        }

        if (window.lucide) window.lucide.createIcons();
    }

    selectVinylPreset(presetId, triggerCalc = true) {
        window.vinylCalc.currentPresetId = presetId;
        const preset = window.vinylCalc.getPreset(presetId);
        if (!preset) return;

        this.renderVinylTypeSelectors();

        document.getElementById('vinyl-cost-m2-input').value = preset.costPerM2;
        document.getElementById('vinyl-labor-m2-input').value = preset.laborCostPerM2;
        document.getElementById('vinyl-waste-input').value = preset.wasteRate;
        document.getElementById('vinyl-margin-input').value = preset.defaultMargin;

        if (triggerCalc) {
            this.calculateVinylLive();
        }
    }

    openVinylPresetModal(id = null) {
        const title = document.getElementById('vinyl-modal-title');
        const deleteBtn = document.getElementById('vinyl-preset-delete-btn');

        if (id) {
            const p = window.db.getVinylPresetById(id);
            if (!p) return;
            title.innerText = 'Editar Tipo de Vinilo';
            document.getElementById('vinyl-preset-form-id').value = p.id;
            document.getElementById('vinyl-preset-form-name').value = p.name || '';
            document.getElementById('vinyl-preset-form-cost').value = p.costPerM2 || 0;
            document.getElementById('vinyl-preset-form-labor').value = p.laborCostPerM2 || 0;
            document.getElementById('vinyl-preset-form-waste').value = p.wasteRate || 10;
            document.getElementById('vinyl-preset-form-margin').value = p.defaultMargin || 50;
            document.getElementById('vinyl-preset-form-desc').value = p.description || '';
            deleteBtn.classList.remove('hidden');
        } else {
            title.innerText = 'Nuevo Tipo de Vinilo / Trabajo';
            document.getElementById('vinyl-preset-form-id').value = '';
            document.getElementById('vinyl-preset-form-name').value = '';
            document.getElementById('vinyl-preset-form-cost').value = '7.50';
            document.getElementById('vinyl-preset-form-labor').value = '4.00';
            document.getElementById('vinyl-preset-form-waste').value = '12';
            document.getElementById('vinyl-preset-form-margin').value = '50';
            document.getElementById('vinyl-preset-form-desc').value = '';
            deleteBtn.classList.add('hidden');
        }

        this.openModal('modal-edit-vinyl-preset');
    }

    submitVinylPresetForm() {
        const id = document.getElementById('vinyl-preset-form-id').value;
        const name = document.getElementById('vinyl-preset-form-name').value.trim();
        const costPerM2 = parseFloat(document.getElementById('vinyl-preset-form-cost').value) || 0;
        const laborCostPerM2 = parseFloat(document.getElementById('vinyl-preset-form-labor').value) || 0;
        const wasteRate = parseFloat(document.getElementById('vinyl-preset-form-waste').value) || 0;
        const defaultMargin = parseFloat(document.getElementById('vinyl-preset-form-margin').value) || 0;
        const description = document.getElementById('vinyl-preset-form-desc').value.trim();

        if (!name) {
            this.showToast('Por favor escribe el nombre del tipo de vinilo.', 'warning');
            return;
        }

        const preset = {
            id: id || undefined,
            name,
            costPerM2,
            laborCostPerM2,
            wasteRate,
            defaultMargin,
            description,
            unitName: 'm²'
        };

        const saved = window.db.saveVinylPreset(preset);
        this.selectVinylPreset(saved.id);
        this.closeModal('modal-edit-vinyl-preset');
        this.showToast(`Tipo de vinilo "${saved.name}" guardado con éxito.`, 'success');
    }

    deleteCurrentVinylPreset() {
        const id = document.getElementById('vinyl-preset-form-id').value;
        if (!id) return;

        if (confirm('¿Deseas eliminar este tipo de vinilo de la calculadora?')) {
            window.db.deleteVinylPreset(id);
            this.renderVinylTypeSelectors();
            const first = window.db.getVinylPresets()[0];
            if (first) this.selectVinylPreset(first.id);
            this.closeModal('modal-edit-vinyl-preset');
            this.showToast('Tipo de vinilo eliminado.', 'info');
        }
    }

    setVinylUnitMode(mode) {
        window.vinylCalc.unitMode = mode;
        const btnCm = document.getElementById('unit-btn-cm');
        const btnM = document.getElementById('unit-btn-m');
        const labels = document.querySelectorAll('.unit-label-span');

        if (mode === 'cm') {
            btnCm.className = 'px-2.5 py-1 text-xs font-bold rounded-lg bg-indigo-600 text-white transition-all';
            btnM.className = 'px-2.5 py-1 text-xs font-bold rounded-lg text-slate-600 hover:text-slate-900 transition-all';
            labels.forEach(l => l.innerText = 'cm');
        } else {
            btnM.className = 'px-2.5 py-1 text-xs font-bold rounded-lg bg-indigo-600 text-white transition-all';
            btnCm.className = 'px-2.5 py-1 text-xs font-bold rounded-lg text-slate-600 hover:text-slate-900 transition-all';
            labels.forEach(l => l.innerText = 'm');
        }
        this.calculateVinylLive();
    }

    calculateVinylLive() {
        const width = parseFloat(document.getElementById('vinyl-width-input')?.value) || 0;
        const height = parseFloat(document.getElementById('vinyl-height-input')?.value) || 0;
        const qty = parseInt(document.getElementById('vinyl-quantity-input')?.value, 10) || 1;
        const customCost = parseFloat(document.getElementById('vinyl-cost-m2-input')?.value);
        const customLabor = parseFloat(document.getElementById('vinyl-labor-m2-input')?.value);
        const customWaste = parseFloat(document.getElementById('vinyl-waste-input')?.value);
        const customMargin = parseFloat(document.getElementById('vinyl-margin-input')?.value);
        const customTitle = document.getElementById('vinyl-custom-title-input')?.value || '';

        const res = window.vinylCalc.calculate({
            presetId: window.vinylCalc.currentPresetId,
            width,
            height,
            unitMode: window.vinylCalc.unitMode,
            quantity: qty,
            customCostM2: customCost,
            customLaborM2: customLabor,
            customWaste: customWaste,
            customMargin: customMargin,
            notes: customTitle
        });

        const currency = window.db.getProfile().currency || '$';

        document.getElementById('vinyl-m2-badge').innerText = `${res.totalNetAreaM2} m²`;
        document.getElementById('calc-net-area-display').innerText = `${res.totalNetAreaM2} m² (${qty} unds de ${res.unitAreaM2} m²)`;
        document.getElementById('calc-waste-rate-display').innerText = res.wasteRate;
        document.getElementById('calc-gross-area-display').innerText = `${res.totalGrossAreaM2} m²`;
        document.getElementById('calc-material-cost-display').innerText = `${currency} ${res.materialCostTotal.toFixed(2)}`;
        document.getElementById('calc-labor-cost-display').innerText = `${currency} ${res.laborCostTotal.toFixed(2)}`;
        document.getElementById('calc-total-cost-display').innerText = `${currency} ${res.totalBaseCost.toFixed(2)}`;
        document.getElementById('calc-profit-display').innerText = `+${currency} ${res.profitAmount.toFixed(2)} (${res.margin}%)`;
        document.getElementById('calc-unit-price-display').innerText = `${currency} ${res.unitPrice.toFixed(2)}`;
        document.getElementById('calc-total-sale-display').innerText = `${currency} ${res.totalSalePrice.toFixed(2)}`;

        const visualRect = document.getElementById('vinyl-visual-rect');
        const visualDimLabel = document.getElementById('visual-dim-label');
        const visualQtyLabel = document.getElementById('visual-qty-label');
        if (visualRect && visualDimLabel) {
            const aspect = width > 0 && height > 0 ? (width / height) : 1;
            let visualW = 120;
            let visualH = 70;
            if (aspect >= 1) {
                visualW = Math.min(220, Math.max(60, 100 * Math.min(2.2, aspect)));
                visualH = Math.max(40, visualW / aspect);
            } else {
                visualH = Math.min(110, Math.max(50, 70 / aspect));
                visualW = Math.max(50, visualH * aspect);
            }
            visualRect.style.width = `${visualW}px`;
            visualRect.style.height = `${visualH}px`;
            visualDimLabel.innerText = `${width} x ${height} ${window.vinylCalc.unitMode}`;
            if (visualQtyLabel) visualQtyLabel.innerText = `${qty} ${qty === 1 ? 'pieza' : 'piezas'} (${res.totalNetAreaM2} m²)`;
        }

        this.lastVinylCalcResult = res;
    }

    addVinylToCurrentQuote() {
        if (!this.lastVinylCalcResult || this.lastVinylCalcResult.totalNetAreaM2 <= 0) {
            this.showToast('Por favor introduce medidas válidas mayores a cero.', 'warning');
            return;
        }

        const customTitle = document.getElementById('vinyl-custom-title-input')?.value || '';
        const item = window.vinylCalc.createQuoteItemFromCalc(this.lastVinylCalcResult, customTitle);
        window.cotizador.addVinylItem(item);

        this.renderQuoteDraft();
        this.switchTab('tab-cotizador');
        this.showToast('¡Cálculo de vinilo agregado a la cotización!', 'success');

        if (window.confetti) {
            window.confetti({ particleCount: 40, spread: 60, origin: { y: 0.85 } });
        }
    }

    // ==========================================
    // CREADOR Y GESTOR DE COTIZACIONES
    // ==========================================
    renderQuoteDraft() {
        const q = window.cotizador.currentQuote;
        const profile = window.db.getProfile();
        const currency = profile.currency || '$';
        const taxRateVal = profile.taxRate !== undefined ? profile.taxRate : 19;

        document.getElementById('quote-client-name').value = q.client?.name || '';
        document.getElementById('quote-client-rut').value = q.client?.rut || '';
        document.getElementById('quote-client-contact').value = q.client?.contact || '';
        document.getElementById('quote-client-phone').value = q.client?.phone || '';
        document.getElementById('quote-client-email').value = q.client?.email || '';
        document.getElementById('quote-client-address').value = q.client?.address || '';
        document.getElementById('quote-number-input').value = q.quoteNumber || '';
        document.getElementById('quote-date-input').value = q.date || '';
        document.getElementById('quote-valid-until-input').value = q.validUntil || '';
        document.getElementById('quote-status-select').value = q.status || 'Borrador';
        document.getElementById('quote-notes-input').value = q.notes || '';
        document.getElementById('quote-discount-input').value = q.discountPercentage || 0;

        document.getElementById('quote-currency-badge').innerText = `${currency} ${profile.currencyCode || 'USD'}`;
        document.getElementById('quote-tax-badge').innerText = `${taxRateVal}%`;
        document.getElementById('quote-tax-rate-label').innerText = `(${taxRateVal}%)`;
        document.getElementById('quote-tax-toggle').checked = profile.enableTax;

        const tbody = document.getElementById('quote-items-tbody');
        const emptyState = document.getElementById('quote-empty-state');
        const badgeCount = document.getElementById('draft-item-count-badge');

        if (q.items.length === 0) {
            tbody.innerHTML = '';
            emptyState.classList.remove('hidden');
            badgeCount.classList.add('hidden');
        } else {
            emptyState.classList.add('hidden');
            badgeCount.classList.remove('hidden');
            badgeCount.innerText = q.items.length;

            tbody.innerHTML = q.items.map((item, idx) => `
                <tr class="hover:bg-slate-50/70 transition-colors">
                    <td class="py-3 px-3 text-center font-bold text-slate-400 text-xs">${idx + 1}</td>
                    <td class="py-3 px-3">
                        <div class="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                            ${item.isVinyl ? '<span class="text-cyan-600 text-xs font-bold">📐 [Vinilo]</span>' : ''}
                            ${this.escapeHTML(item.name)}
                        </div>
                        ${item.notes ? `<div class="text-xs text-slate-400 mt-0.5">${this.escapeHTML(item.notes)}</div>` : ''}
                    </td>
                    <td class="py-3 px-3 text-center text-xs font-mono text-slate-600 font-medium">
                        ${currency} ${(parseFloat(item.costPrice) || 0).toFixed(2)}
                    </td>
                    <td class="py-3 px-3 text-center">
                        <div class="inline-flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-200">
                            <input type="number" step="1" value="${item.margin}" onchange="app.changeItemMargin(${idx}, this.value)" 
                                class="w-10 text-xs text-center font-black text-indigo-700 bg-transparent outline-none" />
                            <span class="text-[10px] font-bold text-indigo-400">%</span>
                        </div>
                    </td>
                    <td class="py-3 px-3 text-center">
                        <div class="inline-flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200">
                            <button type="button" onclick="app.adjustItemQty(${idx}, -1)" class="w-6 h-6 flex items-center justify-center text-slate-500 hover:bg-white rounded-lg transition-colors font-bold text-sm">-</button>
                            <input type="number" min="1" value="${item.quantity}" onchange="app.changeItemQty(${idx}, this.value)" 
                                class="w-12 text-xs text-center font-black text-slate-800 bg-transparent outline-none" />
                            <button type="button" onclick="app.adjustItemQty(${idx}, 1)" class="w-6 h-6 flex items-center justify-center text-slate-500 hover:bg-white rounded-lg transition-colors font-bold text-sm">+</button>
                        </div>
                    </td>
                    <td class="py-3 px-3 text-right">
                        <div class="text-xs font-bold font-mono text-slate-700">
                            ${currency} ${(parseFloat(item.unitPrice) || 0).toFixed(2)}
                        </div>
                    </td>
                    <td class="py-3 px-3 text-right">
                        <div class="text-sm font-black font-mono text-indigo-700">
                            ${currency} ${(parseFloat(item.total) || 0).toFixed(2)}
                        </div>
                    </td>
                    <td class="py-3 px-3 text-center">
                        <button onclick="app.removeQuoteItem(${idx})" class="p-1 text-slate-300 hover:text-rose-600 rounded-lg transition-colors" title="Eliminar ítem">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        }

        window.cotizador.recalculateTotals();
        this.updateQuoteTotalsDisplay();
        if (window.lucide) window.lucide.createIcons();
    }

    syncQuoteHeaderFromUI() {
        const q = window.cotizador.currentQuote;
        if (!q.client) q.client = {};
        q.client.name = document.getElementById('quote-client-name')?.value || '';
        q.client.rut = document.getElementById('quote-client-rut')?.value || '';
        q.client.contact = document.getElementById('quote-client-contact')?.value || '';
        q.client.phone = document.getElementById('quote-client-phone')?.value || '';
        q.client.email = document.getElementById('quote-client-email')?.value || '';
        q.client.address = document.getElementById('quote-client-address')?.value || '';
        q.quoteNumber = document.getElementById('quote-number-input')?.value || '';
        q.date = document.getElementById('quote-date-input')?.value || '';
        q.validUntil = document.getElementById('quote-valid-until-input')?.value || '';
        q.status = document.getElementById('quote-status-select')?.value || 'Borrador';
        q.notes = document.getElementById('quote-notes-input')?.value || '';
    }

    updateQuoteTotalsDisplay() {
        const q = window.cotizador.currentQuote;
        const profile = window.db.getProfile();
        const currency = profile.currency || '$';

        document.getElementById('quote-subtotal-display').innerText = `${currency} ${q.subtotal.toFixed(2)}`;
        document.getElementById('quote-discount-display').innerText = `-${currency} ${q.discountAmount.toFixed(2)}`;
        document.getElementById('quote-tax-display').innerText = `${currency} ${q.taxAmount.toFixed(2)}`;
        document.getElementById('quote-total-display').innerText = `${currency} ${q.total.toFixed(2)}`;
    }

    adjustItemQty(index, delta) {
        const item = window.cotizador.currentQuote.items[index];
        if (item) {
            const newQty = Math.max(1, item.quantity + delta);
            window.cotizador.updateItemQuantity(index, newQty);
            this.renderQuoteDraft();
        }
    }

    changeItemQty(index, val) {
        const newQty = Math.max(1, parseInt(val, 10) || 1);
        window.cotizador.updateItemQuantity(index, newQty);
        this.renderQuoteDraft();
    }

    changeItemMargin(index, val) {
        const margin = parseFloat(val) || 0;
        window.cotizador.updateItemMargin(index, margin);
        this.renderQuoteDraft();
    }

    removeQuoteItem(index) {
        window.cotizador.removeItem(index);
        this.renderQuoteDraft();
        this.showToast('Ítem eliminado de la cotización.', 'info');
    }

    startNewQuote() {
        window.cotizador.resetDraft();
        this.renderQuoteDraft();
        this.switchTab('tab-cotizador');
        this.showToast('Nueva cotización iniciada.', 'info');
    }

    saveCurrentQuote(showToastAlert = true) {
        this.syncQuoteHeaderFromUI();
        if (window.cotizador.currentQuote.items.length === 0) {
            this.showToast('Agrega al menos un ítem o producto antes de guardar.', 'warning');
            return false;
        }

        const saved = window.cotizador.saveCurrentQuote();
        this.renderHistory();
        if (showToastAlert) {
            this.showToast(`Cotización ${saved.quoteNumber} guardada exitosamente.`, 'success');
            if (window.confetti && saved.status === 'Aprobada') {
                window.confetti({ particleCount: 50, spread: 70 });
            }
        }
        return true;
    }

    // ==========================================
    // VISTA PREVIA Y EXPORTACIÓN PDF / EMAIL / WA
    // ==========================================
    previewCurrentPDF() {
        this.syncQuoteHeaderFromUI();
        window.cotizador.recalculateTotals();
        const quote = window.cotizador.currentQuote;
        const profile = window.db.getProfile();

        const html = window.pdfGenerator.generateHTML(quote, profile);
        document.getElementById('pdf-preview-render-area').innerHTML = html;
        this.openModal('modal-pdf-preview');
        if (window.lucide) window.lucide.createIcons();
    }

    downloadCurrentPDF() {
        this.syncQuoteHeaderFromUI();
        window.cotizador.recalculateTotals();
        const quote = window.cotizador.currentQuote;
        const profile = window.db.getProfile();

        this.showToast('Generando documento PDF en tamaño Carta...', 'info');
        window.pdfGenerator.downloadPDF(quote, profile);
    }

    async sendByEmail() {
        this.syncQuoteHeaderFromUI();
        window.cotizador.recalculateTotals();
        const quote = window.cotizador.currentQuote;
        const profile = window.db.getProfile();
        this.showToast('Preparando envío por correo con PDF adjunto...', 'info');
        await window.pdfGenerator.prepareEmailWithAttachment(quote, profile);
    }

    async sendByWhatsApp() {
        this.syncQuoteHeaderFromUI();
        window.cotizador.recalculateTotals();
        const quote = window.cotizador.currentQuote;
        const profile = window.db.getProfile();
        this.showToast('Preparando envío por WhatsApp con PDF...', 'info');
        await window.pdfGenerator.prepareWhatsAppWithAttachment(quote, profile);
    }

    // ==========================================
    // HISTORIAL DE COTIZACIONES
    // ==========================================
    renderHistory() {
        const quotes = window.db.getQuotes();
        const profile = window.db.getProfile();
        const currency = profile.currency || '$';

        const totalCount = quotes.length;
        const approvedQuotes = quotes.filter(q => q.status === 'Aprobada');
        const sentQuotes = quotes.filter(q => q.status === 'Enviada');
        const approvedTotalAmount = approvedQuotes.reduce((acc, q) => acc + (parseFloat(q.total) || 0), 0);

        document.getElementById('metric-total-quotes').innerText = totalCount;
        document.getElementById('metric-approved-quotes').innerText = approvedQuotes.length;
        document.getElementById('metric-sent-quotes').innerText = sentQuotes.length;
        document.getElementById('metric-approved-amount').innerText = `${currency} ${approvedTotalAmount.toFixed(2)}`;

        const query = (document.getElementById('history-search-input')?.value || '').toLowerCase();
        const statusFilter = document.getElementById('history-status-filter')?.value || 'todos';

        const filtered = quotes.filter(q => {
            const matchQuery = !query || 
                (q.quoteNumber || '').toLowerCase().includes(query) ||
                (q.client?.name || '').toLowerCase().includes(query) ||
                (q.client?.rut || '').toLowerCase().includes(query) ||
                (q.date || '').toLowerCase().includes(query);
            
            const matchStatus = statusFilter === 'todos' || q.status === statusFilter;
            return matchQuery && matchStatus;
        });

        const tbody = document.getElementById('history-quotes-tbody');
        if (!tbody) return;

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="py-8 text-center text-xs text-slate-400">
                        No se encontraron cotizaciones con los filtros aplicados.
                    </td>
                </tr>
            `;
            return;
        }

        const statusBadges = {
            'Borrador': 'bg-amber-50 text-amber-700 border-amber-200',
            'Enviada': 'bg-blue-50 text-blue-700 border-blue-200',
            'Aprobada': 'bg-emerald-50 text-emerald-700 border-emerald-200',
            'Rechazada': 'bg-rose-50 text-rose-700 border-rose-200'
        };

        tbody.innerHTML = filtered.map(q => `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="py-3 px-3 font-mono font-bold text-xs text-indigo-700">${q.quoteNumber}</td>
                <td class="py-3 px-3">
                    <div class="font-bold text-slate-800 text-sm">${this.escapeHTML(q.client?.name || 'Cliente Particular')}</div>
                    <div class="text-[11px] text-slate-400">
                        ${q.client?.rut ? `<span class="font-mono text-indigo-600 font-bold">RUT: ${this.escapeHTML(q.client.rut)}</span> • ` : ''}
                        ${q.client?.phone ? this.escapeHTML(q.client.phone) : ''}
                    </div>
                </td>
                <td class="py-3 px-3 text-center text-xs text-slate-500 font-medium">${q.date || '-'}</td>
                <td class="py-3 px-3 text-center text-xs font-bold text-slate-700">${q.items.length}</td>
                <td class="py-3 px-3 text-center">
                    <span class="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${statusBadges[q.status] || 'bg-slate-100 text-slate-700'}">
                        ${q.status}
                    </span>
                </td>
                <td class="py-3 px-3 text-right font-mono font-bold text-sm text-slate-900">${currency} ${(parseFloat(q.total) || 0).toFixed(2)}</td>
                <td class="py-3 px-3 text-center">
                    <div class="flex items-center justify-center gap-1">
                        <button onclick="app.loadQuoteToEditor('${q.id}')" class="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Editar / Abrir">
                            <i data-lucide="edit-3" class="w-4 h-4"></i>
                        </button>
                        <button onclick="app.previewQuoteById('${q.id}')" class="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors" title="Ver / Descargar PDF">
                            <i data-lucide="file-text" class="w-4 h-4"></i>
                        </button>
                        <button onclick="app.duplicateQuoteById('${q.id}')" class="p-1.5 text-slate-500 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors" title="Duplicar como Nueva">
                            <i data-lucide="copy" class="w-4 h-4"></i>
                        </button>
                        <button onclick="app.deleteQuoteById('${q.id}')" class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Eliminar">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        if (window.lucide) window.lucide.createIcons();
    }

    loadQuoteToEditor(id) {
        const loaded = window.cotizador.loadQuote(id);
        if (loaded) {
            this.renderQuoteDraft();
            this.switchTab('tab-cotizador');
            this.showToast(`Cotización ${loaded.quoteNumber} cargada en el editor.`, 'info');
        }
    }

    duplicateQuoteById(id) {
        const dup = window.cotizador.duplicateQuote(id);
        if (dup) {
            this.renderQuoteDraft();
            this.switchTab('tab-cotizador');
            this.showToast(`Copia creada como ${dup.quoteNumber}.`, 'success');
        }
    }

    previewQuoteById(id) {
        const q = window.db.getQuoteById(id);
        if (q) {
            const profile = window.db.getProfile();
            const html = window.pdfGenerator.generateHTML(q, profile);
            document.getElementById('pdf-preview-render-area').innerHTML = html;
            this.openModal('modal-pdf-preview');
            if (window.lucide) window.lucide.createIcons();
        }
    }

    deleteQuoteById(id) {
        if (confirm('¿Estás seguro de eliminar esta cotización del historial?')) {
            window.db.deleteQuote(id);
            this.renderHistory();
            this.showToast('Cotización eliminada.', 'info');
        }
    }

    // ==========================================
    // CATÁLOGO DE PRODUCTOS & PROVEEDORES
    // ==========================================
    renderProducts() {
        const products = window.db.getProducts();
        const suppliers = window.db.getSuppliers();
        const profile = window.db.getProfile();
        const currency = profile.currency || '$';

        const query = (document.getElementById('products-search-input')?.value || '').toLowerCase();
        const catFilter = document.getElementById('products-category-filter')?.value || 'todas';

        const filtered = products.filter(p => {
            const matchQ = !query || 
                (p.name || '').toLowerCase().includes(query) ||
                (p.sku || '').toLowerCase().includes(query) ||
                (p.category || '').toLowerCase().includes(query);
            const matchC = catFilter === 'todas' || p.category === catFilter;
            return matchQ && matchC;
        });

        const tbody = document.getElementById('products-tbody');
        if (!tbody) return;

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="py-8 text-center text-xs text-slate-400">
                        No hay productos registrados con este criterio.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filtered.map(p => {
            const sup = suppliers.find(s => s.id === p.supplierId || s.name === p.supplierId);
            const margin = window.db.getMarginForQuantity(p, 1);
            const cost1u = window.db.getCostForQuantity(p, 1);
            const salePrice = window.db.calculateSalePrice(cost1u, margin);
            const hasTiers = p.costTiers && p.costTiers.length > 0;

            return `
                <tr class="hover:bg-slate-50 transition-colors">
                    <td class="py-3 px-3 font-mono text-xs font-bold text-indigo-700">${p.sku || '-'}</td>
                    <td class="py-3 px-3">
                        <div class="font-bold text-slate-800 text-sm">${this.escapeHTML(p.name)}</div>
                        <div class="flex items-center gap-1.5 mt-0.5">
                            <span class="inline-block px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-600 rounded-md">${p.category || 'General'}</span>
                            ${hasTiers ? `<span class="inline-block px-1.5 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded">Escala x Cantidad (${p.costTiers.length} rangos)</span>` : ''}
                        </div>
                    </td>
                    <td class="py-3 px-3 text-xs text-slate-600">
                        ${sup ? `<span class="font-semibold text-slate-800">${this.escapeHTML(sup.name)}</span> ${sup.rut ? `<span class="block text-[10px] text-slate-400">RUT: ${this.escapeHTML(sup.rut)}</span>` : ''}` : '<span class="text-slate-400">Sin Asignar</span>'}
                    </td>
                    <td class="py-3 px-3 text-center text-xs text-slate-600">${p.unit || 'Unidad'}</td>
                    <td class="py-3 px-3 text-right font-mono font-bold text-xs text-slate-700">
                        ${currency} ${(parseFloat(cost1u) || 0).toFixed(2)}
                    </td>
                    <td class="py-3 px-3 text-center">
                        <span class="px-2 py-0.5 text-xs font-bold bg-indigo-50 text-indigo-700 rounded-md border border-indigo-100">+${margin}%</span>
                    </td>
                    <td class="py-3 px-3 text-right font-mono font-black text-sm text-emerald-700">${currency} ${salePrice.toFixed(2)}</td>
                    <td class="py-3 px-3 text-center">
                        <div class="flex items-center justify-center gap-1">
                            <button onclick="app.quickAddProductToQuote('${p.id}')" class="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Añadir a Cotización Actual">
                                <i data-lucide="plus-circle" class="w-4 h-4"></i>
                            </button>
                            <button onclick="app.openProductModal('${p.id}')" class="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg" title="Editar">
                                <i data-lucide="edit" class="w-4 h-4"></i>
                            </button>
                            <button onclick="app.deleteProduct('${p.id}')" class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg" title="Eliminar">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        if (window.lucide) window.lucide.createIcons();
    }

    renderSuppliers() {
        const suppliers = window.db.getSuppliers();
        const products = window.db.getProducts();
        const grid = document.getElementById('suppliers-cards-grid');
        if (!grid) return;

        if (suppliers.length === 0) {
            grid.innerHTML = `<div class="col-span-3 text-center py-8 text-xs text-slate-400">No hay proveedores registrados aún.</div>`;
            return;
        }

        grid.innerHTML = suppliers.map(s => {
            const count = products.filter(p => p.supplierId === s.id || p.supplierId === s.name).length;
            return `
                <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200 hover:border-indigo-300 transition-all flex flex-col justify-between space-y-3">
                    <div>
                        <div class="flex items-start justify-between">
                            <div>
                                <h4 class="font-bold text-sm text-slate-900 leading-snug">${this.escapeHTML(s.name)}</h4>
                                ${s.rut ? `<span class="inline-block font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded mt-0.5">RUT: ${this.escapeHTML(s.rut)}</span>` : ''}
                            </div>
                            <span class="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">${count} productos</span>
                        </div>
                        <span class="text-[11px] text-indigo-600 font-semibold mt-1 block">${this.escapeHTML(s.category || 'General')}</span>
                        <div class="text-xs text-slate-500 space-y-1 mt-2">
                            ${s.contact ? `<p class="flex items-center gap-1.5"><i data-lucide="user" class="w-3.5 h-3.5"></i> ${this.escapeHTML(s.contact)}</p>` : ''}
                            ${s.phone ? `<p class="flex items-center gap-1.5"><i data-lucide="phone" class="w-3.5 h-3.5"></i> ${this.escapeHTML(s.phone)}</p>` : ''}
                            ${s.email ? `<p class="flex items-center gap-1.5 truncate"><i data-lucide="mail" class="w-3.5 h-3.5"></i> ${this.escapeHTML(s.email)}</p>` : ''}
                        </div>
                        ${s.notes ? `<p class="text-[11px] text-slate-500 bg-white p-2 rounded-lg border border-slate-200/60 mt-2 italic">${this.escapeHTML(s.notes)}</p>` : ''}
                    </div>

                    <div class="flex justify-end gap-1 pt-2 border-t border-slate-200">
                        <button onclick="app.openSupplierModal('${s.id}')" class="px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg">Editar</button>
                        <button onclick="app.deleteSupplier('${s.id}')" class="px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg">Eliminar</button>
                    </div>
                </div>
            `;
        }).join('');

        if (window.lucide) window.lucide.createIcons();
    }

    quickAddProductToQuote(productId) {
        const added = window.cotizador.addProductItem(productId, 1);
        if (added) {
            this.renderQuoteDraft();
            this.showToast(`"${added.name}" agregado a la cotización actual.`, 'success');
        }
    }

    openAddProductModal() {
        this.filterModalProducts();
        this.openModal('modal-add-product');
    }

    filterModalProducts() {
        const query = (document.getElementById('modal-search-product-input')?.value || '').toLowerCase();
        const products = window.db.getProducts();
        const profile = window.db.getProfile();
        const currency = profile.currency || '$';

        const filtered = products.filter(p => !query || 
            (p.name || '').toLowerCase().includes(query) ||
            (p.sku || '').toLowerCase().includes(query) ||
            (p.category || '').toLowerCase().includes(query));

        const container = document.getElementById('modal-products-list-container');
        if (!container) return;

        if (filtered.length === 0) {
            container.innerHTML = `<p class="text-center py-6 text-xs text-slate-400">No se encontraron productos.</p>`;
            return;
        }

        container.innerHTML = filtered.map(p => {
            const cost1u = window.db.getCostForQuantity(p, 1);
            const margin = window.db.getMarginForQuantity(p, 1);
            const salePrice = window.db.calculateSalePrice(cost1u, margin);

            return `
                <div class="p-3 bg-slate-50 hover:bg-indigo-50/50 rounded-xl border border-slate-200 flex items-center justify-between transition-colors">
                    <div>
                        <span class="font-mono text-[10px] font-bold text-indigo-600">${p.sku || 'N/A'}</span>
                        <h5 class="text-xs font-bold text-slate-800">${this.escapeHTML(p.name)}</h5>
                        <p class="text-[11px] text-slate-500 mt-0.5">Costo: ${currency}${cost1u.toFixed(2)} | Margen: +${margin}% | <span class="font-bold text-indigo-700">Venta: ${currency}${salePrice.toFixed(2)}</span></p>
                    </div>
                    <button onclick="app.addProductFromModal('${p.id}')" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm">
                        + Agregar
                    </button>
                </div>
            `;
        }).join('');
    }

    addProductFromModal(productId) {
        window.cotizador.addProductItem(productId, 1);
        this.renderQuoteDraft();
        this.closeModal('modal-add-product');
        this.showToast('Producto agregado a la cotización.', 'success');
    }

    openAddCustomItemModal() {
        document.getElementById('custom-item-name').value = '';
        document.getElementById('custom-item-unit').value = 'Servicio';
        document.getElementById('custom-item-qty').value = '1';
        document.getElementById('custom-item-cost').value = '10';
        document.getElementById('custom-item-margin').value = '50';
        document.getElementById('custom-item-notes').value = '';
        this.openModal('modal-add-custom-item');
    }

    submitCustomItem() {
        const name = document.getElementById('custom-item-name').value.trim();
        const unit = document.getElementById('custom-item-unit').value.trim();
        const qty = parseInt(document.getElementById('custom-item-qty').value, 10) || 1;
        const cost = parseFloat(document.getElementById('custom-item-cost').value) || 0;
        const margin = parseFloat(document.getElementById('custom-item-margin').value) || 0;
        const notes = document.getElementById('custom-item-notes').value.trim();

        if (!name) {
            this.showToast('Por favor escribe el nombre o concepto del ítem.', 'warning');
            return;
        }

        window.cotizador.addCustomItem(name, unit, cost, margin, qty, notes);
        this.renderQuoteDraft();
        this.closeModal('modal-add-custom-item');
        this.showToast('Ítem libre agregado a la cotización.', 'success');
    }

    // Modal Crear/Editar Producto
    openProductModal(id = null) {
        this.renderCategoriesDataLists();
        this.renderSuppliersDataList();
        const suppliers = window.db.getSuppliers();
        const container = document.getElementById('cost-tiers-rows-container');
        container.innerHTML = '';

        if (id) {
            const p = window.db.getProductById(id);
            if (!p) return;
            document.getElementById('product-modal-title').innerText = 'Editar Producto / Insumo';
            document.getElementById('prod-form-id').value = p.id;
            document.getElementById('prod-form-sku').value = p.sku || '';
            document.getElementById('prod-form-name').value = p.name || '';
            
            const matchedSup = suppliers.find(s => s.id === p.supplierId);
            document.getElementById('prod-form-supplier-input').value = matchedSup ? matchedSup.name : (p.supplierId || '');
            document.getElementById('prod-form-category-input').value = p.category || 'Vinilos';
            document.getElementById('prod-form-unit').value = p.unit || 'Unidad';
            document.getElementById('prod-form-cost').value = p.costPrice || 0;
            document.getElementById('prod-form-margin').value = p.defaultMargin || 50;
            document.getElementById('prod-form-notes').value = p.notes || '';

            if (p.costTiers && p.costTiers.length > 0) {
                p.costTiers.forEach(t => this.addCostTierRow(t.min, t.max, t.cost));
            }
        } else {
            document.getElementById('product-modal-title').innerText = 'Nuevo Producto / Insumo';
            document.getElementById('prod-form-id').value = '';
            document.getElementById('prod-form-sku').value = 'PROD-' + Math.floor(Math.random() * 900 + 100);
            document.getElementById('prod-form-name').value = '';
            document.getElementById('prod-form-supplier-input').value = suppliers[0]?.name || '';
            document.getElementById('prod-form-category-input').value = 'Vinilos';
            document.getElementById('prod-form-unit').value = 'Unidad';
            document.getElementById('prod-form-cost').value = '5.00';
            document.getElementById('prod-form-margin').value = '50';
            document.getElementById('prod-form-notes').value = '';
        }
        this.openModal('modal-edit-product');
    }

    addCostTierRow(min = 1, max = 10, cost = '') {
        const container = document.getElementById('cost-tiers-rows-container');
        if (!container) return;

        const row = document.createElement('div');
        row.className = 'cost-tier-row grid grid-cols-12 gap-2 items-center';
        row.innerHTML = `
            <div class="col-span-3">
                <input type="number" min="1" value="${min}" placeholder="Min" class="tier-min w-full px-2 py-1 text-xs text-center font-bold bg-white border border-slate-200 rounded-lg outline-none" />
            </div>
            <div class="col-span-1 text-center text-xs text-slate-400 font-bold">a</div>
            <div class="col-span-3">
                <input type="number" min="1" value="${max === 999999 ? '' : max}" placeholder="Max (+)" class="tier-max w-full px-2 py-1 text-xs text-center font-bold bg-white border border-slate-200 rounded-lg outline-none" />
            </div>
            <div class="col-span-4">
                <div class="relative">
                    <span class="absolute left-2 top-1 text-xs text-slate-400">$</span>
                    <input type="number" step="0.01" value="${cost}" placeholder="Costo" class="tier-cost w-full pl-5 pr-2 py-1 text-xs font-bold text-indigo-700 bg-white border border-indigo-200 rounded-lg outline-none" />
                </div>
            </div>
            <div class="col-span-1 text-center">
                <button type="button" onclick="this.closest('.cost-tier-row').remove()" class="text-rose-500 hover:text-rose-700 p-1">
                    <i data-lucide="x" class="w-3.5 h-3.5"></i>
                </button>
            </div>
        `;
        container.appendChild(row);
        if (window.lucide) window.lucide.createIcons();
    }

    submitProductForm() {
        const id = document.getElementById('prod-form-id').value;
        const name = document.getElementById('prod-form-name').value.trim();
        const sku = document.getElementById('prod-form-sku').value.trim();
        const supplierName = document.getElementById('prod-form-supplier-input').value.trim();
        const category = document.getElementById('prod-form-category-input').value.trim() || 'General';
        const unit = document.getElementById('prod-form-unit').value.trim();
        const costPrice = parseFloat(document.getElementById('prod-form-cost').value) || 0;
        const defaultMargin = parseFloat(document.getElementById('prod-form-margin').value) || 50;
        const notes = document.getElementById('prod-form-notes').value.trim();

        if (!name) {
            this.showToast('Por favor escribe el nombre del producto.', 'warning');
            return;
        }

        const suppliers = window.db.getSuppliers();
        const matchedSup = suppliers.find(s => s.name.toLowerCase() === supplierName.toLowerCase());
        const supplierId = matchedSup ? matchedSup.id : (supplierName || 'sup_1');

        const costTiers = [];
        document.querySelectorAll('.cost-tier-row').forEach(row => {
            const min = parseInt(row.querySelector('.tier-min')?.value, 10) || 1;
            const maxVal = row.querySelector('.tier-max')?.value;
            const max = maxVal ? parseInt(maxVal, 10) : 999999;
            const cost = parseFloat(row.querySelector('.tier-cost')?.value);
            if (!isNaN(cost) && cost >= 0) {
                costTiers.push({ min, max, cost });
            }
        });
        costTiers.sort((a, b) => a.min - b.min);

        window.db.saveCategory(category);

        const product = {
            id: id || undefined,
            name,
            sku,
            supplierId,
            category,
            unit,
            costPrice,
            costTiers,
            defaultMargin,
            notes,
            useGlobalTiers: true
        };

        window.db.saveProduct(product);
        this.renderCategoriesDataLists();
        this.renderProducts();
        this.closeModal('modal-edit-product');
        this.showToast('Producto guardado correctamente.', 'success');
    }

    deleteProduct(id) {
        if (confirm('¿Deseas eliminar este producto del catálogo?')) {
            window.db.deleteProduct(id);
            this.renderProducts();
            this.showToast('Producto eliminado.', 'info');
        }
    }

    // Modal Crear/Editar Proveedor (Con RUT)
    openSupplierModal(id = null) {
        this.renderCategoriesDataLists();
        if (id) {
            const s = window.db.getSupplierById(id);
            if (!s) return;
            document.getElementById('supplier-modal-title').innerText = 'Editar Proveedor';
            document.getElementById('sup-form-id').value = s.id;
            document.getElementById('sup-form-name').value = s.name || '';
            document.getElementById('sup-form-rut').value = s.rut || '';
            document.getElementById('sup-form-contact').value = s.contact || '';
            document.getElementById('sup-form-phone').value = s.phone || '';
            document.getElementById('sup-form-email').value = s.email || '';
            document.getElementById('sup-form-category').value = s.category || '';
            document.getElementById('sup-form-notes').value = s.notes || '';
        } else {
            document.getElementById('supplier-modal-title').innerText = 'Nuevo Proveedor';
            document.getElementById('sup-form-id').value = '';
            document.getElementById('sup-form-name').value = '';
            document.getElementById('sup-form-rut').value = '';
            document.getElementById('sup-form-contact').value = '';
            document.getElementById('sup-form-phone').value = '';
            document.getElementById('sup-form-email').value = '';
            document.getElementById('sup-form-category').value = '';
            document.getElementById('sup-form-notes').value = '';
        }
        this.openModal('modal-edit-supplier');
    }

    submitSupplierForm() {
        const id = document.getElementById('sup-form-id').value;
        const name = document.getElementById('sup-form-name').value.trim();
        const rut = document.getElementById('sup-form-rut').value.trim();
        const contact = document.getElementById('sup-form-contact').value.trim();
        const phone = document.getElementById('sup-form-phone').value.trim();
        const email = document.getElementById('sup-form-email').value.trim();
        const category = document.getElementById('sup-form-category').value.trim();
        const notes = document.getElementById('sup-form-notes').value.trim();

        if (!name) {
            this.showToast('Por favor escribe el nombre de la empresa proveedora.', 'warning');
            return;
        }

        if (category) window.db.saveCategory(category);

        const supplier = {
            id: id || undefined,
            name,
            rut,
            contact,
            phone,
            email,
            category,
            notes
        };

        window.db.saveSupplier(supplier);
        this.renderSuppliersDataList();
        this.renderSuppliers();
        this.closeModal('modal-edit-supplier');
        this.showToast('Proveedor guardado correctamente.', 'success');
    }

    deleteSupplier(id) {
        if (confirm('¿Deseas eliminar este proveedor?')) {
            window.db.deleteSupplier(id);
            this.renderSuppliersDataList();
            this.renderSuppliers();
            this.showToast('Proveedor eliminado.', 'info');
        }
    }

    // ==========================================
    // CONFIGURACIÓN & PERFIL DE EMPRESA
    // ==========================================
    loadProfileIntoUI() {
        const p = window.db.getProfile();

        document.getElementById('sidebar-company-name').innerText = p.companyName || 'Mi Empresa';
        document.getElementById('mobile-header-title').innerText = p.companyName || 'Cotizador Pro';

        document.getElementById('settings-company-name').value = p.companyName || '';
        document.getElementById('settings-tax-id').value = p.taxId || '';
        document.getElementById('settings-phone').value = p.phone || '';
        document.getElementById('settings-email').value = p.email || '';
        document.getElementById('settings-address').value = p.address || '';
        document.getElementById('settings-currency').value = p.currency || '$';
        document.getElementById('settings-currency-code').value = p.currencyCode || 'USD';
        document.getElementById('settings-tax-rate').value = p.taxRate !== undefined ? p.taxRate : 19;
        document.getElementById('settings-bank-details').value = p.bankDetails || '';
        document.getElementById('settings-terms').value = p.terms || '';

        this.renderLogoPreview(p.logo);
    }

    renderLogoPreview(logoBase64) {
        const box = document.getElementById('logo-preview-box');
        const sidebarLogo = document.getElementById('sidebar-logo-container');
        if (!box) return;

        if (logoBase64) {
            box.innerHTML = `<img src="${logoBase64}" alt="Logo" class="max-h-full max-w-full object-contain" />`;
            if (sidebarLogo) {
                sidebarLogo.innerHTML = `<img src="${logoBase64}" alt="Logo" class="h-full w-full object-cover rounded-xl" />`;
            }
        } else {
            box.innerHTML = `
                <i data-lucide="image" class="w-8 h-8 text-indigo-400 mb-1"></i>
                <span class="text-[10px] text-slate-400 font-medium">Sin Logo</span>
            `;
            if (sidebarLogo) {
                sidebarLogo.innerHTML = `<i data-lucide="calculator" class="w-5 h-5"></i>`;
            }
        }
        if (window.lucide) window.lucide.createIcons();
    }

    handleLogoUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            this.showToast('Por favor selecciona un archivo de imagen válido.', 'warning');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target.result;
            window.db.saveProfile({ logo: base64 });
            this.renderLogoPreview(base64);
            this.showToast('¡Logotipo cargado con éxito!', 'success');
        };
        reader.readAsDataURL(file);
    }

    removeLogo() {
        window.db.saveProfile({ logo: '' });
        this.renderLogoPreview('');
        this.showToast('Logotipo eliminado.', 'info');
    }

    renderGlobalTiersSettings() {
        const tiers = window.db.getGlobalTiers();
        const container = document.getElementById('global-tiers-inputs-container');
        if (!container) return;

        container.innerHTML = tiers.map((t, idx) => `
            <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                <span class="text-[11px] font-bold text-slate-700 block mb-1">${t.label || `Rango ${t.min} - ${t.max}`}</span>
                <div class="flex items-center justify-center gap-1">
                    <span class="text-xs font-bold text-slate-400">+</span>
                    <input type="number" id="global-tier-input-${idx}" value="${t.margin}" 
                        class="w-14 text-center font-black text-indigo-700 bg-white border border-indigo-200 rounded-lg py-1 px-1 text-sm outline-none" />
                    <span class="text-xs font-bold text-indigo-500">%</span>
                </div>
            </div>
        `).join('');
    }

    saveProfileSettings() {
        const companyName = document.getElementById('settings-company-name').value.trim();
        const taxId = document.getElementById('settings-tax-id').value.trim();
        const phone = document.getElementById('settings-phone').value.trim();
        const email = document.getElementById('settings-email').value.trim();
        const address = document.getElementById('settings-address').value.trim();
        const currency = document.getElementById('settings-currency').value.trim() || '$';
        const currencyCode = document.getElementById('settings-currency-code').value.trim() || 'USD';
        const taxRate = parseFloat(document.getElementById('settings-tax-rate').value) || 0;
        const bankDetails = document.getElementById('settings-bank-details').value.trim();
        const terms = document.getElementById('settings-terms').value.trim();

        const tiers = window.db.getGlobalTiers();
        tiers.forEach((t, idx) => {
            const input = document.getElementById(`global-tier-input-${idx}`);
            if (input) t.margin = parseFloat(input.value) || t.margin;
        });
        window.db.saveGlobalTiers(tiers);

        window.db.saveProfile({
            companyName,
            taxId,
            phone,
            email,
            address,
            currency,
            currencyCode,
            taxRate,
            bankDetails,
            terms
        });

        this.loadProfileIntoUI();
        this.renderQuoteDraft();
        this.showToast('Configuración del perfil y escalas guardadas exitosamente.', 'success');
    }

    exportFullBackupJSON() {
        const data = window.db.exportAllData();
        const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
        const dlAnchor = document.createElement('a');
        dlAnchor.setAttribute("href", jsonStr);
        dlAnchor.setAttribute("download", `Respaldo_Cotizador_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(dlAnchor);
        dlAnchor.click();
        dlAnchor.remove();
        this.showToast('Copia de seguridad descargada.', 'success');
    }

    quickBackup() {
        this.exportFullBackupJSON();
    }

    importBackupJSON(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const parsed = JSON.parse(e.target.result);
                window.db.importAllData(parsed);
                this.loadProfileIntoUI();
                this.renderCategoriesDataLists();
                this.renderSuppliersDataList();
                this.renderGlobalTiersSettings();
                this.renderVinylTypeSelectors();
                this.renderProducts();
                this.renderSuppliers();
                this.renderHistory();
                this.renderQuoteDraft();
                this.showToast('¡Respaldo restaurado con éxito!', 'success');
            } catch (err) {
                alert('El archivo seleccionado no tiene un formato JSON válido.');
            }
        };
        reader.readAsText(file);
    }

    resetDataToDefault() {
        if (confirm('¿Deseas restaurar la base de datos a sus valores iniciales de demostración?')) {
            window.db.resetToFactory();
            this.loadProfileIntoUI();
            this.renderCategoriesDataLists();
            this.renderSuppliersDataList();
            this.renderGlobalTiersSettings();
            this.renderVinylTypeSelectors();
            this.renderProducts();
            this.renderSuppliers();
            this.renderHistory();
            this.renderQuoteDraft();
            this.showToast('Datos de fábrica restaurados.', 'info');
        }
    }

    // ==========================================
    // HELPERS DE MODALES & TOASTS
    // ==========================================
    openModal(id) {
        const m = document.getElementById(id);
        if (m) m.classList.remove('hidden');
    }

    closeModal(id) {
        const m = document.getElementById(id);
        if (m) m.classList.add('hidden');
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const colorMap = {
            'success': 'bg-emerald-600 text-white shadow-emerald-500/20',
            'warning': 'bg-amber-500 text-white shadow-amber-500/20',
            'info': 'bg-indigo-600 text-white shadow-indigo-500/20',
            'error': 'bg-rose-600 text-white shadow-rose-500/20'
        };

        const iconMap = {
            'success': 'check-circle',
            'warning': 'alert-triangle',
            'info': 'info',
            'error': 'alert-circle'
        };

        const toast = document.createElement('div');
        toast.className = `${colorMap[type] || colorMap.info} py-3 px-4 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold pointer-events-auto transition-all transform translate-y-2 opacity-0 duration-200`;
        toast.innerHTML = `
            <i data-lucide="${iconMap[type] || 'info'}" class="w-4 h-4 shrink-0"></i>
            <span>${this.escapeHTML(message)}</span>
        `;

        container.appendChild(toast);
        if (window.lucide) window.lucide.createIcons();

        setTimeout(() => {
            toast.classList.remove('translate-y-2', 'opacity-0');
        }, 10);

        setTimeout(() => {
            toast.classList.add('translate-y-2', 'opacity-0');
            setTimeout(() => toast.remove(), 250);
        }, 3500);
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
}

// Inicializar la aplicación cuando el DOM esté listo
window.app = new AppController();
document.addEventListener('DOMContentLoaded', () => {
    window.app.init();
});
