const INSCRIPTOS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vToRsF3zwvqzcMttSdROC5E4tyHqpQsHaGpxJyRPzf4Aunc5-uX3IddO1vXmn64mt5Uur46HkLekr-d/pub?gid=551610778&single=true&output=csv';
const { analizarCSV } = window.UtilidadesCSV;
const { ordenarCategorias, obtenerPrioridadCategoria } = window.UtilidadesCategorias;
const { obtenerRutaLogoMarca } = window.UtilidadesIconos;

let inscriptosData = [];

function normalizarCategoria(categoria) {
    return (categoria || '').trim();
}

function esCategoriaRC1(categoria) {
    const categoriaNormalizada = normalizarCategoria(categoria).toUpperCase();
    return categoriaNormalizada === 'RC1' || categoriaNormalizada === 'RALLY1';
}

function esCategoriaRC2(categoria) {
    const categoriaNormalizada = normalizarCategoria(categoria).toUpperCase();
    return categoriaNormalizada === 'RC2' || categoriaNormalizada === 'RALLY2';
}

function esCategoriaRCMR(categoria) {
    return normalizarCategoria(categoria).toUpperCase() === 'RCMR';
}

function esCategoriaRC4(categoria) {
    return normalizarCategoria(categoria).toUpperCase() === 'RC4';
}

function esCategoriaRC3OJunior(categoria) {
    const categoriaNormalizada = normalizarCategoria(categoria).toUpperCase();
    return categoriaNormalizada === 'RC3' || categoriaNormalizada === 'JUNIOR';
}

function esCategoriaRC5(categoria) {
    return normalizarCategoria(categoria).toUpperCase() === 'RC5';
}

function obtenerIndiceColorCategoria(categoria) {
    if (esCategoriaRC1(categoria)) return 6;
    if (esCategoriaRC2(categoria)) return 1;
    if (esCategoriaRCMR(categoria)) return 2;
    if (esCategoriaRC4(categoria)) return 3;
    if (esCategoriaRC3OJunior(categoria)) return 4;
    if (esCategoriaRC5(categoria)) return 5;

    const categoriasAlternativas = ['7', '8'];
    const codigo = normalizarCategoria(categoria)
        .split('')
        .reduce((acumulado, letra) => acumulado + letra.charCodeAt(0), 0);

    return Number(categoriasAlternativas[codigo % categoriasAlternativas.length]);
}

function obtenerColorPdfCategoria(categoria) {
    if (esCategoriaRC1(categoria)) return [255, 200, 150];
    if (esCategoriaRC2(categoria)) return [252, 194, 194];
    if (esCategoriaRCMR(categoria)) return [255, 254, 195];
    if (esCategoriaRC4(categoria)) return [201, 222, 252];
    if (esCategoriaRC3OJunior(categoria)) return [248, 201, 234];
    if (esCategoriaRC5(categoria)) return [199, 245, 247];

    const coloresAlternativos = [
        [229, 212, 255],
        [216, 240, 200],
        [255, 225, 191]
    ];

    const codigo = normalizarCategoria(categoria)
        .split('')
        .reduce((acumulado, letra) => acumulado + letra.charCodeAt(0), 0);

    return coloresAlternativos[codigo % coloresAlternativos.length];
}

function obtenerNumeroInscripto(fila) {
    return fila['Nº'] || fila['N°'] || fila['NÂº'] || fila['NÃ‚Âº'] || '';
}

function construirInfoCategorias() {
    const categoriasMap = {};

    inscriptosData.forEach(inscripto => {
        const categoria = inscripto.categoria;

        if (!categoriasMap[categoria]) {
            categoriasMap[categoria] = {
                cantidad: 0,
                colorIndex: obtenerIndiceColorCategoria(categoria),
                filas: []
            };
        }

        categoriasMap[categoria].cantidad += 1;
        categoriasMap[categoria].filas.push(inscripto);
    });

    const categoriasOrdenadas = ordenarCategorias(Object.keys(categoriasMap));
    const categoriasInfo = {};

    categoriasOrdenadas.forEach(categoria => {
        categoriasInfo[categoria] = categoriasMap[categoria];
    });

    return categoriasInfo;
}

