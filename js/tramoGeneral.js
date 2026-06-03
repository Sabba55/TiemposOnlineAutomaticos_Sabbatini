const PILOTOS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS9KuJ4zzR78fTAwcReep3kCYUG7iod7Ly6SzBgFMvd76_414TyhhkEQiWOXs9j3EOAcXKBKlX4Z7Ri/pub?gid=0&single=true&output=csv';
const TRAMOS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vToRsF3zwvqzcMttSdROC5E4tyHqpQsHaGpxJyRPzf4Aunc5-uX3IddO1vXmn64mt5Uur46HkLekr-d/pub?gid=289895386&single=true&output=csv';
const RALLY_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vToRsF3zwvqzcMttSdROC5E4tyHqpQsHaGpxJyRPzf4Aunc5-uX3IddO1vXmn64mt5Uur46HkLekr-d/pub?gid=0&single=true&output=csv';
const INSCRIPTOS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vToRsF3zwvqzcMttSdROC5E4tyHqpQsHaGpxJyRPzf4Aunc5-uX3IddO1vXmn64mt5Uur46HkLekr-d/pub?gid=551610778&single=true&output=csv';
const { analizarCSV, esValorSi, fusionarPilotosConInscriptos, normalizarFechaComparacion } = window.UtilidadesCSV;
const { esDNF, tiempoASegundos, segundosATiempo, obtenerTiempoEtapa } = window.UtilidadesTiempo;
const { obtenerPeorTiempo, calcularTiempoDNF } = window.UtilidadesDNF;

let pilotosData = [];
let tramosData = [];
let peNumber = '';

function obtenerParametroURL(parametro) {
    const parametrosURL = new URLSearchParams(window.location.search);
    return parametrosURL.get(parametro);
}

function analizarPilotosCSV(csv) {
    return analizarCSV(csv, {
        filtrarFila: fila => Boolean((fila.Nombre || fila.NOMBRE || fila.Piloto || fila.PILOTO) && esValorSi(fila.Online || fila.ONLINE))
    });
}

function analizarTramosCSV(csv) {
    return analizarCSV(csv, {
        filtrarFila: fila => Boolean(fila.PE && fila.PE !== '')
    });
}

function obtenerNombreTramo(tramoActual) {
    if (!tramoActual) return '';

    const desde = tramoActual.Desde || '';
    const hasta = tramoActual.Hasta || '';

    if (desde && hasta) {
        return `${desde} - ${hasta}`;
    }

    return tramoActual.Nombre || tramoActual.NOMBRE || '';
}

function obtenerPrioridadCategoria(categoria) {
    const categoriaNormalizada = (categoria || '').trim().toUpperCase();

    if (categoriaNormalizada === 'RC2' || categoriaNormalizada === 'RALLY2') {
        return 0;
    }

    if (categoriaNormalizada === 'RCMR') {
        return 1;
    }

    return 2;
}

function obtenerColorCategoriaPredeterminado(categoria) {
    const categoriaNormalizada = (categoria || '').trim().toUpperCase();

    if (categoriaNormalizada === 'RC2' || categoriaNormalizada === 'RALLY2') {
        return 1;
    }

    if (categoriaNormalizada === 'RCMR') {
        return 2;
    }

    if (categoriaNormalizada === 'RC4') {
        return 3;
    }

    if (categoriaNormalizada === 'RC3' || categoriaNormalizada === 'JUNIOR') {
        return 4;
    }

    if (categoriaNormalizada === 'RC5') {
        return 5;
    }

    return null;
}

function ordenarCategorias(categorias) {
    return [...categorias].sort((a, b) => {
        const prioridadA = obtenerPrioridadCategoria(a);
        const prioridadB = obtenerPrioridadCategoria(b);

        if (prioridadA !== prioridadB) {
            return prioridadA - prioridadB;
        }

        return a.localeCompare(b, 'es');
    });
}

function crearMapaColoresCategorias(categorias) {
    const coloresDisponibles = [6, 7, 8];
    let indiceColorDisponible = 0;
    const mapaColores = {};

    categorias.forEach(categoria => {
        const colorPredeterminado = obtenerColorCategoriaPredeterminado(categoria);

        if (colorPredeterminado !== null) {
            mapaColores[categoria] = colorPredeterminado;
            return;
        }

        mapaColores[categoria] = coloresDisponibles[indiceColorDisponible % coloresDisponibles.length];
        indiceColorDisponible++;
    });

    return mapaColores;
}

