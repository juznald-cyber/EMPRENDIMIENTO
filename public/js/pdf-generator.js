// js/pdf-generator.js - Generador de Documentos y PDF Corporativos con Logo
class PDFGenerator {
    constructor() {
        this.currentQuote = null;
    }

    generateHTML(quote, profile) {
        const currency = profile.currency || '$';
        const logoHtml = profile.logo 
            ? `<img src="${profile.logo}" alt="Logo" class="max-h-20 max-w-[200px] object-contain rounded" />`
            : `<div class="h-16 w-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl shadow-md">
                ${(profile.companyName || 'CO').substring(0, 2).toUpperCase()}
               </div>`;

        const itemsRows = quote.items.map((item, index) => `
            <tr class="${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} border-b border-slate-200 text-sm">
                <td class="py-3 px-3 text-slate-500 font-medium text-center">${index + 1}</td>
                <td class="py-3 px-3 text-slate-800">
                    <div class="font-semibold">${this.escapeHTML(item.name)}</div>
                    ${item.notes ? `<div class="text-xs text-slate-500 mt-0.5">${this.escapeHTML(item.notes)}</div>` : ''}
                    ${item.dimensions ? `<div class="text-xs text-indigo-600 font-medium mt-0.5">📐 Medidas: ${item.dimensions.width}x${item.dimensions.height} ${item.dimensions.unitMode || 'cm'} (${item.dimensions.areaM2} m²)</div>` : ''}
                </td>
                <td class="py-3 px-3 text-slate-600 text-center">${item.unit || 'Unid'}</td>
                <td class="py-3 px-3 text-slate-800 text-center font-bold">${item.quantity}</td>
                <td class="py-3 px-3 text-slate-700 text-right font-medium">${currency} ${(parseFloat(item.unitPrice) || 0).toFixed(2)}</td>
                <td class="py-3 px-3 text-indigo-700 text-right font-bold">${currency} ${(parseFloat(item.total) || 0).toFixed(2)}</td>
            </tr>
        `).join('');

        const statusColor = {
            'Borrador': 'bg-amber-100 text-amber-800 border-amber-300',
            'Enviada': 'bg-blue-100 text-blue-800 border-blue-300',
            'Aprobada': 'bg-emerald-100 text-emerald-800 border-emerald-300',
            'Rechazada': 'bg-rose-100 text-rose-800 border-rose-300'
        }[quote.status] || 'bg-slate-100 text-slate-800 border-slate-300';

        return `
        <div id="pdf-container-doc" class="bg-white p-8 max-w-4xl mx-auto text-slate-800 font-sans text-sm antialiased" style="min-height: 297mm; width: 210mm; margin: 0 auto; box-sizing: border-box;">
            <!-- Encabezado Principal -->
            <div class="flex justify-between items-start border-b-2 border-indigo-600 pb-6 mb-6">
                <div class="flex items-center gap-4">
                    ${logoHtml}
                    <div>
                        <h1 class="text-2xl font-black text-slate-900 tracking-tight">${this.escapeHTML(profile.companyName || 'Mi Empresa')}</h1>
                        <p class="text-xs text-slate-500 font-medium">RIF/NIT/Cédula: <span class="text-slate-700">${this.escapeHTML(profile.taxId || 'N/A')}</span></p>
                        <p class="text-xs text-slate-500 font-medium">Telf: <span class="text-slate-700">${this.escapeHTML(profile.phone || '')}</span> | Email: <span class="text-slate-700">${this.escapeHTML(profile.email || '')}</span></p>
                        <p class="text-xs text-slate-500 font-medium">${this.escapeHTML(profile.address || '')}</p>
                    </div>
                </div>
                <div class="text-right">
                    <div class="inline-block px-3 py-1 rounded-full text-xs font-bold border ${statusColor} mb-2 uppercase tracking-wide">
                        ${quote.status || 'Borrador'}
                    </div>
                    <h2 class="text-2xl font-extrabold text-indigo-700 uppercase tracking-wide">COTIZACIÓN</h2>
                    <p class="text-sm font-bold text-slate-800">N° ${quote.quoteNumber || 'COT-0000'}</p>
                    <p class="text-xs text-slate-500 mt-1">Fecha: <span class="font-semibold text-slate-700">${quote.date || ''}</span></p>
                    <p class="text-xs text-slate-500">Válida hasta: <span class="font-semibold text-slate-700">${quote.validUntil || ''}</span></p>
                </div>
            </div>

            <!-- Datos del Cliente y Resumen -->
            <div class="grid grid-cols-2 gap-4 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                    <h3 class="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-2">Cliente / Solicitante</h3>
                    <p class="font-bold text-slate-900 text-base">${this.escapeHTML(quote.client?.name || 'Cliente Particular')}</p>
                    ${quote.client?.contact ? `<p class="text-xs text-slate-600 font-medium">Contacto: ${this.escapeHTML(quote.client.contact)}</p>` : ''}
                    ${quote.client?.phone ? `<p class="text-xs text-slate-600 font-medium">Teléfono: ${this.escapeHTML(quote.client.phone)}</p>` : ''}
                    ${quote.client?.email ? `<p class="text-xs text-slate-600 font-medium">Email: ${this.escapeHTML(quote.client.email)}</p>` : ''}
                    ${quote.client?.address ? `<p class="text-xs text-slate-600 font-medium">Dirección: ${this.escapeHTML(quote.client.address)}</p>` : ''}
                </div>
                <div class="border-l border-slate-200 pl-4 flex flex-col justify-center">
                    <div class="text-xs text-slate-500 mb-1">Total de Ítems Presupuestados: <span class="font-bold text-slate-800">${quote.items.length}</span></div>
                    <div class="text-xs text-slate-500 mb-1">Moneda: <span class="font-bold text-slate-800">${profile.currencyCode || 'USD'} (${currency})</span></div>
                    ${quote.notes ? `<div class="text-xs text-slate-600 bg-white p-2 rounded border border-slate-200 mt-1 italic">${this.escapeHTML(quote.notes)}</div>` : ''}
                </div>
            </div>

            <!-- Tabla de Ítems -->
            <div class="overflow-hidden rounded-xl border border-slate-200 shadow-sm mb-6">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="bg-indigo-600 text-white text-xs font-bold uppercase tracking-wider">
                            <th class="py-3 px-3 text-center w-12">#</th>
                            <th class="py-3 px-3">Descripción / Detalle</th>
                            <th class="py-3 px-3 text-center w-20">Unidad</th>
                            <th class="py-3 px-3 text-center w-16">Cant.</th>
                            <th class="py-3 px-3 text-right w-28">Precio Unit.</th>
                            <th class="py-3 px-3 text-right w-28">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsRows}
                    </tbody>
                </table>
            </div>

            <!-- Cuadro de Totales y Términos -->
            <div class="grid grid-cols-12 gap-6 mb-6">
                <div class="col-span-7 space-y-4">
                    <!-- Datos de Pago -->
                    ${profile.bankDetails ? `
                        <div class="bg-indigo-50/60 p-3 rounded-xl border border-indigo-100">
                            <h4 class="text-xs font-bold text-indigo-900 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                <span>💳</span> Datos de Pago y Cuentas Bancarias
                            </h4>
                            <p class="text-xs text-slate-700 whitespace-pre-line leading-relaxed font-mono">${this.escapeHTML(profile.bankDetails)}</p>
                        </div>
                    ` : ''}

                    <!-- Términos y Condiciones -->
                    ${profile.terms ? `
                        <div class="p-3 bg-slate-50 rounded-xl border border-slate-200">
                            <h4 class="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                📋 Términos y Condiciones
                            </h4>
                            <p class="text-xs text-slate-500 whitespace-pre-line leading-relaxed">${this.escapeHTML(profile.terms)}</p>
                        </div>
                    ` : ''}
                </div>

                <!-- Resumen Financiero -->
                <div class="col-span-5">
                    <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                        <div class="flex justify-between text-xs text-slate-600 font-medium">
                            <span>Subtotal Bruto:</span>
                            <span class="font-bold text-slate-800">${currency} ${(parseFloat(quote.subtotal) || 0).toFixed(2)}</span>
                        </div>
                        ${quote.discountAmount > 0 ? `
                            <div class="flex justify-between text-xs text-emerald-600 font-medium">
                                <span>Descuento (${quote.discountPercentage || 0}%):</span>
                                <span class="font-bold">-${currency} ${(parseFloat(quote.discountAmount) || 0).toFixed(2)}</span>
                            </div>
                        ` : ''}
                        ${profile.enableTax ? `
                            <div class="flex justify-between text-xs text-slate-600 font-medium">
                                <span>Impuesto (IVA ${quote.taxRate || profile.taxRate || 0}%):</span>
                                <span class="font-bold text-slate-800">${currency} ${(parseFloat(quote.taxAmount) || 0).toFixed(2)}</span>
                            </div>
                        ` : ''}
                        <div class="border-t-2 border-indigo-200 pt-2 mt-2 flex justify-between items-baseline">
                            <span class="text-sm font-extrabold text-slate-900 uppercase">TOTAL A PAGAR:</span>
                            <span class="text-xl font-black text-indigo-700">${currency} ${(parseFloat(quote.total) || 0).toFixed(2)}</span>
                        </div>
                    </div>

                    <!-- Firma y Aprobación -->
                    <div class="mt-8 pt-6 border-t border-dashed border-slate-300 text-center">
                        <div class="w-40 mx-auto border-b border-slate-400 mb-1"></div>
                        <p class="text-[11px] font-bold text-slate-700">Firma y Sello de Aprobación</p>
                        <p class="text-[10px] text-slate-400">Acepto los términos y costos descritos</p>
                    </div>
                </div>
            </div>

            <!-- Pie de Página -->
            <div class="border-t border-slate-200 pt-3 text-center text-[10px] text-slate-400 flex justify-between items-center">
                <span>Generado con Sistema de Cotizaciones Pro</span>
                <span>¡Gracias por su preferencia y confianza comercial!</span>
                <span>Página 1 de 1</span>
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

    async downloadPDF(quote, profile) {
        const tempContainer = document.createElement('div');
        tempContainer.id = 'pdf-render-wrapper';
        tempContainer.style.position = 'fixed';
        tempContainer.style.left = '-9999px';
        tempContainer.style.top = '0';
        tempContainer.innerHTML = this.generateHTML(quote, profile);
        document.body.appendChild(tempContainer);

        const safeQuoteNum = (quote.quoteNumber || 'COT-0000').replace(/[^a-zA-Z0-9_-]/g, '_');
        const safeClientName = (quote.client?.name || 'Cliente').replace(/[^a-zA-Z0-9_-]/g, '_');
        const filename = `Cotizacion_${safeQuoteNum}_${safeClientName}.pdf`;

        const opt = {
            margin: [10, 8, 10, 8],
            filename: filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        try {
            if (window.html2pdf) {
                await window.html2pdf().set(opt).from(tempContainer.querySelector('#pdf-container-doc')).save();
            } else {
                // Fallback de impresión
                window.print();
            }
        } catch (err) {
            console.error('Error generando PDF:', err);
            alert('Hubo un inconveniente al generar el PDF. Puedes utilizar la opción de impresión del navegador (Ctrl+P / Guardar como PDF).');
        } finally {
            if (tempContainer.parentNode) {
                tempContainer.parentNode.removeChild(tempContainer);
            }
        }
    }

    prepareEmail(quote, profile) {
        const clientEmail = quote.client?.email || '';
        const subject = encodeURIComponent(`Cotización ${quote.quoteNumber || ''} - ${profile.companyName || 'Nuestra Empresa'}`);
        
        let bodyText = `Estimado(a) ${quote.client?.name || 'Cliente'},\n\n`;
        bodyText += `Es un placer saludarle. Le hacemos entrega formal de la cotización N° ${quote.quoteNumber || ''} por un total de ${profile.currency || '$'} ${quote.total.toFixed(2)}.\n\n`;
        bodyText += `Resumen de ítems cotizados:\n`;
        quote.items.forEach((it, idx) => {
            bodyText += `- ${it.quantity}x ${it.name} -> ${profile.currency || '$'}${it.total.toFixed(2)}\n`;
        });
        bodyText += `\nTotal a Pagar: ${profile.currency || '$'} ${quote.total.toFixed(2)}\n`;
        bodyText += `Validez de la oferta: Hasta el ${quote.validUntil || '15 días'}\n\n`;
        if (profile.bankDetails) {
            bodyText += `Datos para pagos:\n${profile.bankDetails}\n\n`;
        }
        bodyText += `Quedamos a su completa disposición para cualquier duda o consulta.\n\nAtentamente,\n${profile.companyName || ''}\nTelf: ${profile.phone || ''}\n${profile.email || ''}`;

        const mailtoUrl = `mailto:${clientEmail}?subject=${subject}&body=${encodeURIComponent(bodyText)}`;
        window.open(mailtoUrl, '_blank');
    }

    prepareWhatsApp(quote, profile) {
        const rawPhone = (quote.client?.phone || '').replace(/[^0-9]/g, '');
        const currency = profile.currency || '$';
        
        let msg = `*Hola ${quote.client?.name || 'estimado(a)'}!* 👋\n\n`;
        msg += `Te enviamos la información de tu *Cotización N° ${quote.quoteNumber || ''}* de *${profile.companyName || 'nuestra empresa'}*:\n\n`;
        
        quote.items.forEach((it, idx) => {
            msg += `▫️ *${it.quantity}x* ${it.name}: ${currency} ${it.total.toFixed(2)}\n`;
        });

        msg += `\n💰 *Total: ${currency} ${quote.total.toFixed(2)}*\n`;
        msg += `📅 *Válida hasta:* ${quote.validUntil || '15 días'}\n\n`;
        msg += `¿Deseas que procedamos con el pedido? Avísanos por este medio para coordinar los detalles. ¡Muchas gracias! 😊`;

        const waUrl = rawPhone 
            ? `https://api.whatsapp.com/send?phone=${rawPhone}&text=${encodeURIComponent(msg)}`
            : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
        
        window.open(waUrl, '_blank');
    }
}

window.pdfGenerator = new PDFGenerator();
