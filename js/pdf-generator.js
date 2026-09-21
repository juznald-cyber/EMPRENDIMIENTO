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
                <td class="py-2.5 px-2 text-slate-700 text-right font-medium">${currency} ${window.formatMoney(item.unitPrice)}</td>
                <td class="py-2.5 px-2 text-indigo-700 text-right font-bold">${currency} ${window.formatMoney(item.total)}</td>
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
                    </div>
                </div>
                <div class="text-right">
                    <div class="inline-block px-3 py-1 rounded-lg border text-xs font-black uppercase tracking-wider mb-1 ${statusColor}">
                        ${quote.status || 'Borrador'}
                    </div>
                    <p class="text-base font-black text-indigo-700 font-mono tracking-tight">${quote.quoteNumber || 'COT-0000'}</p>
                    <p class="text-[11px] text-slate-500">Fecha: <span class="text-slate-800 font-bold">${quote.date || ''}</span></p>
                    <p class="text-[11px] text-slate-500">Vence: <span class="text-slate-800 font-bold">${quote.validUntil || ''}</span></p>
                </div>
            </div>

            <!-- Datos de Cliente y Emisor -->
            <div class="grid grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200 mb-4 text-xs">
                <div>
                    <h3 class="font-bold text-[10px] text-slate-400 uppercase tracking-wider mb-1">Cliente / Destinatario</h3>
                    <p class="font-black text-slate-900 text-sm">${this.escapeHTML(quote.client?.name || 'Cliente Particular')}</p>
                    ${quote.client?.taxId ? `<p class="text-slate-600 text-[11px]">RUT / ID: <span class="font-semibold">${this.escapeHTML(quote.client.taxId)}</span></p>` : ''}
                    ${quote.client?.phone ? `<p class="text-slate-600 text-[11px]">Tel: <span class="font-semibold">${this.escapeHTML(quote.client.phone)}</span></p>` : ''}
                    ${quote.client?.email ? `<p class="text-slate-600 text-[11px]">Email: <span class="font-semibold">${this.escapeHTML(quote.client.email)}</span></p>` : ''}
                    ${quote.client?.address ? `<p class="text-slate-600 text-[11px]">Dir: <span class="font-semibold">${this.escapeHTML(quote.client.address)}</span></p>` : ''}
                </div>
                <div>
                    <h3 class="font-bold text-[10px] text-slate-400 uppercase tracking-wider mb-1">Emisor / Taller</h3>
                    <p class="font-bold text-slate-800">${this.escapeHTML(profile.companyName || '')}</p>
                    ${profile.phone ? `<p class="text-slate-600 text-[11px]">Tel: ${this.escapeHTML(profile.phone)}</p>` : ''}
                    ${profile.email ? `<p class="text-slate-600 text-[11px]">Email: ${this.escapeHTML(profile.email)}</p>` : ''}
                    ${profile.address ? `<p class="text-slate-600 text-[11px]">Dir: ${this.escapeHTML(profile.address)}</p>` : ''}
                </div>
            </div>

            <!-- Tabla de Ítems -->
            <div class="overflow-hidden rounded-xl border border-slate-200 mb-4">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="bg-indigo-900 text-white text-[10px] font-bold uppercase tracking-wider">
                            <th class="py-2 px-2 text-center w-8">#</th>
                            <th class="py-2 px-2">Descripción del Ítem</th>
                            <th class="py-2 px-2 text-center w-14">Unidad</th>
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

            <!-- Sección Inferior: Totales y Condiciones -->
            <div class="grid grid-cols-12 gap-4 items-start">
                <!-- Condiciones y Datos Bancarios -->
                <div class="col-span-7 space-y-2.5">
                    ${profile.bankDetails ? `
                        <div class="bg-indigo-50/70 p-3 rounded-xl border border-indigo-100">
                            <h4 class="font-bold text-[10px] text-indigo-900 uppercase tracking-wider mb-1">Datos de Pago / Transferencia</h4>
                            <p class="text-[11px] text-slate-700 whitespace-pre-line font-medium leading-relaxed">${this.escapeHTML(profile.bankDetails)}</p>
                        </div>
                    ` : ''}
                    ${quote.terms ? `
                        <div class="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                            <h4 class="font-bold text-[10px] text-slate-600 uppercase tracking-wider mb-0.5">Términos y Condiciones</h4>
                            <p class="text-[10px] text-slate-600 whitespace-pre-line leading-relaxed">${this.escapeHTML(quote.terms)}</p>
                        </div>
                    ` : ''}
                </div>

                <!-- Resumen Financiero -->
                <div class="col-span-5">
                    <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                        <div class="flex justify-between text-slate-600 font-medium text-[11px]">
                            <span>Subtotal Neto:</span>
                            <span class="font-bold text-slate-800">${currency} ${window.formatMoney(quote.subtotal)}</span>
                        </div>
                        ${quote.discountAmount > 0 ? `
                            <div class="flex justify-between text-emerald-600 font-medium text-[11px]">
                                <span>Descuento (${quote.discountPercentage || 0}%):</span>
                                <span class="font-bold">-${currency} ${window.formatMoney(quote.discountAmount)}</span>
                            </div>
                        ` : ''}
                        ${profile.enableTax ? `
                            <div class="flex justify-between text-slate-600 font-medium text-[11px]">
                                <span>IVA (${quote.taxRate || profile.taxRate || 0}%):</span>
                                <span class="font-bold text-slate-800">${currency} ${window.formatMoney(quote.taxAmount)}</span>
                            </div>
                        ` : ''}
                        <div class="border-t-2 border-indigo-200 pt-1.5 mt-1.5 flex justify-between items-baseline">
                            <span class="text-xs font-black text-slate-900 uppercase">TOTAL:</span>
                            <span class="text-lg font-black text-indigo-700 font-mono">${currency} ${window.formatMoney(quote.total)}</span>
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
        bodyText += `Le hacemos entrega formal de la cotización N° ${quote.quoteNumber || ''} por un monto total de ${currency} ${window.formatMoney(quote.total)}.\n\n`;
        bodyText += `Resumen de ítems cotizados:\n`;
        quote.items.forEach((it) => {
            bodyText += `- ${it.quantity}x ${it.name} -> ${currency} ${window.formatMoney(it.total)}\n`;
        });
        bodyText += `\nTotal a Pagar: ${currency} ${window.formatMoney(quote.total)}\n`;
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
            msg += `▫️ *${it.quantity}x* ${it.name}: ${currency} ${window.formatMoney(it.total)}\n`;
        });

        msg += `\n💰 *Total a Pagar: ${currency} ${window.formatMoney(quote.total)}*\n`;
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