function formatearDiferencia(segundosDiferencia) {
    if (segundosDiferencia === 0) return '-';
    const texto = segundosATiempo(segundosDiferencia, 2);
    const truncado = texto.replace(/(\.\d)\d+/, '$1');
    return '+' + truncado;
}

function calcularVelocidadPromedio(tiempoSegundos, distanciaKm) {
    if (tiempoSegundos >= 999999 || !distanciaKm || distanciaKm === '') return '-';

    const distancia = parseFloat(distanciaKm);
    if (isNaN(distancia) || distancia <= 0) return '-';

    const tiempoHoras = tiempoSegundos / 3600;
    const velocidad = distancia / tiempoHoras;

    return velocidad.toFixed(0);
}

function calcularVelocidadPromedioTotal(tiempoSegundos, peNumero) {
    if (tiempoSegundos >= 999999) return '-';

    let distanciaTotal = 0;
    for (let i = 1; i <= peNumero; i++) {
        const tramo = tramosData.find(t => t.PE === i.toString());
        if (tramo && tramo.KMS) {
            const distancia = parseFloat(tramo.KMS);
            if (!isNaN(distancia) && distancia > 0) {
                distanciaTotal += distancia;
            }
        }
    }

    if (distanciaTotal === 0) return '-';

    const tiempoHoras = tiempoSegundos / 3600;
    const velocidad = distanciaTotal / tiempoHoras;

    return velocidad.toFixed(0);
}

// ── Navegación entre PEs ──────────────────────────────────────────────────────
function actualizarBotonesNavegacion() {
    const peActual = parseInt(peNumber);
    const totalPEs = tramosData.length;

    const btnAnterior = document.getElementById('btnPeAnterior');
    const btnSiguiente = document.getElementById('btnPeSiguiente');

    if (btnAnterior) btnAnterior.disabled = peActual <= 1;
    if (btnSiguiente) btnSiguiente.disabled = peActual >= totalPEs;
}

function navegarPE(direccion) {
    const peActual = parseInt(peNumber);
    const totalPEs = tramosData.length;
    const peDestino = peActual + direccion;

    if (peDestino < 1 || peDestino > totalPEs) return;

    window.location.href = `tramoGeneral.html?pe=${peDestino}`;
}
// ─────────────────────────────────────────────────────────────────────────────

async function cargarDatos() {
    try {
        const cacheBuster = `&t=${Date.now()}`;

        const [rallyResponse, pilotosResponse, tramosResponse, inscriptosResponse] = await Promise.all([
            fetch(RALLY_URL + cacheBuster),
            fetch(PILOTOS_URL + cacheBuster),
            fetch(TRAMOS_URL + cacheBuster),
            fetch(INSCRIPTOS_URL + cacheBuster)
        ]);

        const rallyText = await rallyResponse.text();
        const pilotosText = await pilotosResponse.text();
        const tramosText = await tramosResponse.text();
        const inscriptosText = await inscriptosResponse.text();

        const rallyData = analizarCSV(rallyText);
        const fechaRally = normalizarFechaComparacion(rallyData[0]?.Fecha || rallyData[0]?.FECHA || rallyData[0]?.fecha || '');
        const pilotosBase = analizarPilotosCSV(pilotosText);
        const inscriptosData = analizarCSV(inscriptosText);
        pilotosData = fusionarPilotosConInscriptos(pilotosBase, inscriptosData, fechaRally);
        tramosData = analizarTramosCSV(tramosText);

        renderizarResultados();
        actualizarBotonesNavegacion();
        actualizarUltimaActualizacion();
    } catch (error) {
        document.getElementById('content').innerHTML =
            '<div class="error">Error al cargar los datos.</div>';
        console.error('Error:', error);
    }
}

function mostrarInfoTramo() {
    peNumber = obtenerParametroURL('pe');
    const tramoActual = tramosData.find(t => t.PE === peNumber);
    const tituloElement = document.getElementById('title');

    if (tramoActual) {
        const nombreTramo = obtenerNombreTramo(tramoActual);

        if (tituloElement) {
            tituloElement.innerHTML = `
                <span class="titulo-tramo-pe">PE ${peNumber}</span>
                <span class="titulo-tramo-texto">| ${nombreTramo}</span>
            `;
        }
    } else if (tituloElement) {
        tituloElement.textContent = `CLASIFICACIÓN GENERAL - PE ${peNumber}`;
    }
}

