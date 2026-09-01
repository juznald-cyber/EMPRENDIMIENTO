// js/pdf-generator.js - Generador de Documentos y PDF Corporativos en Tamaño Carta (Letter)
class PDFGenerator {
    constructor() {
        this.currentQuote = null;
    }

    generateHTML(quote, profile) {
        const currency = profile.currency || '$';
        const logoHtml = profile.logo 
            ? `<img src="${profile.logo}" alt="Logo" class="max-h-16 max-w-[170px] object-contain rounded" />`
            : `<div class="h-14 w-14 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-md">
                ${(profile.companyName || 'CO').substring(0, 2).toUpperCase()}
               </div>`;

        const itemsRows = quote.items.map((item, index) => `
            <tr class="${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} border-b border-slate-200 text-xs">
                <td class="py-2.5 px-2 text-slate-500 font-medium text-center">${index + 1}</td>
                <td class="py-2.5 px-2 text-slate-800">
                    <div class="font-bold text-xs leading-tight">${this.escapeHTML(item.name)}</div>
                    ${item.notes ? `<div class="text-[10px] text-slate-500 mt-0.5">${this.escapeHTML(item.notes)}</div>` : ''}
                </td>
                <td class="py-2.5 px-2 text-slate-600 text-center">${item.unit || 'Unid'}</td>
                <td class="py-2.5 px-2 text-slate-800 text-center font-bold">${item.quantity}</td>
                <td class="py-2.5 px-2 text-slate-700 text-right font-medium">${currency} ${window.formatMoney(item.unitPrice, true)}</td>
                <td class="py-2.5 px-2 text-indigo-700 text-right font-bold">${currency} ${window.formatMoney(item.total, true)}</td>
            </tr>
        `).join('');

        const statusColor = {
            'Borrador': 'bg-amber-100 text-amber-800 border-amber-300',
            'Enviada': 'bg-blue-100 text-blue-800 border-blue-300',
            'Aprobada': 'bg-emerald-100 text-emerald-800 border-emerald-300',
            'Rechazada': 'bg-rose-100 text-rose-800 border-rose-300'
        }[quote.status] || 'bg-slate-100 text-slate-800 border-slate-300';

        // Tamaño Carta (Letter: 215.9mm x 279.4mm)
        return `
        <div id="pdf-container-doc" class="bg-white p-6 max-w-4xl mx-auto text-slate-800 font-sans text-xs antialiased" style="width: 200mm; min-height: 265mm; margin: 0 auto; box-sizing: border-box;">
            <!-- Encabezado Principal -->
            <div class="flex justify-between items-start border-b-2 border-indigo-600 pb-4 mb-4">
                <div class="flex items-center gap-3">
                    ${logoHtml}
                    <div>
                        <h1 class="text-xl font-black text-slate-900 tracking-tight leading-tight">${this.escapeHTML(profile.companyName || 'Mi Empresa')}</h1>
                        <p class="text-[11px] text-slate-500 font-medium">RUT / Identificación: <span class="text-slate-800 font-bold">${this.escapeHTML(profile.taxId || 'N/A')}</span></p>
                        <p class="text-[11px] text-slate-500 font-medium">Telf: <span class="text-slate-700">${this.escapeHTML(profile.phone || '')}</span> | Email: <span class="text-slate-700">${this.escapeHTML(profile.email || '')}</span></p>
                        <p class="text-[10px] text-slate-500">${this.escapeHTML(profile.address || '')}</p>
                    </div>
                </div>
                <div class="text-right">
                    <div class="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusColor} mb-1 uppercase tracking-wide">
                        ${quote.status || 'Borrador'}
                    </div>
                    <h2 class="text-xl font-black text-indigo-700 uppercase tracking-wide">COTIZACIÓN</h2>
                    <p class="text-xs font-bold text-slate-800">N° ${quote.quoteNumber || 'COT-0000'}</p>
                    <p class="text-[10px] text-slate-500 mt-0.5">Fecha: <span class="font-semibold text-slate-700">${quote.date || ''}</span></p>
                    <p class="text-[10px] text-slate-500">Válida hasta: <span class="font-semibold text-slate-700">${quote.validUntil || ''}</span></p>
                </div>
            </div>

            <!-- Datos del Cliente y Resumen -->
            <div class="grid grid-cols-2 gap-3 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <div>
                    <h3 class="text-[10px] font-black text-indigo-700 uppercase tracking-wider mb-1">Cliente / Solicitante</h3>
                    <p class="font-black text-slate-900 text-sm leading-tight">${this.escapeHTML(quote.client?.name || 'Cliente Particular')}</p>
                    ${quote.client?.rut ? `<p class="text-[11px] text-slate-700 font-bold">RUT / Identificación: <span class="text-slate-900 font-mono">${this.escapeHTML(quote.client.rut)}</span></p>` : ''}
                    ${quote.client?.contact ? `<p class="text-[10px] text-slate-600">Contacto: ${this.escapeHTML(quote.client.contact)}</p>` : ''}
                    ${quote.client?.phone ? `<p class="text-[10px] text-slate-600">Teléfono: ${this.escapeHTML(quote.client.phone)}</p>` : ''}
                    ${quote.client?.email ? `<p class="text-[10px] text-slate-600">Email: ${this.escapeHTML(quote.client.email)}</p>` : ''}
                    ${quote.client?.address ? `<p class="text-[10px] text-slate-600">Dirección: ${this.escapeHTML(quote.client.address)}</p>` : ''}
                </div>
                <div class="border-l border-slate-200 pl-3 flex flex-col justify-center text-xs">
                    <div class="text-[11px] text-slate-500 mb-0.5">Total de Ítems: <span class="font-bold text-slate-800">${quote.items.length}</span></div>
                    <div class="text-[11px] text-slate-500 mb-0.5">Moneda: <span class="font-bold text-slate-800">${profile.currencyCode || 'USD'} (${currency})</span></div>
                    ${quote.notes ? `<div class="text-[10px] text-slate-600 bg-white p-1.5 rounded border border-slate-200 mt-1 italic">${this.escapeHTML(quote.notes)}</div>` : ''}
                </div>
            </div>

            <!-- Tabla de Ítems (Ajustada para Carta) -->
            <div class="overflow-hidden rounded-xl border border-slate-200 shadow-sm mb-4">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider">
                            <th class="py-2 px-2 text-center w-8">#</th>
                            <th class="py-2 px-2">Descripción / Detalle</th>
                            <th class="py-2 px-2 text-center w-16">Unidad</th>
                            <th class="py-2 px-2 text-center w-12">Cant.</th>
                            <th class="py-2 px-2 text-right w-24">Precio Unit.</th>
                            <th class="py-2 px-2 text-right w-24">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsRows}
                    </tbody>
                </table>
            </div>

            <!-- Cuadro de Totales y Términos -->
            <div class="grid grid-cols-12 gap-4 mb-4">
                <div class="col-span-7 space-y-2">
                    <!-- Datos de Pago -->
                    ${profile.bankDetails ? `
                        <div class="bg-indigo-50/70 p-2.5 rounded-xl border border-indigo-100">
                            <h4 class="text-[10px] font-bold text-indigo-900 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                                <span>💳</span> Datos de Pago y Cuentas
                            </h4>
                            <p class="text-[10px] text-slate-700 whitespace-pre-line leading-relaxed font-mono">${this.escapeHTML(profile.bankDetails)}</p>
                        </div>
                    ` : ''}

                    <!-- Términos y Condiciones -->
                    ${profile.terms ? `
                        <div class="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                            <h4 class="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-0.5">
                                📋 Términos y Condiciones
                            </h4>
                            <p class="text-[9px] text-slate-500 whitespace-pre-line leading-relaxed">${this.escapeHTML(profile.terms)}</p>
                        </div>
                    ` : ''}
                </div>

                <!-- Resumen Financiero -->
                <div class="col-span-5">
                    <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                        <div class="flex justify-between text-slate-600 font-medium text-[11px]">
                            <span>Subtotal Neto:</span>
                            <span class="font-bold text-slate-800">${currency} ${window.formatMoney(quote.subtotal, true)}</span>
                        </div>
                        ${quote.discountAmount > 0 ? `
                            <div class="flex justify-between text-emerald-600 font-medium text-[11px]">
                                <span>Descuento (${quote.discountPercentage || 0}%):</span>
                                <span class="font-bold">-${currency} ${window.formatMoney(quote.discountAmount, true)}</span>
                            </div>
                        ` : ''}
                        ${profile.enableTax ? `
                            <div class="flex justify-between text-slate-600 font-medium text-[11px]">
                                <span>IVA (${quote.taxRate || profile.taxRate || 0}%):</span>
                                <span class="font-bold text-slate-800">${currency} ${window.formatMoney(quote.taxAmount, true)}</span>
                            </div>
                        ` : ''}
                        <div class="border-t-2 border-indigo-200 pt-1.5 mt-1.5 flex justify-between items-baseline">
                            <span class="text-xs font-black text-slate-900 uppercase">TOTAL:</span>
                            <span class="text-lg font-black text-indigo-700 font-mono">${currency} ${window.formatMoney(quote.total, true)}</span>
                        </div>
                    </div>

                    <!-- Firma y Aprobación -->
                    <div class="mt-4 pt-3 border-t border-dashed border-slate-300 text-center">
                        <div class="w-32 mx-auto border-b border-slate-400 mb-0.5"></div>
                        <p class="text-[10px] font-bold text-slate-700">Firma de Aprobación</p>
                    </div>
                </div>
            </div>

            <!-- Pie de Página -->
            <div class="border-t border-slate-200 pt-2 text-center text-[9px] text-slate-400 flex justify-between items-center">
                <span>Generado con Sistema Pro de Cotizaciones</span>
                <span>¡Gracias por su preferencia comercial!</span>
            </div>
        </div>
        `;
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

    async generatePDFBlob(quote, profile) {
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.top = '0';
        container.innerHTML = this.generateHTML(quote, profile);
        document.body.appendChild(container);

        const element = container.querySelector('#pdf-container-doc');
        const opt = {
            margin: [8, 8, 8, 8],
            filename: `Cotizacion_${quote.quoteNumber || '0001'}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, letterRendering: true, logging: false },
            jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' }
        };

        try {
            if (window.html2pdf) {
                const pdfBlob = await window.html2pdf().set(opt).from(element).output('blob');
                return pdfBlob;
            }
            return null;
        } finally {
            if (container.parentNode) {
                container.parentNode.removeChild(container);
            }
        }
    }

    async downloadPDF(quote, profile) {
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px';
        tempContainer.style.top = '0';
        tempContainer.innerHTML = this.generateHTML(quote, profile);
        document.body.appendChild(tempContainer);

        const element = tempContainer.querySelector('#pdf-container-doc');
        const filename = `Cotizacion_${(quote.quoteNumber || 'COT-0000').replace(/[^a-zA-Z0-9_-]/g, '_')}_${(quote.client?.name || 'Cliente').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;

        const opt = {
            margin: [8, 8, 8, 8],
            filename: filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, letterRendering: true, logging: false },
            jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' }
        };

        try {
            if (window.html2pdf) {
                await window.html2pdf().set(opt).from(element).save();
            } else {
                window.print();
            }
        } catch (e) {
            console.error('Error al generar PDF con html2pdf, usando print():', e);
            window.print();
        } finally {
            if (tempContainer.parentNode) {
                tempContainer.parentNode.removeChild(tempContainer);
            }
        }
    }

    async prepareEmailWithAttachment(quote, profile) {
        const safeQuoteNum = (quote.quoteNumber || 'COT-0000').replace(/[^a-zA-Z0-9_-]/g, '_');
        const clientEmail = quote.client?.email || '';
        const subject = `Cotización ${quote.quoteNumber || ''} - ${profile.companyName || 'Nuestra Empresa'}`;
        const currency = profile.currency || '$';

        let bodyText = `Estimado(a) ${quote.client?.name || 'Cliente'},\n\n`;
        bodyText += `Le hacemos entrega formal de la cotización N° ${quote.quoteNumber || ''} por un monto total de ${currency} ${window.formatMoney(quote.total, true)}.\n\n`;
        bodyText += `Resumen de ítems cotizados:\n`;
        quote.items.forEach((it) => {
            bodyText += `- ${it.quantity}x ${it.name} -> ${currency} ${window.formatMoney(it.total, true)}\n`;
        });
        bodyText += `\nTotal a Pagar: ${currency} ${window.formatMoney(quote.total, true)}\n`;
        bodyText += `Validez de la oferta: Hasta el ${quote.validUntil || '15 días'}\n\n`;
        if (profile.bankDetails) {
            bodyText += `Datos bancarios para pagos:\n${profile.bankDetails}\n\n`;
        }
        bodyText += `Adjuntamos el documento PDF formal de esta cotización para su revisión.\n\nAtentamente,\n${profile.companyName || ''}\nTelf: ${profile.phone || ''}\n${profile.email || ''}`;

        // Intentar Web Share API con archivo PDF adjunto
        try {
            const pdfBlob = await this.generatePDFBlob(quote, profile);
            if (pdfBlob && navigator.canShare && navigator.canShare({ files: [new File([pdfBlob], `Cotizacion_${safeQuoteNum}.pdf`, { type: 'application/pdf' })] })) {
                const pdfFile = new File([pdfBlob], `Cotizacion_${safeQuoteNum}.pdf`, { type: 'application/pdf' });
                await navigator.share({
                    title: subject,
                    text: bodyText,
                    files: [pdfFile]
                });
                return true;
            }
        } catch (e) {
            console.log('WebShare no disponible o cancelado, usando fallback estándar:', e);
        }

        // Fallback: Descargar PDF y abrir mailto
        this.downloadPDF(quote, profile);
        const mailtoUrl = `mailto:${clientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
        window.open(mailtoUrl, '_blank');
        return true;
    }

    async prepareWhatsAppWithAttachment(quote, profile) {
        const safeQuoteNum = (quote.quoteNumber || 'COT-0000').replace(/[^a-zA-Z0-9_-]/g, '_');
        const rawPhone = (quote.client?.phone || '').replace(/[^0-9]/g, '');
        const currency = profile.currency || '$';

        let msg = `*Hola ${quote.client?.name || 'estimado(a)'}!* 👋\n\n`;
        msg += `Te enviamos la información de tu *Cotización N° ${quote.quoteNumber || ''}* de *${profile.companyName || 'nuestra empresa'}*:\n\n`;
        
        quote.items.forEach((it) => {
            msg += `▫️ *${it.quantity}x* ${it.name}: ${currency} ${window.formatMoney(it.total, true)}\n`;
        });

        msg += `\n💰 *Total a Pagar: ${currency} ${window.formatMoney(quote.total, true)}*\n`;
        msg += `📅 *Válida hasta:* ${quote.validUntil || '15 días'}\n\n`;
        msg += `Adjunto te compartimos el PDF formal con el desglose y datos de pago. ¡Quedamos a tu orden! 😊`;

        // Intentar compartir con Web Share API (Adjunta PDF en WhatsApp en teléfonos y tablets)
        try {
            const pdfBlob = await this.generatePDFBlob(quote, profile);
            if (pdfBlob && navigator.canShare && navigator.canShare({ files: [new File([pdfBlob], `Cotizacion_${safeQuoteNum}.pdf`, { type: 'application/pdf' })] })) {
                const pdfFile = new File([pdfBlob], `Cotizacion_${safeQuoteNum}.pdf`, { type: 'application/pdf' });
                await navigator.share({
                    title: `Cotización ${quote.quoteNumber}`,
                    text: msg,
                    files: [pdfFile]
                });
                return true;
            }
        } catch (e) {
            console.log('WebShare no disponible o cancelado:', e);
        }

        // Fallback: Descargar PDF y abrir chat de WhatsApp
        this.downloadPDF(quote, profile);
        const waUrl = rawPhone 
            ? `https://api.whatsapp.com/send?phone=${rawPhone}&text=${encodeURIComponent(msg)}`
            : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
        
        window.open(waUrl, '_blank');
        return true;
    }
}

window.pdfGenerator = new PDFGenerator();
