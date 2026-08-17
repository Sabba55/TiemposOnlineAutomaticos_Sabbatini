const URL_RALLY = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vToRsF3zwvqzcMttSdROC5E4tyHqpQsHaGpxJyRPzf4Aunc5-uX3IddO1vXmn64mt5Uur46HkLekr-d/pub?gid=0&single=true&output=csv';
const URL_SHAKEDOWN = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS9KuJ4zzR78fTAwcReep3kCYUG7iod7Ly6SzBgFMvd76_414TyhhkEQiWOXs9j3EOAcXKBKlX4Z7Ri/pub?gid=1847388332&single=true&output=csv';
const URL_INSCRIPTOS = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vToRsF3zwvqzcMttSdROC5E4tyHqpQsHaGpxJyRPzf4Aunc5-uX3IddO1vXmn64mt5Uur46HkLekr-d/pub?gid=551610778&single=true&output=csv';

const {
    analizarCSV: analizarCSVBase,
    esValorSi,
    fusionarPilotosConInscriptosYCategoria,
    normalizarFechasComparacion
} = window.UtilidadesCSV;
const { ordenarCategorias } = window.UtilidadesCategorias;
const { esDNF, tiempoASegundos, segundosATiempo, obtenerTiempoEtapa } = window.UtilidadesTiempo;

let datosShakedown = [];
let numeroVuelta = 1;

function obtenerParametroURL(parametro) {
    const parametrosURL = new URLSearchParams(window.location.search);
    return parametrosURL.get(parametro);
}

function analizarShakedownCSV(csv) {
    return analizarCSVBase(csv, {
        filtrarFila: fila => Boolean(
            (fila.Piloto || fila.PILOTO || fila.Nombre || fila.NOMBRE) &&
            esValorSi(fila.Online || fila.ONLINE)
        )
    });
}

function obtenerPrimerValor(fila, claves) {
    for (const clave of claves) {
        const valor = fila?.[clave];
        if (valor !== undefined && valor !== null && String(valor).trim() !== '') {
            return String(valor).trim();
        }
    }

    return '';
}

function obtenerVuelta(piloto, numero) {
    return obtenerPrimerValor(piloto, [`Pasada${numero}`, `Vuelta${numero}`, `PE${numero}`, `SS${numero}`]);
}

function esTiempoNoTerminado(valor) {
    if (!valor || valor === '') return true;
    if (esDNF(valor)) return true;

    const segundos = tiempoASegundos(valor);
    return segundos <= 0 || segundos >= 999999;
}

function obtenerMejorVuelta(piloto) {
    const vueltas = [1, 2, 3, 4]
        .map(numero => obtenerVuelta(piloto, numero))
        .filter(valor => !esTiempoNoTerminado(valor))
        .map(valor => tiempoASegundos(valor))
        .filter(segundos => segundos < 999999);

    if (vueltas.length === 0) {
        return 999999;
    }

    return Math.min(...vueltas);
}

function formatearDiferencia(segundosDif) {
    if (segundosDif === 0) return '-';
    const texto = segundosATiempo(segundosDif, 1);
    return `+${texto}`;
}

function formatearVueltaShakedown(valor) {
    if (!valor || valor === '') return '-';
    if (esTiempoNoTerminado(valor)) {
        return '<span class="shakedown-vuelta-nt">N/T</span>';
    }

    return `<span class="shakedown-vuelta-tiempo">${valor}</span>`;
}

function normalizarTextoTiempo(valor) {
    if (!valor || valor === '-' || valor === 'N/T') return '';
    return String(valor).trim();
}

function capitalizarTexto(texto) {
    if (!texto) return '';
    return texto.toLowerCase().replace(/(?:^|\s)\S/g, letra => letra.toUpperCase());
}