function renderizarResultados() {
    peNumber = obtenerParametroURL('pe');
    const peNumero = parseInt(peNumber);

    mostrarInfoTramo();

    if (pilotosData.length === 0) {
        document.getElementById('content').innerHTML =
            '<div class="error">No se encontraron datos de pilotos.</div>';
        return;
    }

    const tramoActual = tramosData.find(t => t.PE === peNumber);
    const distanciaTramo = tramoActual ? tramoActual.KMS : null;

    const categorias = ordenarCategorias(
        [...new Set(pilotosData.map(p => p.Categoria || p.CATEGORIA))].filter(c => c)
    );
    const categoriasColor = crearMapaColoresCategorias(categorias);

    const pilotosPE = pilotosData
        .filter(p => obtenerTiempoEtapa(p, peNumber))
        .map(p => {
            const valorTiempo = obtenerTiempoEtapa(p, peNumber);
            const tieneDNF = esDNF(valorTiempo);
            const categoria = p.Categoria || p.CATEGORIA || '';

            return {
                nombre: p.Nombre || p.NOMBRE || '',
                categoria: categoria,
                colorIndex: categoriasColor[categoria] || 1,
                tiempo: valorTiempo,
                tiempoSegundos: tiempoASegundos(valorTiempo),
                tieneDNF: tieneDNF
            };
        })
        .sort((a, b) => a.tiempoSegundos - b.tiempoSegundos);

    const peorTiempoPorCategoria = {};
    categorias.forEach(cat => {
        const pilotosCat = pilotosPE.filter(p => p.categoria === cat);
        peorTiempoPorCategoria[cat] = obtenerPeorTiempo(pilotosCat);
    });

    pilotosPE.forEach(piloto => {
        if (piloto.tieneDNF) {
            const peorTiempoCat = peorTiempoPorCategoria[piloto.categoria] || 0;
            piloto.tiempoSegundos = calcularTiempoDNF(peorTiempoCat);
            piloto.tiempo = segundosATiempo(piloto.tiempoSegundos, 2);
        }
    });

    pilotosPE.sort((a, b) => a.tiempoSegundos - b.tiempoSegundos);

    const mejorTiempo = pilotosPE.length > 0 ? pilotosPE[0].tiempoSegundos : 0;

    let htmlPE = '<div class="section-title">Clasificación P.E.</div>';
    htmlPE += `
        <table>
            <thead>
                <tr>
                    <th class="col-pos">Pos</th>
                    <th>Piloto</th>
                    <th>Tiempo</th>
                    <th>Dif. 1°</th>
                    <th class="col-prom">PROM</th>
                </tr>
            </thead>
            <tbody>
    `;

    pilotosPE.forEach((piloto, index) => {
        const diferencia = piloto.tiempoSegundos - mejorTiempo;
        const claseFilaDNF = piloto.tieneDNF ? 'fila-dnf' : '';
        const claseColor = `category-bg-${piloto.colorIndex}`;
        const rowClass = index === 0 ? 'pos-1' : (claseFilaDNF ? claseFilaDNF : claseColor);
        const velocidadProm = calcularVelocidadPromedio(piloto.tiempoSegundos, distanciaTramo);
        const tiempoMostrar = piloto.tieneDNF ? 'DNF' : piloto.tiempo;

        htmlPE += `
            <tr class="${rowClass}">
                <td class="col-pos"><strong>${index + 1}</strong></td>
                <td>${piloto.nombre}</td>
                <td>${tiempoMostrar}</td>
                <td>${formatearDiferencia(diferencia)}</td>
                <td class="col-prom">${velocidadProm}</td>
            </tr>
        `;
    });

    htmlPE += `
            </tbody>
        </table>
    `;

    const pilotosGeneral = pilotosData
        .map(p => {
            let totalSegundos = 0;
            let tuvoDNF = false;

            for (let i = 1; i <= peNumero; i++) {
                const tiempo = obtenerTiempoEtapa(p, i);

                if (!tiempo || tiempo === '') {
                    return null;
                }

                if (esDNF(tiempo)) {
                    const pilotosEsteTramo = pilotosData
                        .filter(piloto => obtenerTiempoEtapa(piloto, i) && (piloto.Categoria || piloto.CATEGORIA) === (p.Categoria || p.CATEGORIA))
                        .map(piloto => {
                            const valorTiempo = obtenerTiempoEtapa(piloto, i);
                            return {
                                tiempoSegundos: tiempoASegundos(valorTiempo),
                                tieneDNF: esDNF(valorTiempo)
                            };
                        })
                        .sort((a, b) => a.tiempoSegundos - b.tiempoSegundos);

                    const peorTiempoTramo = obtenerPeorTiempo(pilotosEsteTramo);
                    totalSegundos += calcularTiempoDNF(peorTiempoTramo);
                    tuvoDNF = true;
                } else {
                    const segundos = tiempoASegundos(tiempo);
                    if (segundos >= 999999) {
                        return null;
                    }
                    totalSegundos += segundos;
                }
            }

            const penalizacion = tiempoASegundos(p.PENALIZACION || p.Penalizacion || '');
            const penalizacionSegundos = penalizacion < 999999 ? penalizacion : 0;
            const totalConPenalizacion = totalSegundos + penalizacionSegundos;

            return {
                nombre: p.Nombre || p.NOMBRE || '',
                categoria: p.Categoria || p.CATEGORIA || '',
                totalSegundos: totalSegundos,
                penalizacionSegundos: penalizacionSegundos,
                totalConPenalizacion: totalConPenalizacion,
                tieneDNF: tuvoDNF
            };
        })
        .filter(p => p !== null)
        .sort((a, b) => a.totalConPenalizacion - b.totalConPenalizacion);

    const mejorTotal = pilotosGeneral.length > 0 ? pilotosGeneral[0].totalConPenalizacion : 0;

    let htmlGeneral = '<div class="section-title">Clasificación General</div>';
    htmlGeneral += `
        <table>
            <thead>
                <tr>
                    <th class="col-pos">Pos</th>
                    <th>Piloto</th>
                    <th>Clase</th>
                    <th>Tiempo</th>
                    <th>Penal.</th>
                    <th>T. Total</th>
                    <th>Dif. 1°</th>
                    <th>Dif. Ant.</th>
                    <th class="col-prom">PROM</th>
                </tr>
            </thead>
            <tbody>
    `;

    pilotosGeneral.forEach((piloto, index) => {
        const dif1 = piloto.totalConPenalizacion - mejorTotal;
        const difAnt = index > 0 ? piloto.totalConPenalizacion - pilotosGeneral[index - 1].totalConPenalizacion : 0;
        const rowClass = index === 0 ? 'pos-1' : (piloto.tieneDNF ? 'fila-dnf' : '');
        const tiempoFormateado = segundosATiempo(piloto.totalSegundos, 3);
        const penalizFormateada = piloto.penalizacionSegundos > 0 ? segundosATiempo(piloto.penalizacionSegundos, 2) : '-';
        const totalFormateado = segundosATiempo(piloto.totalConPenalizacion, 3);
        const penalizClass = piloto.penalizacionSegundos > 0 ? 'penalizacion-activa' : '';
        const velocidadPromTotal = calcularVelocidadPromedioTotal(piloto.totalConPenalizacion, peNumero);

        htmlGeneral += `
            <tr class="${rowClass}">
                <td class="col-pos"><strong>${index + 1}</strong></td>
                <td>${piloto.nombre}</td>
                <td>${piloto.categoria}</td>
                <td>${tiempoFormateado}</td>
                <td class="${penalizClass}">${penalizFormateada}</td>
                <td>${totalFormateado}</td>
                <td>${formatearDiferencia(dif1)}</td>
                <td>${formatearDiferencia(difAnt)}</td>
                <td class="col-prom">${velocidadPromTotal}</td>
            </tr>
        `;
    });

    htmlGeneral += `
            </tbody>
        </table>
    `;

    const html = `
        <div class="tables-container">
            <div class="table-column table-pe">${htmlPE}</div>
            <div class="table-column table-general">${htmlGeneral}</div>
        </div>
    `;

    document.getElementById('content').innerHTML = html;
}

function actualizarUltimaActualizacion() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-AR');
    document.getElementById('lastUpdate').textContent =
        `Última actualización: ${timeStr}`;
}

cargarDatos();
setInterval(cargarDatos, 30000);
