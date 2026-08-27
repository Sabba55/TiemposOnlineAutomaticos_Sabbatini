const URL_RALLY = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vToRsF3zwvqzcMttSdROC5E4tyHqpQsHaGpxJyRPzf4Aunc5-uX3IddO1vXmn64mt5Uur46HkLekr-d/pub?gid=0&single=true&output=csv';
const URL_TRAMOS = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vToRsF3zwvqzcMttSdROC5E4tyHqpQsHaGpxJyRPzf4Aunc5-uX3IddO1vXmn64mt5Uur46HkLekr-d/pub?gid=289895386&single=true&output=csv';
const URL_PILOTOS = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS9KuJ4zzR78fTAwcReep3kCYUG7iod7Ly6SzBgFMvd76_414TyhhkEQiWOXs9j3EOAcXKBKlX4Z7Ri/pub?gid=0&single=true&output=csv';
const URL_INSCRIPTOS = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vToRsF3zwvqzcMttSdROC5E4tyHqpQsHaGpxJyRPzf4Aunc5-uX3IddO1vXmn64mt5Uur46HkLekr-d/pub?gid=551610778&single=true&output=csv';

const { analizarCSV: analizarCSVBase, esValorSi, fusionarPilotosConInscriptos, normalizarFechasComparacion } = window.UtilidadesCSV;
const { ordenarCategorias } = window.UtilidadesCategorias;
const { esDNF, tiempoASegundos, obtenerTiempoEtapa } = window.UtilidadesTiempo;
const { obtenerPeorTiempo, calcularTiempoDNF } = window.UtilidadesDNF;
const { obtenerRutaLogoMarca } = window.UtilidadesIconos;

let tramosData = [];
let pilotosData = [];
let categoriasConDatos = [];

function esFilaShakedownTramo(tramo) {
    if (!tramo) return false;

    const pe = String(tramo.PE || '').trim();
    const desde = String(tramo.Desde || '').trim();
    const hasta = String(tramo.Hasta || '').trim();

    return pe === '0' && /shakedown/i.test(desde) && (!hasta || /shakedown/i.test(hasta));
}

function obtenerTramosCarrera() {
    return tramosData.filter(tramo => !esFilaShakedownTramo(tramo));
}

function contarDNFsHastaPE(piloto, peLimite) {
    let dnfs = 0;

    for (let i = 1; i <= peLimite; i++) {
        const tiempo = obtenerTiempoEtapa(piloto, i);
        if (esDNF(tiempo)) {
            dnfs++;
        }
    }

    return dnfs;
}

function pilotoSigueActivoEnPE(piloto, peActual) {
    return contarDNFsHastaPE(piloto, peActual - 1) < 3;
}

function obtenerPowerStagePE() {
    const powerStage = obtenerTramosCarrera().filter(t => (t['Power Stage'] || '').trim().toLowerCase() === 'si');
    if (powerStage.length !== 1) return null;
    return powerStage[0].PE || null;
}