function renderizarShakedown() {
    const content = document.getElementById('content');

    if (!datosShakedown.length) {
        content.innerHTML = '<div class="error">No se encontraron datos de shakedown.</div>';
        return;
    }

    const categorias = ordenarCategorias(
        [...new Set(datosShakedown.map(p => p.Categoria || p.CATEGORIA))].filter(Boolean)
    );

    let html = '';

    categorias.forEach(categoria => {
        const pilotosCategoria = datosShakedown
            .filter(p => (p.Categoria || p.CATEGORIA) === categoria)
            .map(piloto => {
                const vueltas = [1, 2, 3, 4].map(numero => obtenerVuelta(piloto, numero));
                const mejores = vueltas
                    .filter(valor => !esTiempoNoTerminado(valor))
                    .map(valor => tiempoASegundos(valor))
                    .filter(segundos => segundos < 999999);
                const mejorVuelta = mejores.length > 0 ? Math.min(...mejores) : 999999;

                return {
                    nombre: piloto.Nombre || piloto.NOMBRE || '',
                    vehiculo: piloto.Vehiculo || piloto.VEHICULO || piloto.vehiculo || '',
                    categoria,
                    vueltas,
                    mejorVuelta,
                    mejorVueltaTexto: mejorVuelta < 999999 ? segundosATiempo(mejorVuelta, 3) : '-',
                    mejorIndices: vueltas
                        .map((valor, indice) => ({
                            indice,
                            segundos: esTiempoNoTerminado(valor) ? 999999 : tiempoASegundos(valor)
                        }))
                        .filter(item => item.segundos === mejorVuelta && mejorVuelta < 999999)
                        .map(item => item.indice)
                };
            })
            .sort((a, b) => a.mejorVuelta - b.mejorVuelta);

        if (!pilotosCategoria.length) return;

        const mejorGeneral = pilotosCategoria[0].mejorVuelta;

        html += `
            <div class="categoria-completa mb-5" id="categoria-${categoria.replace(/\s+/g, '-').toLowerCase()}">
                <h3 class="text-center categoria-titulo">${categoria}</h3>
                <div class="tabla-pe-container flex-grow-1">
                    <h4 class="subtitulo-seccion text-center">Clasificación Shakedown</h4>
                    <div class="table-wrapper shakedown-table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th class="col-pos">Pos</th>
                                    <th>Piloto</th>
                                    <th>Marca</th>
                                    <th>Vuelta 1</th>
                                    <th>Vuelta 2</th>
                                    <th>Vuelta 3</th>
                                    <th>Vuelta 4</th>
                                    <th class="col-mejor">Mejor Vta.</th>
                                    <th class="col-dif">Dif. 1&ordm;</th>
                                    <th class="col-dif">Dif. Ant.</th>
                                </tr>
                            </thead>
                            <tbody>
        `;

        pilotosCategoria.forEach((piloto, indice) => {
            const mejor = piloto.mejorVuelta;
            const dif1 = mejor < 999999 && mejorGeneral < 999999 ? mejor - mejorGeneral : null;
            const difAnt = indice > 0 && mejor < 999999 && pilotosCategoria[indice - 1].mejorVuelta < 999999
                ? mejor - pilotosCategoria[indice - 1].mejorVuelta
                : null;
            const claseFila = indice === 0 ? 'pos-1' : '';
            const marca = piloto.vehiculo ? piloto.vehiculo.split(' ')[0] : '-';
            const rutaLogo = piloto.vehiculo ? window.UtilidadesIconos.obtenerRutaLogoMarca(piloto.vehiculo) : '';
            const vueltas = piloto.vueltas || [];
            const mejorVueltaIndices = new Set(piloto.mejorIndices || []);
            const celdaVuelta = (valor, numero) => {
                const claseMejor = mejorVueltaIndices.has(numero - 1) ? 'shakedown-vuelta--rapida' : '';
                return `<td class="${claseMejor}">${formatearVueltaShakedown(valor)}</td>`;
            };

            html += `
                <tr class="${claseFila}">
                    <td class="col-pos"><strong>${indice + 1}</strong></td>
                    <td>${piloto.nombre}</td>
                    <td class="shakedown-marca-cell">
                        <div class="shakedown-marca">
                            ${rutaLogo
                                ? `<img class="shakedown-marca-logo" src="${rutaLogo}" alt="${marca}"
                                    onerror="this.onerror=null; this.remove()">`
                                : '<span class="shakedown-marca-sin-logo">-</span>'
                            }
                        </div>
                    </td>
                    ${celdaVuelta(vueltas[0], 1)}
                    ${celdaVuelta(vueltas[1], 2)}
                    ${celdaVuelta(vueltas[2], 3)}
                    ${celdaVuelta(vueltas[3], 4)}
                    <td class="shakedown-vuelta--mejor">${piloto.mejorVueltaTexto}</td>
                    <td class="col-dif">${dif1 === null ? '-' : formatearDiferencia(dif1)}</td>
                    <td class="col-dif">${difAnt === null ? '-' : formatearDiferencia(difAnt)}</td>
                </tr>
            `;
        });

        html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    });

    content.innerHTML = html || '<div class="error">No se encontraron categorías con datos de shakedown.</div>';
}

async function cargarDatos() {
    const content = document.getElementById('content');

    try {
        const cacheBuster = `&t=${Date.now()}`;
        const [rallyResponse, shakedownResponse, inscriptosResponse] = await Promise.all([
            fetch(URL_RALLY + cacheBuster),
            fetch(URL_SHAKEDOWN + cacheBuster),
            fetch(URL_INSCRIPTOS + cacheBuster)
        ]);

        const rallyText = await rallyResponse.text();
        const shakedownText = await shakedownResponse.text();
        const inscriptosText = await inscriptosResponse.text();

        const rallyData = analizarCSVBase(rallyText);
        const fechaRally = normalizarFechasComparacion(
            rallyData[0]?.Fecha || rallyData[0]?.FECHA || rallyData[0]?.fecha || ''
        );

        const shakedownBase = analizarShakedownCSV(shakedownText);
        const inscriptosData = analizarCSVBase(inscriptosText);

        datosShakedown = fusionarPilotosConInscriptosYCategoria(shakedownBase, inscriptosData, fechaRally)
            .filter(piloto => {
                const pe0 = obtenerPrimerValor(piloto, ['PE0', 'SS0']);
                const pe1 = obtenerPrimerValor(piloto, ['Pasada1', 'Vuelta1', 'PE1', 'SS1']);
                return Boolean(pe1 || pe0);
            });

        const titulo = document.getElementById('title');
        if (titulo) {
            titulo.innerHTML = 'SHAKEDOWN';
        }

        if (content && datosShakedown.length === 0) {
            content.innerHTML = '<div class="error">No se encontraron datos de shakedown.</div>';
            return;
        }

        renderizarShakedown();
        actualizarUltimaActualizacion();
    } catch (error) {
        if (content) {
            content.innerHTML = '<div class="error">Error al cargar los datos de shakedown.</div>';
        }
        console.error('Error al cargar shakedown:', error);
    }
}

function actualizarUltimaActualizacion() {
    const ahora = new Date();
    const horaTexto = ahora.toLocaleTimeString('es-AR');
    const nodo = document.getElementById('lastUpdate');
    if (nodo) {
        nodo.textContent = `Última actualización: ${horaTexto}`;
    }
}

document.addEventListener('DOMContentLoaded', cargarDatos);