function renderizarContadorCategorias(categoriasInfo) {
    const contadorCategoriasElement = document.getElementById('contadorCategorias');
    if (!contadorCategoriasElement) return;
    contadorCategoriasElement.innerHTML = '';
}

/* ==========================
   CARGA DE DATOS
========================== */
async function cargarDatos() {
    try {
        const response = await fetch(INSCRIPTOS_URL);
        const text = await response.text();

        inscriptosData = analizarCSV(text, {
            transformarEncabezados: encabezado => encabezado.trim().toUpperCase(),
            filtrarFila: fila => Boolean(fila.NOMBRE && fila.CATEGORIA),
            mapearFila: fila => ({
                numero: obtenerNumeroInscripto(fila),
                nombre: fila.NOMBRE || '',
                vehiculo: fila.VEHICULO || '',
                categoria: normalizarCategoria(fila.CATEGORIA)
            })
        });

        inscriptosData.sort((a, b) => {
            const prioridadA = obtenerPrioridadCategoria(a.categoria);
            const prioridadB = obtenerPrioridadCategoria(b.categoria);

            if (prioridadA !== prioridadB) {
                return prioridadA - prioridadB;
            }

            const categoriaComparada = a.categoria.localeCompare(b.categoria, 'es', { sensitivity: 'base' });
            if (categoriaComparada !== 0) {
                return categoriaComparada;
            }

            return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
        });

        renderizarInscriptos();
        actualizarUltimaActualizacion();
    } catch (error) {
        window.UtilidadesError.mostrarError(
            document.getElementById('content'),
            'Error al cargar los inscriptos.',
            cargarDatos
        );
        console.error('Error:', error);
    }
}