function segundosATiempoConDecimales(segundos, decimales) {
    if (!segundos || segundos >= 999999) return '-';

    const horas = Math.floor(segundos / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    const segundosFormateados = (segundos % 60).toFixed(decimales);
    const padding = decimales + 3;

    if (horas > 0) {
        return `${horas}:${String(minutos).padStart(2, '0')}:${String(segundosFormateados).padStart(padding, '0')}`;
    }

    return `${minutos}:${String(segundosFormateados).padStart(padding, '0')}`;
}

function formatearTiempo(segundos) {
    return segundosATiempoConDecimales(segundos, 3);
}

function formatearDiferencia(segundos) {
    if (!segundos || segundos <= 0) return '-';
    return `+${segundosATiempoConDecimales(segundos, 1)}`;
}

function obtenerRutaLogo(vehiculo) {
    return obtenerRutaLogoMarca(vehiculo);
}

function calcularAbandonosCompetencia(pilotos, tramosCarrera, peoresPorTramoYCategoria, totalPEs) {
    const abandonos = [];

    pilotos.forEach(p => {
        const categoria = p.Categoria || p.CATEGORIA || '';
        let dnfsAcumulados = 0;
        let peAbandono = null;

        for (let i = 1; i <= totalPEs; i++) {
            const tiempo = obtenerTiempoEtapa(p, i);

            if (!tiempo || tiempo === '') {
                peAbandono = null;
                break;
            }

            if (esDNF(tiempo)) {
                const peor = peoresPorTramoYCategoria[`${i}_${categoria}`] || 0;
                if (!peor && peor !== 0) {
                    peAbandono = null;
                    break;
                }

                dnfsAcumulados++;
                if (dnfsAcumulados === 3) {
                    peAbandono = i;
                    break;
                }
            }
        }

        if (peAbandono !== null) {
            abandonos.push({
                pe: peAbandono,
                nombre: p.Nombre || p.NOMBRE || '',
                vehiculo: p.Vehiculo || p.VEHICULO || p.vehiculo || '-',
                categoria,
            });
        }
    });

    abandonos.sort((a, b) => a.pe - b.pe || a.nombre.localeCompare(b.nombre, 'es'));
    return abandonos;
}

function calcularClasificacionFinalPorCategorias() {
    const pilotos = pilotosData;
    const tramosCarrera = obtenerTramosCarrera();
    const totalPEs = tramosCarrera.length;
    const categorias = ordenarCategorias(
        [...new Set(pilotos.map(p => p.Categoria || p.CATEGORIA))].filter(Boolean)
    );
    const resultado = {};
    const peoresPorTramoYCategoria = {};

    for (let i = 1; i <= totalPEs; i++) {
        const cats = [...new Set(pilotos.map(p => p.Categoria || p.CATEGORIA))].filter(Boolean);

        cats.forEach(cat => {
            const tiemposTramo = pilotos
                .filter(p => (p.Categoria || p.CATEGORIA) === cat && obtenerTiempoEtapa(p, i) && pilotoSigueActivoEnPE(p, i))
                .map(p => {
                    const tiempo = obtenerTiempoEtapa(p, i);
                    return {
                        tiempoSegundos: tiempoASegundos(tiempo),
                        tieneDNF: esDNF(tiempo),
                    };
                })
                .sort((a, b) => a.tiempoSegundos - b.tiempoSegundos);

            peoresPorTramoYCategoria[`${i}_${cat}`] = obtenerPeorTiempo(tiemposTramo);
        });
    }

    categorias.forEach(cat => {
        const pilotosCat = pilotos
            .filter(p => (p.Categoria || p.CATEGORIA) === cat)
            .map(p => {
                let totalSegundos = 0;
                let tuvoDNF = false;
                let dnfsAcumulados = 0;

                for (let i = 1; i <= totalPEs; i++) {
                    const tiempo = obtenerTiempoEtapa(p, i);

                    if (!tiempo || tiempo === '') {
                        return null;
                    }

                    if (dnfsAcumulados >= 3) {
                        return null;
                    }

                    if (esDNF(tiempo)) {
                        const peor = peoresPorTramoYCategoria[`${i}_${cat}`] || 0;
                        totalSegundos += calcularTiempoDNF(peor);
                        tuvoDNF = true;
                        dnfsAcumulados++;
                    } else {
                        const segundos = tiempoASegundos(tiempo);
                        if (segundos >= 999999) return null;
                        totalSegundos += segundos;
                    }
                }

                if (dnfsAcumulados >= 3) {
                    return null;
                }

                const penalizacion = tiempoASegundos(p.PENALIZACION || p.Penalizacion || '');
                const penalizacionSegundos = penalizacion < 999999 ? penalizacion : 0;
                const totalConPenalizacion = totalSegundos + penalizacionSegundos;

                let distanciaTotal = 0;
                tramosCarrera.forEach(t => {
                    const kms = parseFloat(t.KMS);
                    if (!isNaN(kms)) distanciaTotal += kms;
                });

                const prom = distanciaTotal > 0
                    ? (distanciaTotal / (totalConPenalizacion / 3600)).toFixed(0)
                    : '-';

                return {
                    nombre: p.Nombre || p.NOMBRE || '',
                    vehiculo: p.Vehiculo || p.VEHICULO || p.vehiculo || '-',
                    tiempoSegundos: totalSegundos,
                    penalizacionSegundos: penalizacionSegundos,
                    totalConPenalizacion: totalConPenalizacion,
                    tuvoDNF: tuvoDNF,
                    prom: prom,
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.totalConPenalizacion - b.totalConPenalizacion);

        if (pilotosCat.length > 0) {
            resultado[cat] = pilotosCat;
        }
    });

    const abandonos = calcularAbandonosCompetencia(pilotos, tramosCarrera, peoresPorTramoYCategoria, totalPEs);

    return { resultado, categorias, abandonos };
}

function renderizarBotonesCategorias(categorias) {
    const nav = document.getElementById('categoriasNav');
    if (!nav) return;

    nav.innerHTML = categorias
        .map(cat => `<button class="btn-categoria" onclick="scrollACategoria('${cat}')">${cat}</button>`)
        .join('');
}

function scrollACategoria(cat) {
    const id = `categoria-${cat.replace(/\s+/g, '-').toLowerCase()}`;
    const div = document.getElementById(id);
    if (!div) return;

    div.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderizarResultados() {
    if (!pilotosData || pilotosData.length === 0) {
        document.getElementById('content').innerHTML = '<div class="error">No se encontraron datos de pilotos.</div>';
        return;
    }

    const calculo = calcularClasificacionFinalPorCategorias();
    const categorias = calculo.categorias || [];

    if (categorias.length === 0) {
        document.getElementById('content').innerHTML = '<div class="error">No hay pilotos con clasificacion valida.</div>';
        return;
    }

    categoriasConDatos = categorias;
    renderizarBotonesCategorias(categoriasConDatos);

    const html = categorias.map(cat => {
        const pilotos = calculo.resultado[cat] || [];
        const mejorTiempo = pilotos[0]?.totalConPenalizacion || 0;

        return `
            <div class="categoria-completa" id="categoria-${cat.replace(/\s+/g, '-').toLowerCase()}">
                <h3 class="categoria-titulo">${cat}</h3>
                <div class="tabla-general-container">
                    <div class="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th class="col-pos">POS</th>
                                    <th class="col-piloto">PILOTO</th>
                                    <th class="col-vehiculo">VEHICULO</th>
                                    <th class="col-tiempo">TIEMPO</th>
                                    <th class="col-penal">PENAL.</th>
                                    <th class="col-total">T.TOTAL</th>
                                    <th class="col-dif">DIF. 1º</th>
                                    <th class="col-dif">DIF. ANT.</th>
                                    <th class="col-prom">PROM</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${pilotos.length === 0 ? `
                                    <tr>
                                        <td colspan="9" class="no-data">No hay pilotos con clasificacion valida</td>
                                    </tr>
                                ` : pilotos.map((piloto, indice) => {
                                    const dif1 = piloto.totalConPenalizacion - mejorTiempo;
                                    const difAnt = indice > 0 ? piloto.totalConPenalizacion - pilotos[indice - 1].totalConPenalizacion : 0;
                                    const claseFila = [
                                        indice === 0 ? 'pos-1' : '',
                                        piloto.tuvoDNF ? 'fila-dnf' : ''
                                    ].filter(Boolean).join(' ');
                                    const tiempoFormateado = formatearTiempo(piloto.tiempoSegundos);
                                    const penalFormateada = piloto.penalizacionSegundos > 0 ? formatearTiempo(piloto.penalizacionSegundos) : '-';
                                    const totalFormateado = formatearTiempo(piloto.totalConPenalizacion);
                                    const rutaLogo = obtenerRutaLogo(piloto.vehiculo);
                                    const marca = piloto.vehiculo ? piloto.vehiculo.split(' ')[0] : '-';
                                    return `
                                        <tr class="${claseFila}">
                                            <td class="col-pos"><strong>${indice + 1}</strong></td>
                                            <td class="col-piloto">${piloto.nombre}</td>
                                            <td class="col-vehiculo">
                                                <div class="vehiculo-cell">
                                                    ${rutaLogo
                                                        ? `<img src="${rutaLogo}" alt="${marca}" class="vehiculo-logo" onerror="this.onerror=null; this.replaceWith(document.createTextNode('${marca}'))">`
                                                        : ''
                                                    }
                                                    <span class="vehiculo-texto">${piloto.vehiculo}</span>
                                                </div>
                                            </td>
                                            <td class="col-tiempo">${tiempoFormateado}</td>
                                            <td class="col-penal ${piloto.penalizacionSegundos > 0 ? 'penalizacion-activa' : ''}">${penalFormateada}</td>
                                            <td class="col-total total-puntos">${totalFormateado}</td>
                                            <td class="col-dif">${formatearDiferencia(dif1)}</td>
                                            <td class="col-dif">${formatearDiferencia(difAnt)}</td>
                                            <td class="col-prom">${piloto.prom}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    const abandonos = calculo.abandonos || [];
    const htmlAbandonos = `
        <div class="abandonos-container">
            <div class="abandonos-header">
                <span>${abandonos.length} ABANDONOS</span>
            </div>
            <div class="abandonos-body">
                ${abandonos.length === 0 ? `
                    <div class="abandonos-empty">No hay pilotos con 3 o mas DNF</div>
                ` : abandonos.map(abandono => {
                    const rutaLogo = obtenerRutaLogo(abandono.vehiculo);
                    const marca = abandono.vehiculo ? abandono.vehiculo.split(' ')[0] : '-';

                    return `
                        <div class="abandono-row">
                            <div class="abandono-pe">
                                <span class="abandono-pe-badge">PE${abandono.pe}</span>
                            </div>
                            <div class="abandono-clase">${abandono.categoria}</div>
                            <div class="abandono-nombre">${abandono.nombre}</div>
                            <div class="abandono-vehiculo">
                                <div class="vehiculo-cell vehiculo-cell--abandonos">
                                    ${rutaLogo
                                        ? `<img src="${rutaLogo}" alt="${marca}" class="vehiculo-logo" onerror="this.onerror=null; this.replaceWith(document.createTextNode('${marca}'))">`
                                        : ''
                                    }
                                    <span class="vehiculo-texto">${abandono.vehiculo}</span>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;

    document.getElementById('content').innerHTML = html + htmlAbandonos;
}

function actualizarUltimaActualizacion() {
    const ahora = new Date();
    const hora = ahora.toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
    const el = document.getElementById('lastUpdate');
    if (el) {
        el.textContent = `Ultima actualizacion: ${hora}`;
    }
}

async function cargarDatos() {
    try {
        const cacheBuster = `&t=${Date.now()}`;
        const [rallyResponse, tramosResponse, pilotosResponse, inscriptosResponse] = await Promise.all([
            fetch(URL_RALLY + cacheBuster),
            fetch(URL_TRAMOS + cacheBuster),
            fetch(URL_PILOTOS + cacheBuster),
            fetch(URL_INSCRIPTOS + cacheBuster),
        ]);

        const rallyText = await rallyResponse.text();
        const tramosText = await tramosResponse.text();
        const pilotosText = await pilotosResponse.text();
        const inscriptosText = await inscriptosResponse.text();

        const rallyData = analizarCSVBase(rallyText);
        const nombreRally = rallyData[0]?.Nombre || rallyData[0]?.NOMBRE || 'Clasificacion Final';
        const fechaRally = normalizarFechasComparacion(rallyData[0]?.Fecha || rallyData[0]?.FECHA || rallyData[0]?.fecha || '');

        const pilotosBase = analizarCSVBase(pilotosText, {
            filtrarFila: fila => Boolean((fila.Nombre || fila.NOMBRE || fila.Piloto || fila.PILOTO) && esValorSi(fila.Online || fila.ONLINE))
        });

        const inscriptos = analizarCSVBase(inscriptosText);
        tramosData = analizarCSVBase(tramosText);
        pilotosData = fusionarPilotosConInscriptos(pilotosBase, inscriptos, fechaRally);

        window.pilotosData = pilotosData;
        window.tramosData = tramosData;

        document.title = nombreRally;

        renderizarResultados();
        actualizarUltimaActualizacion();
    } catch (error) {
        window.UtilidadesError.mostrarError(
            document.getElementById('content'),
            'Error al cargar la clasificación final.',
            cargarDatos
        );
        
        console.error('Error cargando clasificación final:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    cargarDatos();
});
