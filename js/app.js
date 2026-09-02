// js/app.js - Controlador Principal de la Aplicación y Eventos de UI
class AppController {
    constructor() {
        this.currentTab = 'tab-cotizador';
        this.catalogSubTab = 'products';
        this.currentUser = null;
        this.lastVinylCalcResult = null;
    }

    init() {
        // Inicializar Tema (Claro / Oscuro)
        this.initTheme();

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

        console.log('Cotizador Pro App Inicializada Correctamente.');
    }

    // ==========================================
    // FIREBASE AUTHENTICATION (LOGIN & LOGOUT)
    // ==========================================
    setupFirebaseAuthListener() {
        const authScreen = document.getElementById('auth-screen');
        const sidebarUserName = document.getElementById('sidebar-user-name');

        if (typeof firebase !== 'undefined' && firebase.auth) {
            firebase.auth().onAuthStateChanged(async (user) => {
                this.currentUser = user;
                if (user) {
                    if (authScreen) {
                        authScreen.style.setProperty('display', 'none', 'important');
                        authScreen.classList.add('hidden');
                    }
                    if (sidebarUserName) sidebarUserName.innerText = user.email || 'Usuario';

                    // ☁️ Sincronizar datos desde Firestore al iniciar sesión
                    if (window.db && typeof window.db.syncFromFirestore === 'function') {
                        await window.db.syncFromFirestore(user.uid);
                        // Re-renderizar la app con los datos recién cargados de la nube
                        if (typeof this.renderAll === 'function') this.renderAll();
                        else {
                            if (typeof this.renderProducts === 'function') this.renderProducts();
                            if (typeof this.renderSuppliers === 'function') this.renderSuppliers();
                            if (typeof this.renderQuotes === 'function') this.renderQuotes();
                        }
                    }
                } else {
                    if (authScreen) {
                        authScreen.style.setProperty('display', 'flex', 'important');
                        authScreen.classList.remove('hidden');
                    }
                    if (sidebarUserName) sidebarUserName.innerText = 'Sin Sesión';
                    // Limpiar UID al cerrar sesión
                    if (window.db) { window.db._uid = null; window.db._firestoreReady = false; }
                }
            });
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
                             'vinyl-roll-width-input', 'vinyl-roll-length-input', 'vinyl-roll-cost-input',
                             'vinyl-cost-m2-input', 'vinyl-labor-m2-input', 'vinyl-waste-input', 'vinyl-margin-input'];
        vinylInputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => {
                    if (id.startsWith('vinyl-roll-')) {
                        this.syncRollToCostM2();
                    } else {
                        this.calculateVinylLive();
                    }
                });
            }
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
            btnProd.className = 'px-4 py-2 text-xs font-bold rounded-full bg-indigo-600 text-white shadow-sm transition-all';
            btnSup.className = 'px-4 py-2 text-xs font-bold rounded-full text-slate-600 hover:bg-slate-200 transition-all';
            viewProd.classList.remove('hidden');
            viewSup.classList.add('hidden');
            this.renderProducts();
        } else {
            btnSup.className = 'px-4 py-2 text-xs font-bold rounded-full bg-indigo-600 text-white shadow-sm transition-all';
            btnProd.className = 'px-4 py-2 text-xs font-bold rounded-full text-slate-600 hover:bg-slate-200 transition-all';
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
                    <button type="button" onclick="app.deleteCategory('${this.escapeHTML(c)}')" class="p-1 text-slate-400 hover:text-rose-600 rounded">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    </button>
                </div>
            `).join('');
        }
    }

    openCategoryManagerModal() {
        this.renderCategoriesDataLists();
        const input = document.getElementById('new-category-input');
        if (input) input.value = '';
        this.openModal('modal-category-manager');
        if (window.lucide) window.lucide.createIcons();
    }

    addNewCategoryFromModal() {
        const input = document.getElementById('new-category-input');
        const name = input ? input.value.trim() : '';
        if (!name) {
            this.showToast('Escribe el nombre de la categoría.', 'warning');
            return;
        }
        window.db.saveCategory(name);
        this.renderCategoriesDataLists();
        this.renderProducts();
        if (input) input.value = '';
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
                            <p class="text-[10px] text-indigo-600 font-semibold mt-0.5">Base: $${window.formatMoney(p.costPerM2, true)}/m² | M.O: $${window.formatMoney(p.laborCostPerM2, true)}</p>
                        </button>
                        <div class="flex items-center gap-1 shrink-0 ml-2">
                            <button type="button" onclick="app.openVinylPresetModal('${p.id}')" class="p-1 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors" title="Editar este tipo">
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

    /**
     * Parsea un número en formato local chileno/español donde:
     *   el punto (.) es separador de miles → 14.000 = 14000
     *   la coma (,) es separador decimal → 14.000,50 = 14000.50
     */
    parseChileanFloat(str) {
        if (str === '' || str === null || str === undefined) return 0;
        const s = String(str).trim();
        // Si tiene coma: punto = miles, coma = decimal
        if (s.includes(',')) {
            return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
        }
        // Si tiene solo puntos: puede ser miles (14.000) o decimal (14.5)
        // Heurística: si la parte después del punto tiene 3 dígitos = miles
        const parts = s.split('.');
        if (parts.length === 2 && parts[1].length === 3) {
            return parseFloat(s.replace('.', '')) || 0; // miles
        }
        return parseFloat(s) || 0;
    }

    /** Llamado al cambiar ancho, largo o precio pagado del pliego */
    onVinylRollChange() {
        const rollW    = parseFloat(document.getElementById('vinyl-roll-width-input')?.value) || 1;
        const rollL    = parseFloat(document.getElementById('vinyl-roll-length-input')?.value) || 1;
        const rollCost = this.parseChileanFloat(document.getElementById('vinyl-roll-cost-input')?.value);

        // Calcular costo por m²
        const areaM2  = (rollW * rollL) / 10000;
        const costM2  = areaM2 > 0 && rollCost > 0 ? rollCost / areaM2 : 0;

        // Actualizar campo oculto y display
        const hiddenInput = document.getElementById('vinyl-cost-m2-input');
        const display     = document.getElementById('vinyl-cost-m2-display');
        const badge       = document.getElementById('vinyl-roll-calc-equivalent');

        if (hiddenInput) hiddenInput.value = costM2.toFixed(4);
        if (display)     display.textContent = `$${this._fmt(costM2, true)}`;
        if (badge)       badge.textContent   = `Costo: $${this._fmt(costM2, true)} / m²`;

        // Recalcular precio venta/m² a partir del margen
        this._recalcVinylSalePriceM2(costM2);
        this.calculateVinylLive();
    }

    /** Cuando el usuario cambia el % ganancia → recalcula precio venta/m² */
    onVinylMarginChange() {
        const costM2 = parseFloat(document.getElementById('vinyl-cost-m2-input')?.value) || 0;
        this._recalcVinylSalePriceM2(costM2);
        this.calculateVinylLive();
    }

    /** Cuando el usuario escribe el precio venta/m² → calcula el % ganancia automáticamente */
    onVinylSalePriceM2Change() {
        const costM2      = parseFloat(document.getElementById('vinyl-cost-m2-input')?.value) || 0;
        const salePriceM2 = parseFloat(document.getElementById('vinyl-sale-price-m2-input')?.value) || 0;
        const marginInp   = document.getElementById('vinyl-margin-input');
        if (!marginInp || costM2 <= 0 || salePriceM2 <= 0) return;
        const margin = ((salePriceM2 / costM2) - 1) * 100;
        marginInp.value = Math.round(margin * 10) / 10;
        this.calculateVinylLive();
    }

    /** Recalcula el campo Precio Venta/m² a partir de costM2 y margin */
    _recalcVinylSalePriceM2(costM2) {
        const margin         = parseFloat(document.getElementById('vinyl-margin-input')?.value) || 0;
        const salePriceInp   = document.getElementById('vinyl-sale-price-m2-input');
        if (!salePriceInp || costM2 <= 0) return;
        salePriceInp.value = (costM2 * (1 + margin / 100)).toFixed(2);
    }

    /** Formatea número con puntos de miles y decimales */
    _fmt(n, forceDecimals = false) {
        return window.formatMoney(n, forceDecimals);
    }

    /** @deprecated — usar onVinylRollChange */
    syncRollToCostM2() { this.onVinylRollChange(); }

    syncPresetCostFromRoll() {
        const rollW = parseFloat(document.getElementById('vinyl-preset-form-roll-w')?.value) || 58;
        const rollL = parseFloat(document.getElementById('vinyl-preset-form-roll-l')?.value) || 100;
        const rollCost = parseFloat(document.getElementById('vinyl-preset-form-roll-cost')?.value) || 0;
        const costM2 = window.vinylCalc.calculateCostPerM2FromRoll(rollW, rollL, rollCost);
        const costInput = document.getElementById('vinyl-preset-form-cost');
        if (costInput && costM2 > 0) costInput.value = costM2.toFixed(2);
    }

    /**
     * Selecciona un preset de vinilo y carga TODOS sus valores en el formulario.
     * Al cambiar de vinilo, los campos se actualizan con los datos guardados de ese vinilo.
     */
    selectVinylPreset(presetId, triggerCalc = true) {
        window.vinylCalc.currentPresetId = presetId;
        const preset = window.vinylCalc.getPreset(presetId);
        if (!preset) return;

        this.renderVinylTypeSelectors();

        // Cargar valores del preset en el formulario
        const set = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined && val !== null) el.value = val; };

        set('vinyl-roll-width-input',  preset.rollWidthCm  || 58);
        set('vinyl-roll-length-input', preset.rollLengthCm || 100);
        set('vinyl-roll-cost-input',   preset.rollCost > 0 ? preset.rollCost : '');
        set('vinyl-labor-m2-input',    preset.laborCostPerM2 || 0);
        set('vinyl-waste-input',       preset.wasteRate     || 10);
        set('vinyl-margin-input',      preset.defaultMargin || 50);

        // Recalcular costo/m² desde los valores cargados
        this.onVinylRollChange();

        if (triggerCalc) this.calculateVinylLive();
    }

    openVinylPresetModal(id = null) {
        const title = document.getElementById('vinyl-modal-title');
        const deleteBtn = document.getElementById('vinyl-preset-delete-btn');

        if (id) {
            const p = window.db.getVinylPresetById(id);
            if (!p) return;
            if (title) title.innerText = 'Editar Tipo de Vinilo';
            document.getElementById('vinyl-preset-form-id').value = p.id;
            document.getElementById('vinyl-preset-form-name').value = p.name || '';
            document.getElementById('vinyl-preset-form-roll-w').value = p.rollWidthCm || 58;
            document.getElementById('vinyl-preset-form-roll-l').value = p.rollLengthCm || 100;
            document.getElementById('vinyl-preset-form-roll-cost').value = p.rollCost || 4.50;
            document.getElementById('vinyl-preset-form-cost').value = p.costPerM2 || 7.76;
            document.getElementById('vinyl-preset-form-labor').value = p.laborCostPerM2 || 0;
            document.getElementById('vinyl-preset-form-waste').value = p.wasteRate || 10;
            document.getElementById('vinyl-preset-form-margin').value = p.defaultMargin || 50;
            document.getElementById('vinyl-preset-form-desc').value = p.description || '';
            if (deleteBtn) deleteBtn.classList.remove('hidden');
        } else {
            if (title) title.innerText = 'Nuevo Tipo de Vinilo / Trabajo';
            document.getElementById('vinyl-preset-form-id').value = '';
            document.getElementById('vinyl-preset-form-name').value = '';
            document.getElementById('vinyl-preset-form-roll-w').value = '58';
            document.getElementById('vinyl-preset-form-roll-l').value = '100';
            document.getElementById('vinyl-preset-form-roll-cost').value = '4.50';
            document.getElementById('vinyl-preset-form-cost').value = '7.76';
            document.getElementById('vinyl-preset-form-labor').value = '4.00';
            document.getElementById('vinyl-preset-form-waste').value = '12';
            document.getElementById('vinyl-preset-form-margin').value = '50';
            document.getElementById('vinyl-preset-form-desc').value = '';
            if (deleteBtn) deleteBtn.classList.add('hidden');
        }

        this.openModal('modal-edit-vinyl-preset');
    }

    submitVinylPresetForm() {
        const id = document.getElementById('vinyl-preset-form-id').value;
        const name = document.getElementById('vinyl-preset-form-name').value.trim();
        const rollWidthCm = parseFloat(document.getElementById('vinyl-preset-form-roll-w').value) || 58;
        const rollLengthCm = parseFloat(document.getElementById('vinyl-preset-form-roll-l').value) || 100;
        const rollCost = parseFloat(document.getElementById('vinyl-preset-form-roll-cost').value) || 4.50;
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
            rollWidthCm,
            rollLengthCm,
            rollCost,
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
            if (btnCm) btnCm.className = 'px-2.5 py-1 text-xs font-bold rounded-lg bg-indigo-600 text-white transition-all';
            if (btnM) btnM.className = 'px-2.5 py-1 text-xs font-bold rounded-lg text-slate-600 hover:text-slate-900 transition-all';
            labels.forEach(l => l.innerText = 'cm');
        } else {
            if (btnM) btnM.className = 'px-2.5 py-1 text-xs font-bold rounded-lg bg-indigo-600 text-white transition-all';
            if (btnCm) btnCm.className = 'px-2.5 py-1 text-xs font-bold rounded-lg text-slate-600 hover:text-slate-900 transition-all';
            labels.forEach(l => l.innerText = 'm');
        }
        this.calculateVinylLive();
    }

    calculateVinylLive() {
        const width       = parseFloat(document.getElementById('vinyl-width-input')?.value) || 0;
        const height      = parseFloat(document.getElementById('vinyl-height-input')?.value) || 0;
        const qty         = parseInt(document.getElementById('vinyl-quantity-input')?.value, 10) || 1;
        const rollWidthCm  = parseFloat(document.getElementById('vinyl-roll-width-input')?.value) || 58;
        const rollLengthCm = parseFloat(document.getElementById('vinyl-roll-length-input')?.value) || 100;
        const rollCost    = this.parseChileanFloat(document.getElementById('vinyl-roll-cost-input')?.value);
        // Usar el costM2 ya calculado por onVinylRollChange (campo oculto)
        const customCost  = parseFloat(document.getElementById('vinyl-cost-m2-input')?.value) || undefined;
        const customLabor = parseFloat(document.getElementById('vinyl-labor-m2-input')?.value);
        const customWaste = parseFloat(document.getElementById('vinyl-waste-input')?.value);
        const customMargin = parseFloat(document.getElementById('vinyl-margin-input')?.value);
        const customTitle  = document.getElementById('vinyl-custom-title-input')?.value || '';

        const res = window.vinylCalc.calculate({
            presetId: window.vinylCalc.currentPresetId,
            width,
            height,
            unitMode: window.vinylCalc.unitMode,
            quantity: qty,
            rollWidthCm,
            rollLengthCm,
            rollCost,
            customCostM2: customCost,
            customLaborM2: customLabor,
            customWaste: customWaste,
            customMargin: customMargin,
            notes: customTitle
        });


        const currency = window.db.getProfile().currency || '$';

        const elBadge = document.getElementById('vinyl-m2-badge');
        const elNet = document.getElementById('calc-net-area-display');
        const elWaste = document.getElementById('calc-waste-rate-display');
        const elGross = document.getElementById('calc-gross-area-display');
        const elMat = document.getElementById('calc-material-cost-display');
        const elLab = document.getElementById('calc-labor-cost-display');
        const elCost = document.getElementById('calc-total-cost-display');
        const elProf = document.getElementById('calc-profit-display');
        const elUnit = document.getElementById('calc-unit-price-display');
        const elSale = document.getElementById('calc-total-sale-display');

        if (elBadge) elBadge.innerText = `${window.formatNumber(res.totalNetAreaM2, 2)} m²`;
        if (elNet) elNet.innerText = `${window.formatNumber(res.totalNetAreaM2, 2)} m² (${qty} unds de ${window.formatNumber(res.unitAreaM2, 2)} m²)`;
        if (elWaste) elWaste.innerText = res.wasteRate;
        if (elGross) elGross.innerText = `${window.formatNumber(res.totalGrossAreaM2, 2)} m²`;
        if (elMat) elMat.innerText = `${currency} ${window.formatMoney(res.materialCostTotal, true)}`;
        if (elLab) elLab.innerText = `${currency} ${window.formatMoney(res.laborCostTotal, true)}`;
        if (elCost) elCost.innerText = `${currency} ${window.formatMoney(res.totalBaseCost, true)}`;
        if (elProf) elProf.innerText = `+${currency} ${window.formatMoney(res.profitAmount, true)} (${res.margin}%)`;
        if (elUnit) elUnit.innerText = `${currency} ${window.formatMoney(res.unitPrice, true)}`;
        if (elSale) elSale.innerText = `${currency} ${window.formatMoney(res.totalSalePrice, true)}`;

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

        const elName = document.getElementById('quote-client-name');
        const elRut = document.getElementById('quote-client-rut');
        const elContact = document.getElementById('quote-client-contact');
        const elPhone = document.getElementById('quote-client-phone');
        const elEmail = document.getElementById('quote-client-email');
        const elAddress = document.getElementById('quote-client-address');
        const elNum = document.getElementById('quote-number-input');
        const elDate = document.getElementById('quote-date-input');
        const elValid = document.getElementById('quote-valid-until-input');
        const elStatus = document.getElementById('quote-status-select');
        const elNotes = document.getElementById('quote-notes-input');
        const elDisc = document.getElementById('quote-discount-input');

        if (elName) elName.value = q.client?.name || '';
        if (elRut) elRut.value = q.client?.rut || '';
        if (elContact) elContact.value = q.client?.contact || '';
        if (elPhone) elPhone.value = q.client?.phone || '';
        if (elEmail) elEmail.value = q.client?.email || '';
        if (elAddress) elAddress.value = q.client?.address || '';
        if (elNum) elNum.value = q.quoteNumber || '';
        if (elDate) elDate.value = q.date || '';
        if (elValid) elValid.value = q.validUntil || '';
        if (elStatus) elStatus.value = q.status || 'Borrador';
        if (elNotes) elNotes.value = q.notes || '';
        if (elDisc) elDisc.value = q.discountPercentage || 0;

        const curBadge = document.getElementById('quote-currency-badge');
        const taxBadge = document.getElementById('quote-tax-badge');
        const taxLabel = document.getElementById('quote-tax-rate-label');
        const taxTog = document.getElementById('quote-tax-toggle');

        if (curBadge) curBadge.innerText = `${currency} ${profile.currencyCode || 'USD'}`;
        if (taxBadge) taxBadge.innerText = `${taxRateVal}%`;
        if (taxLabel) taxLabel.innerText = `(${taxRateVal}%)`;
        if (taxTog) taxTog.checked = profile.enableTax;

        const tbody = document.getElementById('quote-items-tbody');
        const emptyState = document.getElementById('quote-empty-state');
        const badgeCount = document.getElementById('draft-item-count-badge');

        if (tbody) {
            if (q.items.length === 0) {
                tbody.innerHTML = '';
                if (emptyState) emptyState.classList.remove('hidden');
                if (badgeCount) badgeCount.classList.add('hidden');
            } else {
                if (emptyState) emptyState.classList.add('hidden');
                if (badgeCount) {
                    badgeCount.classList.remove('hidden');
                    badgeCount.innerText = q.items.length;
                }

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
                                ${currency} ${window.formatMoney(item.unitPrice, true)}
                            </div>
                        </td>
                        <td class="py-3 px-3 text-right">
                            <div class="text-sm font-black font-mono text-indigo-700">
                                ${currency} ${window.formatMoney(item.total, true)}
                            </div>
                        </td>
                        <td class="py-3 px-3 text-center">
                            <button type="button" onclick="app.removeQuoteItem(${idx})" class="p-1 text-slate-300 hover:text-rose-600 rounded-lg transition-colors" title="Eliminar ítem">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        </td>
                    </tr>
                `).join('');
            }
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

        const elSub = document.getElementById('quote-subtotal-display');
        const elDisc = document.getElementById('quote-discount-display');
        const elTax = document.getElementById('quote-tax-display');
        const elTot = document.getElementById('quote-total-display');

        if (elSub) elSub.innerText = `${currency} ${window.formatMoney(q.subtotal, true)}`;
        if (elDisc) elDisc.innerText = `-${currency} ${window.formatMoney(q.discountAmount, true)}`;
        if (elTax) elTax.innerText = `${currency} ${window.formatMoney(q.taxAmount, true)}`;
        if (elTot) elTot.innerText = `${currency} ${window.formatMoney(q.total, true)}`;
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
        const area = document.getElementById('pdf-preview-render-area');
        if (area) area.innerHTML = html;
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

        const elTot = document.getElementById('metric-total-quotes');
        const elApp = document.getElementById('metric-approved-quotes');
        const elSent = document.getElementById('metric-sent-quotes');
        const elAmt = document.getElementById('metric-approved-amount');

        if (elTot) elTot.innerText = totalCount;
        if (elApp) elApp.innerText = approvedQuotes.length;
        if (elSent) elSent.innerText = sentQuotes.length;
        if (elAmt) elAmt.innerText = `${currency} ${window.formatMoney(approvedTotalAmount, true)}`;

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
                <td class="py-3 px-3 text-right font-mono font-bold text-sm text-slate-900">${currency} ${window.formatMoney(q.total, true)}</td>
                <td class="py-3 px-3 text-center">
                    <div class="flex items-center justify-center gap-1">
                        <button type="button" onclick="app.loadQuoteToEditor('${q.id}')" class="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Editar / Abrir">
                            <i data-lucide="edit-3" class="w-4 h-4"></i>
                        </button>
                        <button type="button" onclick="app.previewQuoteById('${q.id}')" class="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors" title="Ver / Descargar PDF">
                            <i data-lucide="file-text" class="w-4 h-4"></i>
                        </button>
                        <button type="button" onclick="app.duplicateQuoteById('${q.id}')" class="p-1.5 text-slate-500 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors" title="Duplicar como Nueva">
                            <i data-lucide="copy" class="w-4 h-4"></i>
                        </button>
                        <button type="button" onclick="app.deleteQuoteById('${q.id}')" class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Eliminar">
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
            const area = document.getElementById('pdf-preview-render-area');
            if (area) area.innerHTML = html;
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

        // Limpiar barra de selección masiva
        this.clearProductSelection();

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="py-8 text-center text-xs text-slate-400">
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

            // Normalizar imágenes: soporta string (1 imagen) o array (hasta 3)
            let imgs = [];
            if (Array.isArray(p.images) && p.images.length > 0) {
                imgs = p.images.slice(0, 3);
            } else if (p.imageData) {
                imgs = [p.imageData];
            }

            // Guardar imágenes en cache por ID (no se pasan en el onclick para evitar romper comillas)
            if (!this._productImgCache) this._productImgCache = {};
            this._productImgCache[p.id] = imgs;

            const imgThumbsHtml = imgs.length > 0
                ? imgs.map((src, i) => `<img src="${this.escapeHTML(src)}" alt="Img ${i+1}" class="product-img-thumb" onclick="app.openProductLightbox('${p.id}',${i})" onerror="this.style.display='none'" />`).join('')
                : `<div class="w-9 h-9 rounded-lg border border-dashed border-slate-200 bg-slate-50 shrink-0 flex items-center justify-center"><i data-lucide="image" class="w-4 h-4 text-slate-300"></i></div>`;

            return `
                <tr class="hover:bg-slate-50 transition-colors">
                    <td class="py-3 px-3">
                        <input type="checkbox" class="product-row-check w-3.5 h-3.5 rounded accent-indigo-600 cursor-pointer" data-id="${p.id}" onchange="app.onProductRowCheck()" />
                    </td>
                    <td class="py-3 px-3 font-mono text-xs font-bold text-indigo-700">${p.sku || '-'}</td>
                    <td class="py-3 px-3">
                        <div class="flex items-start gap-2.5">
                            <div class="flex gap-1 shrink-0">${imgThumbsHtml}</div>
                            <div>
                                <div class="font-bold text-slate-800 text-sm">${this.escapeHTML(p.name)}</div>
                                <div class="flex flex-wrap items-center gap-1.5 mt-1">
                                    <span class="inline-block px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-600 rounded-md">${p.category || 'General'}</span>
                                    ${hasTiers ? `<span class="inline-block px-1.5 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded">Escala x Cantidad (${p.costTiers.length} rangos)</span>` : ''}
                                    ${p.url ? `<a href="${this.escapeHTML(p.url)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md border border-indigo-200 transition-colors"><i data-lucide="external-link" class="w-3 h-3"></i> Web Proveedor</a>` : ''}
                                </div>
                            </div>
                        </div>
                    </td>
                    <td class="py-3 px-3 text-xs text-slate-600">
                        ${sup ? `<span class="font-semibold text-slate-800">${this.escapeHTML(sup.name)}</span> ${sup.rut ? `<span class="block text-[10px] text-slate-400">RUT: ${this.escapeHTML(sup.rut)}</span>` : ''}` : '<span class="text-slate-400">Sin Asignar</span>'}
                    </td>
                    <td class="py-3 px-3 text-center text-xs text-slate-600">${p.unit || 'Unidad'}</td>
                    <td class="py-3 px-3 text-right font-mono font-bold text-xs text-slate-700 price-col">
                        ${currency} ${window.formatMoney(cost1u, true)}
                    </td>
                    <td class="py-3 px-3 text-center price-col">
                        <span class="px-2 py-0.5 text-xs font-bold bg-indigo-50 text-indigo-700 rounded-md border border-indigo-100">+${margin}%</span>
                    </td>
                    <td class="py-3 px-3 text-right font-mono font-black text-sm text-emerald-700 price-col">${currency} ${window.formatMoney(salePrice, true)}</td>
                    <td class="py-3 px-3 text-center">
                        <div class="flex items-center justify-center gap-1">
                            <button type="button" onclick="app.quickAddProductToQuote('${p.id}')" class="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Añadir a Cotización Actual">
                                <i data-lucide="plus-circle" class="w-4 h-4"></i>
                            </button>
                            <button type="button" onclick="app.openProductModal('${p.id}')" class="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg" title="Editar">
                                <i data-lucide="edit" class="w-4 h-4"></i>
                            </button>
                            <button type="button" onclick="app.deleteProduct('${p.id}')" class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg" title="Eliminar">
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
                        <button type="button" onclick="app.openSupplierModal('${s.id}')" class="px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg">Editar</button>
                        <button type="button" onclick="app.deleteSupplier('${s.id}')" class="px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg">Eliminar</button>
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
                        <p class="text-[11px] text-slate-500 mt-0.5">Costo: ${currency} ${window.formatMoney(cost1u, true)} | Margen: +${margin}% | <span class="font-bold text-indigo-700">Venta: ${currency} ${window.formatMoney(salePrice, true)}</span></p>
                    </div>
                    <button type="button" onclick="app.addProductFromModal('${p.id}')" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm">
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
        if (container) container.innerHTML = '';

        if (id) {
            const p = window.db.getProductById(id);
            if (!p) return;
            const titleEl = document.getElementById('product-modal-title');
            if (titleEl) titleEl.innerText = 'Editar Producto / Insumo';

            document.getElementById('prod-form-id').value = p.id;
            document.getElementById('prod-form-sku').value = p.sku || '';
            document.getElementById('prod-form-name').value = p.name || '';

            const matchedSup = suppliers.find(s => s.id === p.supplierId);
            document.getElementById('prod-form-supplier-input').value = matchedSup ? matchedSup.name : (p.supplierId || '');
            document.getElementById('prod-form-category-input').value = p.category || 'Vinilos';
            document.getElementById('prod-form-unit').value = p.unit || 'Unidad';
            document.getElementById('prod-form-cost').value = p.costPrice || 0;
            document.getElementById('prod-form-margin').value = p.defaultMargin || 50;
            document.getElementById('prod-form-url').value = p.url || '';
            document.getElementById('prod-form-notes').value = p.notes || '';

            // Costo adicional (estampado, sublimación, etc.)
            document.getElementById('prod-form-extra-cost').value = p.extraCost || 0;
            document.getElementById('prod-form-extra-cost-label').value = p.extraCostLabel || '';

            // Precio de venta calculado (incluye costo adicional)
            const cost1u    = parseFloat(p.costPrice) || 0;
            const margin1u  = parseFloat(p.defaultMargin) || 50;
            const extra1u   = parseFloat(p.extraCost) || 0;
            const spEl = document.getElementById('prod-form-sale-price');
            if (spEl) spEl.value = cost1u > 0 ? (cost1u * (1 + margin1u / 100) + extra1u).toFixed(2) : '';

            // Imágenes: soporta array (nuevo) o string (viejo)
            let loadImgs = [];
            if (Array.isArray(p.images) && p.images.length > 0) {
                loadImgs = p.images;
            } else if (p.imageData) {
                loadImgs = [p.imageData];
            }
            document.getElementById('prod-form-image-data').value = loadImgs.length ? JSON.stringify(loadImgs) : '';
            document.getElementById('prod-form-image-file').value = '';
            this._renderProductImageThumbs(loadImgs);

            if (p.costTiers && p.costTiers.length > 0) {
                p.costTiers.forEach(t => this.addCostTierRow(t.min, t.max, t.cost));
            }
        } else {
            const titleEl = document.getElementById('product-modal-title');
            if (titleEl) titleEl.innerText = 'Nuevo Producto / Insumo';

            document.getElementById('prod-form-id').value = '';
            document.getElementById('prod-form-sku').value = 'PROD-' + Math.floor(Math.random() * 900 + 100);
            document.getElementById('prod-form-name').value = '';
            document.getElementById('prod-form-supplier-input').value = suppliers[0]?.name || '';
            document.getElementById('prod-form-category-input').value = 'Vinilos';
            document.getElementById('prod-form-unit').value = 'Unidad';
            document.getElementById('prod-form-cost').value = '5.00';
            document.getElementById('prod-form-margin').value = '50';
            // Precio venta inicial para nuevo producto (5 * 1.5 = 7.50)
            const spElNew = document.getElementById('prod-form-sale-price');
            if (spElNew) spElNew.value = '7.50';
            document.getElementById('prod-form-url').value = '';
            document.getElementById('prod-form-notes').value = '';
            // Costo adicional - limpiar
            document.getElementById('prod-form-extra-cost').value = '0';
            document.getElementById('prod-form-extra-cost-label').value = '';
            // Imagen de referencia - limpiar
            document.getElementById('prod-form-image-data').value = '';
            document.getElementById('prod-form-image-file').value = '';
            this._renderProductImageThumbs([]);
        }
        this._initProductImagePaste();
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
        const url = (document.getElementById('prod-form-url')?.value || '').trim();
        const notes = document.getElementById('prod-form-notes').value.trim();
        // Costo adicional (estampado, sublimación, etc.)
        const extraCost = parseFloat(document.getElementById('prod-form-extra-cost')?.value) || 0;
        const extraCostLabel = (document.getElementById('prod-form-extra-cost-label')?.value || '').trim();
        // Leer imágenes como array (hasta 3)
        const images = this._getProductImagesArray();
        // Compatibilidad retroactiva: imageData = primera imagen si existe
        const imageData = images.length > 0 ? images[0] : '';

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
            url,
            notes,
            extraCost,           // Costo adicional por unidad (estampado, sublimación...)
            extraCostLabel,      // Etiqueta del costo adicional (solo interna)
            images,              // Array de hasta 3 imágenes base64
            imageData,           // Compatibilidad retroactiva (primera imagen)
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

    // ==========================================
    // PRECIO DE VENTA ↔ MARGEN (BIDIRECCIONAL)
    // ==========================================

    /** Recalcula precio de venta cuando cambia el costo o el costo adicional */
    onProductCostChange() {
        const margin = parseFloat(document.getElementById('prod-form-margin')?.value);
        if (!isNaN(margin)) this._recalcSalePrice();
    }

    /** Cuando el usuario cambia el % margen → actualiza el precio de venta */
    onProductMarginChange() {
        this._recalcSalePrice();
    }

    /**
     * Cuando el usuario escribe el precio de venta → calcula el margen automáticamente.
     * El precio de venta incluye el costo adicional, así que se descuenta antes de calcular el margen.
     */
    onProductSalePriceChange() {
        const cost      = parseFloat(document.getElementById('prod-form-cost')?.value) || 0;
        const salePrice = parseFloat(document.getElementById('prod-form-sale-price')?.value) || 0;
        const extraCost = parseFloat(document.getElementById('prod-form-extra-cost')?.value) || 0;
        const marginInp = document.getElementById('prod-form-margin');
        if (!marginInp || salePrice <= 0 || cost <= 0) return;
        // El precio base = precio de venta - costo adicional
        const basePrice = salePrice - extraCost;
        const margin    = ((basePrice / cost) - 1) * 100;
        marginInp.value = Math.round(margin * 10) / 10;
    }

    /**
     * Calcula el precio de venta = (costo × (1 + margen/100)) + costo adicional.
     * El costo adicional va incluido en el precio final al cliente.
     */
    _recalcSalePrice() {
        const cost      = parseFloat(document.getElementById('prod-form-cost')?.value) || 0;
        const margin    = parseFloat(document.getElementById('prod-form-margin')?.value) || 0;
        const extraCost = parseFloat(document.getElementById('prod-form-extra-cost')?.value) || 0;
        const salePriceInp = document.getElementById('prod-form-sale-price');
        if (!salePriceInp || cost <= 0) return;
        const salePrice = cost * (1 + margin / 100) + extraCost;
        salePriceInp.value = salePrice.toFixed(2);
    }


    // ==========================================
    // SELECCIÓN MASIVA Y ELIMINACIÓN MASIVA
    // ==========================================
    toggleSelectAllProducts(checked) {
        const checkboxes = document.querySelectorAll('.product-row-check');
        checkboxes.forEach(cb => { cb.checked = checked; });
        this._updateBulkBar();
    }

    onProductRowCheck() {
        this._updateBulkBar();
        // Sincronizar el "select all"
        const all = document.querySelectorAll('.product-row-check');
        const checked = document.querySelectorAll('.product-row-check:checked');
        const selectAll = document.getElementById('products-select-all');
        if (selectAll) selectAll.checked = all.length > 0 && all.length === checked.length;
    }

    _updateBulkBar() {
        const checked = document.querySelectorAll('.product-row-check:checked');
        const bar = document.getElementById('products-bulk-bar');
        const count = document.getElementById('products-bulk-count');
        if (!bar) return;
        if (checked.length > 0) {
            bar.classList.remove('hidden');
            bar.classList.add('flex');
            if (count) count.textContent = `${checked.length} producto${checked.length > 1 ? 's' : ''} seleccionado${checked.length > 1 ? 's' : ''}`;
        } else {
            bar.classList.add('hidden');
            bar.classList.remove('flex');
        }
    }

    deleteSelectedProducts() {
        const checked = document.querySelectorAll('.product-row-check:checked');
        if (checked.length === 0) return;
        if (!confirm(`¿Eliminar ${checked.length} producto${checked.length > 1 ? 's' : ''} del catálogo? Esta acción no se puede deshacer.`)) return;
        checked.forEach(cb => window.db.deleteProduct(cb.dataset.id));
        this.renderProducts();
        this.showToast(`${checked.length} producto${checked.length > 1 ? 's eliminados' : ' eliminado'}.`, 'info');
    }

    clearProductSelection() {
        document.querySelectorAll('.product-row-check').forEach(cb => { cb.checked = false; });
        const sel = document.getElementById('products-select-all');
        if (sel) sel.checked = false;
        this._updateBulkBar();
    }

    // ==========================================
    // TOGGLE OCULTAR / MOSTRAR PRECIOS
    // ==========================================
    toggleProductPrices() {
        this._pricesHidden = !this._pricesHidden;
        const table = document.querySelector('#products-tbody')?.closest('table');
        const btn = document.getElementById('btn-toggle-prices');
        if (table) table.classList.toggle('prices-hidden', this._pricesHidden);
        if (btn) {
            if (this._pricesHidden) {
                btn.innerHTML = `<i data-lucide="eye" class="w-4 h-4"></i> Mostrar Precios`;
                btn.classList.remove('bg-slate-100', 'text-slate-700');
                btn.classList.add('bg-amber-100', 'text-amber-800');
            } else {
                btn.innerHTML = `<i data-lucide="eye-off" class="w-4 h-4"></i> Ocultar Precios`;
                btn.classList.remove('bg-amber-100', 'text-amber-800');
                btn.classList.add('bg-slate-100', 'text-slate-700');
            }
            if (window.lucide) window.lucide.createIcons();
        }
    }

    // ==========================================
    // LIGHTBOX DE IMÁGENES
    // ==========================================
    _lightboxImages = [];
    _lightboxIndex  = 0;

    /** Abre el lightbox leyendo desde el cache de imágenes por ID de producto */
    openProductLightbox(productId, startIndex = 0) {
        const imgs = (this._productImgCache && this._productImgCache[productId]) || [];
        if (imgs.length === 0) return;
        this.openLightbox(imgs, startIndex, '');
    }

    openLightbox(images, startIndex = 0, label = '') {
        this._lightboxImages = Array.isArray(images) ? images : [images];
        this._lightboxIndex  = startIndex;
        this._renderLightbox(label);
        const lb = document.getElementById('modal-image-lightbox');
        if (lb) { lb.classList.remove('hidden'); lb.classList.add('flex'); }
        if (window.lucide) window.lucide.createIcons();
    }

    closeLightbox() {
        const lb = document.getElementById('modal-image-lightbox');
        if (lb) { lb.classList.add('hidden'); lb.classList.remove('flex'); }
    }

    lightboxNav(dir) {
        this._lightboxIndex = (this._lightboxIndex + dir + this._lightboxImages.length) % this._lightboxImages.length;
        this._renderLightbox();
    }

    _renderLightbox(label = '') {
        const img     = document.getElementById('lightbox-img');
        const counter = document.getElementById('lightbox-counter');
        const lbl     = document.getElementById('lightbox-label');
        const prev    = document.getElementById('lightbox-prev');
        const next    = document.getElementById('lightbox-next');
        const total   = this._lightboxImages.length;
        const src     = this._lightboxImages[this._lightboxIndex];
        if (img) img.src = src;
        if (counter) counter.textContent = total > 1 ? `${this._lightboxIndex + 1} / ${total}` : '1 imagen';
        if (lbl) lbl.textContent = label;
        if (prev) prev.style.visibility = total > 1 ? 'visible' : 'hidden';
        if (next) next.style.visibility = total > 1 ? 'visible' : 'hidden';
    }


    // ==========================================

    /** Inicializa el listener de paste (Ctrl+V) cuando se abre el modal de producto */
    _initProductImagePaste() {
        // Remover listener previo si existe
        if (this._productPasteHandler) {
            document.removeEventListener('paste', this._productPasteHandler);
        }
        this._productPasteHandler = (e) => {
            // Solo actuar si el modal de producto está abierto
            const modal = document.getElementById('modal-edit-product');
            if (!modal || modal.style.display === 'none' || modal.classList.contains('hidden-modal')) return;

            const items = e.clipboardData?.items;
            if (!items) return;

            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    if (file) this._processProductImageFile(file, 'Captura pegada');
                    break;
                }
            }
        };
        document.addEventListener('paste', this._productPasteHandler);
    }

    /** Maneja el drop de imagen sobre la zona */
    handleProductImageDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        const zone = document.getElementById('prod-form-image-dropzone');
        if (zone) zone.classList.remove('border-indigo-400', 'bg-indigo-50');

        const file = event.dataTransfer?.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            this.showToast('Solo se aceptan archivos de imagen.', 'warning');
            return;
        }
        this._processProductImageFile(file, file.name);
    }

    /** Llamado al seleccionar archivo con el input file */
    loadProductImageFile(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            this.showToast('Solo se aceptan archivos de imagen.', 'warning');
            return;
        }
        this._processProductImageFile(file, file.name);
    }

    /** Procesa un archivo de imagen y lo agrega al array (máx 3) */
    _processProductImageFile(file, label = '') {
        const maxMB = 5;
        if (file.size > maxMB * 1024 * 1024) {
            this.showToast(`La imagen supera los ${maxMB} MB.`, 'warning');
            return;
        }
        // Leer array actual
        let imgs = this._getProductImagesArray();
        if (imgs.length >= 3) {
            this.showToast('Máximo 3 imágenes por producto. Elimina una para agregar otra.', 'warning');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            imgs.push(e.target.result);
            document.getElementById('prod-form-image-data').value = JSON.stringify(imgs);
            document.getElementById('prod-form-image-file').value = '';
            this._renderProductImageThumbs(imgs);
            this.showToast(`Imagen ${imgs.length}/3 agregada ✓`, 'success');
        };
        reader.onerror = () => this.showToast('Error leyendo el archivo.', 'error');
        reader.readAsDataURL(file);
    }

    /** Obtiene el array de imágenes del campo oculto */
    _getProductImagesArray() {
        try {
            const raw = document.getElementById('prod-form-image-data')?.value || '';
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
            if (typeof parsed === 'string' && parsed.startsWith('data:')) return [parsed];
            return [];
        } catch {
            const raw = document.getElementById('prod-form-image-data')?.value || '';
            return raw ? [raw] : [];
        }
    }

    /** Limpia TODAS las imágenes */
    clearProductImage() {
        document.getElementById('prod-form-image-data').value = '';
        document.getElementById('prod-form-image-file').value = '';
        this._renderProductImageThumbs([]);
    }

    /** Elimina una imagen del array por índice */
    removeProductImage(index) {
        let imgs = this._getProductImagesArray();
        imgs.splice(index, 1);
        document.getElementById('prod-form-image-data').value = imgs.length ? JSON.stringify(imgs) : '';
        this._renderProductImageThumbs(imgs);
    }



    /**
     * Renderiza las miniaturas de imágenes en el modal de edición.
     * También gestiona la visibilidad del dropzone y el botón "Quitar todo".
     */
    _renderProductImageThumbs(imgs) {
        const thumbsContainer = document.getElementById('prod-form-images-thumbnails');
        const emptyState      = document.getElementById('prod-form-image-empty');
        const singlePreview   = document.getElementById('prod-form-image-preview-container');
        const clearBtn        = document.getElementById('prod-form-image-clear');
        const counter         = document.getElementById('prod-form-images-counter');

        if (!thumbsContainer) return;

        if (!imgs || imgs.length === 0) {
            thumbsContainer.innerHTML = '';
            thumbsContainer.classList.add('hidden');
            if (emptyState)    emptyState.classList.remove('hidden');
            if (singlePreview) singlePreview.classList.add('hidden');
            if (clearBtn)      clearBtn.classList.add('hidden');
            if (counter)       counter.classList.add('hidden');
            return;
        }

        // Mostrar miniaturas
        thumbsContainer.innerHTML = imgs.map((src, i) => `
            <div class="img-thumb-modal">
                <img src="${src}" alt="Imagen ${i+1}" onclick="app.openLightbox(${JSON.stringify(imgs)}, ${i}, 'Imagen ${i+1}')" onerror="this.parentElement.remove()" />
                <button type="button" class="remove-img-btn" onclick="app.removeProductImage(${i})" title="Eliminar imagen">✕</button>
            </div>
        `).join('');
        thumbsContainer.classList.remove('hidden');

        if (emptyState) {
            // Si hay menos de 3, mostrar la dropzone para agregar más
            emptyState.classList.toggle('hidden', imgs.length >= 3);
        }
        if (singlePreview) singlePreview.classList.add('hidden'); // Ya no usamos el preview único
        if (clearBtn)  clearBtn.classList.remove('hidden');
        if (counter) {
            counter.textContent = `${imgs.length}/3 imagen${imgs.length > 1 ? 'es' : ''} — ${imgs.length < 3 ? 'puedes agregar ' + (3 - imgs.length) + ' más' : 'máximo alcanzado'}`;
            counter.classList.remove('hidden');
        }
    }

    /** Muestra u oculta la previsualización (compatibilidad). Ahora delega a _renderProductImageThumbs */
    _showProductImagePreview(src, label = '') {
        let imgs = [];
        if (src && src !== '#') {
            // Si viene de edición: puede ser JSON array o base64 directo
            try {
                const parsed = JSON.parse(src);
                imgs = Array.isArray(parsed) ? parsed : [src];
            } catch {
                imgs = [src];
            }
        }
        this._renderProductImageThumbs(imgs);
    }

    // Función legacy — limpia silenciosamente
    onProductImageError() {
        document.getElementById('prod-form-image-data').value = '';
        this._renderProductImageThumbs([]);
    }

    // Función legacy — ya no se usa

    previewProductImage() {}

    // ==========================================
    // CONTROLADORES DE IMPORTACIÓN MASIVA (EXCEL XLS/XLSX & CSV)

    // ==========================================
    openImportSuppliersModal() {
        this.importedSupplierRows = null;
        const fileInp = document.getElementById('import-suppliers-file-input');
        const txtArea = document.getElementById('import-suppliers-textarea');
        if (fileInp) fileInp.value = '';
        if (txtArea) txtArea.value = '';
        this.openModal('modal-import-suppliers');
    }

    handleSuppliersCSVFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.xlsm');

        const reader = new FileReader();
        if (isExcel && window.XLSX) {
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = window.XLSX.read(data, { type: 'array' });
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1 });
                    this.importedSupplierRows = rows;
                    const txtArea = document.getElementById('import-suppliers-textarea');
                    if (txtArea) {
                        txtArea.value = rows.map(r => r.join(', ')).join('\n');
                    }
                    this.showToast(`Archivo Excel "${file.name}" cargado (${rows.length - 1} filas detectadas).`, 'success');
                } catch (err) {
                    this.showToast('Error al leer el archivo Excel: ' + err.message, 'error');
                }
            };
            reader.readAsArrayBuffer(file);
        } else {
            reader.onload = (e) => {
                const txt = e.target.result;
                this.importedSupplierRows = null;
                const txtArea = document.getElementById('import-suppliers-textarea');
                if (txtArea) txtArea.value = txt;
            };
            reader.readAsText(file);
        }
    }

    submitImportSuppliers() {
        const txtArea = document.getElementById('import-suppliers-textarea');
        const csvText = txtArea ? txtArea.value.trim() : '';
        if (!csvText && !this.importedSupplierRows) {
            this.showToast('Por favor selecciona un archivo Excel (.xlsx / .xls) o pega los datos.', 'warning');
            return;
        }

        try {
            let count = 0;
            if (this.importedSupplierRows && this.importedSupplierRows.length > 1) {
                count = window.db.importSuppliersFromRows(this.importedSupplierRows);
            } else {
                count = window.db.importSuppliersFromCSV(csvText);
            }
            this.renderSuppliers();
            this.renderSuppliersDataList();
            this.renderCategoriesDataLists();
            this.closeModal('modal-import-suppliers');
            this.showToast(`¡Se importaron ${count} proveedores exitosamente desde Excel!`, 'success');
        } catch (err) {
            this.showToast(err.message || 'Error al procesar el archivo Excel.', 'error');
        }
    }

    downloadSuppliersTemplate() {
        window.db.downloadSuppliersTemplateXLS();
        this.showToast('Descargando plantilla Excel de proveedores (.xlsx)...', 'info');
    }

    openImportProductsModal() {
        this.importedProductRows = null;
        const fileInp = document.getElementById('import-products-file-input');
        const txtArea = document.getElementById('import-products-textarea');
        if (fileInp) fileInp.value = '';
        if (txtArea) txtArea.value = '';
        this.openModal('modal-import-products');
    }

    handleProductsCSVFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.xlsm');

        const reader = new FileReader();
        if (isExcel && window.XLSX) {
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = window.XLSX.read(data, { type: 'array' });
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1 });
                    this.importedProductRows = rows;
                    const txtArea = document.getElementById('import-products-textarea');
                    if (txtArea) {
                        txtArea.value = rows.map(r => r.join(', ')).join('\n');
                    }
                    this.showToast(`Archivo Excel "${file.name}" cargado (${rows.length - 1} filas detectadas).`, 'success');
                } catch (err) {
                    this.showToast('Error al leer el archivo Excel: ' + err.message, 'error');
                }
            };
            reader.readAsArrayBuffer(file);
        } else {
            reader.onload = (e) => {
                const txt = e.target.result;
                this.importedProductRows = null;
                const txtArea = document.getElementById('import-products-textarea');
                if (txtArea) txtArea.value = txt;
            };
            reader.readAsText(file);
        }
    }

    submitImportProducts() {
        const txtArea = document.getElementById('import-products-textarea');
        const csvText = txtArea ? txtArea.value.trim() : '';
        if (!csvText && !this.importedProductRows) {
            this.showToast('Por favor selecciona un archivo Excel (.xlsx / .xls) o pega los datos.', 'warning');
            return;
        }

        try {
            let count = 0;
            if (this.importedProductRows && this.importedProductRows.length > 1) {
                count = window.db.importProductsFromRows(this.importedProductRows);
            } else {
                count = window.db.importProductsFromCSV(csvText);
            }
            this.renderProducts();
            this.renderCategoriesDataLists();
            this.closeModal('modal-import-products');
            this.showToast(`¡Se importaron ${count} productos exitosamente desde Excel!`, 'success');
        } catch (err) {
            this.showToast(err.message || 'Error al procesar el archivo Excel.', 'error');
        }
    }

    downloadProductsTemplate() {
        window.db.downloadProductsTemplateXLS();
        this.showToast('Descargando plantilla Excel de productos (.xlsx)...', 'info');
    }

    // Modal Crear/Editar Proveedor (Con RUT)
    openSupplierModal(id = null) {
        this.renderCategoriesDataLists();
        if (id) {
            const s = window.db.getSupplierById(id);
            if (!s) return;
            const titleEl = document.getElementById('supplier-modal-title');
            if (titleEl) titleEl.innerText = 'Editar Proveedor';
            document.getElementById('sup-form-id').value = s.id;
            document.getElementById('sup-form-name').value = s.name || '';
            document.getElementById('sup-form-rut').value = s.rut || '';
            document.getElementById('sup-form-contact').value = s.contact || '';
            document.getElementById('sup-form-phone').value = s.phone || '';
            document.getElementById('sup-form-email').value = s.email || '';
            document.getElementById('sup-form-address').value = s.address || '';
            document.getElementById('sup-form-category').value = s.category || '';
            document.getElementById('sup-form-notes').value = s.notes || '';
        } else {
            const titleEl = document.getElementById('supplier-modal-title');
            if (titleEl) titleEl.innerText = 'Nuevo Proveedor';
            document.getElementById('sup-form-id').value = '';
            document.getElementById('sup-form-name').value = '';
            document.getElementById('sup-form-rut').value = '';
            document.getElementById('sup-form-contact').value = '';
            document.getElementById('sup-form-phone').value = '';
            document.getElementById('sup-form-email').value = '';
            document.getElementById('sup-form-address').value = '';
            document.getElementById('sup-form-category').value = '';
            document.getElementById('sup-form-notes').value = '';
        }
        this.openModal('modal-edit-supplier');
    }

    submitSupplierForm() {
        const id      = document.getElementById('sup-form-id').value;
        const name    = document.getElementById('sup-form-name').value.trim();
        const rut     = document.getElementById('sup-form-rut').value.trim();
        const contact = document.getElementById('sup-form-contact').value.trim();
        const phone   = document.getElementById('sup-form-phone').value.trim();
        const email   = document.getElementById('sup-form-email').value.trim();
        const address = document.getElementById('sup-form-address').value.trim();
        const category = document.getElementById('sup-form-category').value.trim();
        const notes   = document.getElementById('sup-form-notes').value.trim();

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
            address,
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

        const sideComp = document.getElementById('sidebar-company-name');
        const mobTitle = document.getElementById('mobile-header-title');
        if (sideComp) sideComp.innerText = p.companyName || 'Mi Empresa';
        if (mobTitle) mobTitle.innerText = p.companyName || 'Cotizador Pro';

        const elComp = document.getElementById('settings-company-name');
        const elTaxId = document.getElementById('settings-tax-id');
        const elPhone = document.getElementById('settings-phone');
        const elEmail = document.getElementById('settings-email');
        const elAddr = document.getElementById('settings-address');
        const elCur = document.getElementById('settings-currency');
        const elCurCode = document.getElementById('settings-currency-code');
        const elTax = document.getElementById('settings-tax-rate');
        const elBank = document.getElementById('settings-bank-details');
        const elTerms = document.getElementById('settings-terms');

        if (elComp) elComp.value = p.companyName || '';
        if (elTaxId) elTaxId.value = p.taxId || '';
        if (elPhone) elPhone.value = p.phone || '';
        if (elEmail) elEmail.value = p.email || '';
        if (elAddr) elAddr.value = p.address || '';
        if (elCur) elCur.value = p.currency || '$';
        if (elCurCode) elCurCode.value = p.currencyCode || 'USD';
        if (elTax) elTax.value = p.taxRate !== undefined ? p.taxRate : 19;
        if (elBank) elBank.value = p.bankDetails || '';
        if (elTerms) elTerms.value = p.terms || '';

        this.renderLogoPreview(p.logo);
    }

    renderLogoPreview(logoBase64) {
        const box = document.getElementById('logo-preview-box');
        const sidebarLogo = document.getElementById('sidebar-logo-container');
        if (!box) return;

        const effectiveLogo = logoBase64 || 'assets/logo.jpg';

        box.innerHTML = `<img src="${effectiveLogo}" alt="Logo" class="max-h-full max-w-full object-contain rounded-xl" />`;
        if (sidebarLogo) {
            sidebarLogo.innerHTML = `<img src="${effectiveLogo}" alt="Logo" class="h-full w-full object-cover rounded-xl shadow-sm" />`;
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
        window.db.saveProfile({ logo: 'assets/logo.jpg' });
        this.renderLogoPreview('assets/logo.jpg');
        this.showToast('Restaurado logotipo predeterminado.', 'info');
    }

    // ==========================================
    // TEMA CLARO / OSCURO (APPLE THEME SYSTEM)
    // ==========================================
    initTheme() {
        const savedTheme = localStorage.getItem('app_theme') || 'light';
        this.setTheme(savedTheme, false);
    }

    setTheme(mode, save = true) {
        const isDark = mode === 'dark';
        if (isDark) {
            document.documentElement.classList.add('dark');
            document.body.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
            document.body.classList.remove('dark');
        }

        if (save) {
            localStorage.setItem('app_theme', mode);
        }

        this.updateThemeToggleButtons(isDark);
    }

    toggleTheme() {
        const isCurrentlyDark = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
        const newTheme = isCurrentlyDark ? 'light' : 'dark';
        this.setTheme(newTheme, true);
        this.showToast(newTheme === 'dark' ? 'Modo Oscuro activado 🌙' : 'Modo Claro activado ☀️', 'info');
    }

    updateThemeToggleButtons(isDark) {
        const iconHeader = document.getElementById('theme-toggle-icon');
        const labelHeader = document.getElementById('theme-toggle-label');
        const mobileBtn = document.getElementById('mobile-theme-toggle-btn');

        if (iconHeader) {
            iconHeader.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
        }
        if (labelHeader) {
            labelHeader.innerText = isDark ? 'Modo Claro' : 'Modo Oscuro';
        }
        if (mobileBtn) {
            mobileBtn.innerHTML = `<i data-lucide="${isDark ? 'sun' : 'moon'}" class="w-5 h-5"></i>`;
        }

        const settingsThemeSelect = document.getElementById('settings-theme-select');
        if (settingsThemeSelect) {
            settingsThemeSelect.value = isDark ? 'dark' : 'light';
        }

        if (window.lucide) window.lucide.createIcons();
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
        this.showToast('Configuración guardada exitosamente.', 'success');
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
        if (m) {
            m.classList.add('active');
            m.classList.remove('hidden');
            m.style.display = 'flex';
        }
    }

    closeModal(id) {
        const m = document.getElementById(id);
        if (m) {
            m.classList.remove('active');
            m.classList.add('hidden');
            m.style.display = 'none';
        }
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