/* ==========================
   RENDER PRINCIPAL
========================== */
function renderizarInscriptos() {
    const contentElement = document.getElementById('content');
    const contadorElement = document.getElementById('contadorPilotos');

    if (!contentElement || !contadorElement) return;

    if (inscriptosData.length === 0) {
        contentElement.innerHTML =
            '<div class="error">No se encontraron inscriptos.</div>';
        contadorElement.textContent = '0';
        renderizarContadorCategorias({});
        return;
    }

    contadorElement.textContent = inscriptosData.length;

    const categoriasInfo = construirInfoCategorias();
    renderizarContadorCategorias(categoriasInfo);

    let html = `
        <div class="category-section">
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Nº</th>
                            <th>Piloto</th>
                            <th>Marca</th>
                            <th>Vehículo</th>
                            <th>Categoría</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    let categoriaActual = '';

    inscriptosData.forEach(inscripto => {
        if (inscripto.categoria !== categoriaActual) {
            categoriaActual = inscripto.categoria;
            const info = categoriasInfo[categoriaActual];

            html += `
                <tr class="category-header category-color-${info.colorIndex}">
                    <td colspan="5">
                        <span>CLASE: ${categoriaActual}</span>
                        <span class="category-count">INSCRIPTOS: ${info.cantidad}</span>
                    </td>
                </tr>
            `;
        }

        const numeroBadge = inscripto.numero
            ? `<span class="numero-badge">${inscripto.numero}</span>`
            : '-';

        const rutaLogoMarca = obtenerRutaLogoMarca(inscripto.vehiculo);
        const logoMarca = rutaLogoMarca
            ? `<img src="${rutaLogoMarca}" alt="${inscripto.vehiculo}" class="marca-logo">`
            : '-';

        html += `
            <tr>
                <td>${numeroBadge}</td>
                <td>${inscripto.nombre}</td>
                <td>${logoMarca}</td>
                <td>${inscripto.vehiculo}</td>
                <td>${inscripto.categoria}</td>
            </tr>
        `;
    });

    html += `
                    </tbody>
                </table>
            </div>
        </div>
    `;

    contentElement.innerHTML = html;
}

/* ==========================
   ACTUALIZADOR DE FECHA/HORA
========================== */
function actualizarUltimaActualizacion() {
    const lastUpdateElement = document.getElementById('lastUpdate');
    if (!lastUpdateElement) return;

    const ahora = new Date();
    const hora = ahora.toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    const fecha = ahora.toLocaleDateString('es-AR');

    lastUpdateElement.textContent = `Última actualización: ${fecha} - ${hora}`;
}

/* ==========================
   EXPORTAR A PDF
========================== */
function exportarAPDF() {
    const { jsPDF } = window.jspdf;
    const documento = new jsPDF('l', 'mm', 'a4');

    documento.setFontSize(20);
    documento.setFont(undefined, 'bold');
    documento.text('INSCRIPTOS PROVISORIOS', documento.internal.pageSize.getWidth() / 2, 15, { align: 'center' });

    const ahora = new Date();
    const fecha = ahora.toLocaleDateString('es-AR');
    const hora = ahora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

    documento.setFontSize(10);
    documento.setFont(undefined, 'normal');
    documento.text(`Generado: ${fecha} - ${hora}`, documento.internal.pageSize.getWidth() / 2, 22, { align: 'center' });

    const categoriasInfo = construirInfoCategorias();
    const categoriasOrdenadas = Object.keys(categoriasInfo);
    const anchoPagina = documento.internal.pageSize.getWidth();
    const anchoTabla = 260;
    const margenLateral = (anchoPagina - anchoTabla) / 2;
    const filasTabla = [];

    categoriasOrdenadas.forEach(categoria => {
        const info = categoriasInfo[categoria];

        filasTabla.push([
            {
                content: `CLASE: ${categoria} - INSCRIPTOS: ${info.cantidad}`,
                colSpan: 4,
                styles: {
                    halign: 'center',
                    fillColor: obtenerColorPdfCategoria(categoria),
                    textColor: [15, 23, 42],
                    fontStyle: 'bold',
                    fontSize: 11
                }
            }
        ]);

        info.filas.forEach(inscripto => {
            filasTabla.push([
                inscripto.numero || '-',
                inscripto.nombre,
                inscripto.vehiculo,
                inscripto.categoria
            ]);
        });
    });

    documento.autoTable({
        startY: 30,
        head: [['Nº', 'Piloto', 'Vehículo', 'Categoría']],
        body: filasTabla,
        theme: 'grid',
        headStyles: {
            fillColor: [15, 23, 42],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 10,
            halign: 'center',
            lineWidth: 0.3,
            lineColor: [60, 70, 86]
        },
        bodyStyles: {
            fontSize: 9,
            halign: 'center',
            lineWidth: 0.3,
            lineColor: [150, 150, 150],
            textColor: [22, 28, 37]
        },
        alternateRowStyles: {
            fillColor: [243, 244, 246]
        },
        margin: { left: margenLateral, right: margenLateral },
        tableWidth: anchoTabla,
        columnStyles: {
            0: { cellWidth: 25, halign: 'center' },
            1: { cellWidth: 80, halign: 'center' },
            2: { cellWidth: 110, halign: 'center' },
            3: { cellWidth: 45, halign: 'center', textColor: [15, 23, 42], fontStyle: 'bold' }
        }
    });

    const totalPaginas = documento.internal.getNumberOfPages();
    for (let pagina = 1; pagina <= totalPaginas; pagina++) {
        documento.setPage(pagina);
        documento.setFontSize(8);
        documento.setTextColor(100, 116, 139);
        documento.text(
            `Total de pilotos: ${inscriptosData.length} - Página ${pagina} de ${totalPaginas}`,
            documento.internal.pageSize.getWidth() / 2,
            documento.internal.pageSize.getHeight() - 10,
            { align: 'center' }
        );
    }

    documento.save(`inscriptos_${fecha.replace(/\//g, '-')}.pdf`);
}

/* ==========================
   EVENT LISTENERS
========================== */
document.addEventListener('DOMContentLoaded', function () {
    const btnExportPDF = document.getElementById('btnExportPDF');
    if (btnExportPDF) {
        btnExportPDF.addEventListener('click', exportarAPDF);
    }
});

/* ==========================
   EJECUCIÓN INICIAL
========================== */
cargarDatos();
setInterval(cargarDatos, 300000);
