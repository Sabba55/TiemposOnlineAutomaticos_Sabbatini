const URL_PILOTOS = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS9KuJ4zzR78fTAwcReep3kCYUG7iod7Ly6SzBgFMvd76_414TyhhkEQiWOXs9j3EOAcXKBKlX4Z7Ri/pub?gid=0&single=true&output=csv';
const URL_TRAMOS = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vToRsF3zwvqzcMttSdROC5E4tyHqpQsHaGpxJyRPzf4Aunc5-uX3IddO1vXmn64mt5Uur46HkLekr-d/pub?gid=289895386&single=true&output=csv';
const URL_RALLY = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vToRsF3zwvqzcMttSdROC5E4tyHqpQsHaGpxJyRPzf4Aunc5-uX3IddO1vXmn64mt5Uur46HkLekr-d/pub?gid=0&single=true&output=csv';
const INSCRIPTOS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vToRsF3zwvqzcMttSdROC5E4tyHqpQsHaGpxJyRPzf4Aunc5-uX3IddO1vXmn64mt5Uur46HkLekr-d/pub?gid=551610778&single=true&output=csv';
const { analizarCSV: analizarCSVBase, esValorSi, fusionarPilotosConInscriptos, normalizarFechaComparacion } = window.UtilidadesCSV;
const { esDNF, tiempoASegundos: convertirASegundos, segundosATiempo: convertirATiempo, obtenerTiempoEtapa } = window.UtilidadesTiempo;
const { obtenerPeorTiempo, calcularTiempoDNF } = window.UtilidadesDNF;
const { obtenerRutaLogoMarca } = window.UtilidadesIconos;

let datosPilotos = [];
let datosTramos = [];
let numeroPE = '';

function obtenerParametroURL(parametro) {
    const parametrosURL = new URLSearchParams(window.location.search);
    return parametrosURL.get(parametro);
}

function analizarCSV(csv) {
    return analizarCSVBase(csv, {
        filtrarFila: fila => Boolean((fila.Nombre || fila.NOMBRE || fila.Piloto || fila.PILOTO) && esValorSi(fila.Online || fila.ONLINE))
    });
}

function analizarTramosCSV(csv) {
    return analizarCSVBase(csv, {
        filtrarFila: fila => Boolean(fila.PE && fila.PE !== '')
    });
}

function tiempoASegundos(cadenaHora) {
    return convertirASegundos(cadenaHora);
}

function segundosATiempo(segundos) {
    return convertirATiempo(segundos, 2);
}

function segundosATiempoCompleto(segundos) {
    return convertirATiempo(segundos, 3);
}

function formatearDiferencia(segundosDif) {
    if (segundosDif === 0) return '-';
    const texto = segundosATiempo(segundosDif);
    const truncado = texto.replace(/(\.\d)\d+/, '$1');
    return '+' + truncado;
}

function obtenerRutaLogo(vehiculo) {
    return obtenerRutaLogoMarca(vehiculo);
}

function calcularVelocidadPromedio(segundosTiempo, distanciaKm) {
    if (segundosTiempo >= 999999 || !distanciaKm || distanciaKm === '') return '-';

    const distancia = parseFloat(distanciaKm);
    if (isNaN(distancia) || distancia <= 0) return '-';

    const tiempoHoras = segundosTiempo / 3600;
    const velocidad = distancia / tiempoHoras;

    return velocidad.toFixed(0);
}

// ── Navegación entre PEs ──────────────────────────────────────────────────────
function actualizarBotonesNavegacion() {
    const peActual = parseInt(numeroPE);
    const totalPEs = datosTramos.length;

    const btnAnterior = document.getElementById('btnPeAnterior');
    const btnSiguiente = document.getElementById('btnPeSiguiente');

    if (btnAnterior) btnAnterior.disabled = peActual <= 1;
    if (btnSiguiente) btnSiguiente.disabled = peActual >= totalPEs;
}

function navegarPE(direccion) {
    const peActual = parseInt(numeroPE);
    const totalPEs = datosTramos.length;
    const peDestino = peActual + direccion;

    if (peDestino < 1 || peDestino > totalPEs) return;

    window.location.href = `tramo.html?pe=${peDestino}`;
}
// ─────────────────────────────────────────────────────────────────────────────

async function cargarDatos() {
    try {
        const cacheBuster = `&t=${Date.now()}`;

        const [respuestaRally, respuestaPilotos, respuestaTramos, respuestaInscriptos] = await Promise.all([
            fetch(URL_RALLY + cacheBuster),
            fetch(URL_PILOTOS + cacheBuster),
            fetch(URL_TRAMOS + cacheBuster),
            fetch(INSCRIPTOS_URL + cacheBuster)
        ]);

        const textoRally = await respuestaRally.text();
        const textoPilotos = await respuestaPilotos.text();
        const textoTramos = await respuestaTramos.text();
        const textoInscriptos = await respuestaInscriptos.text();

        const rallyData = analizarCSVBase(textoRally);
        const fechaRally = normalizarFechaComparacion(rallyData[0]?.Fecha || rallyData[0]?.FECHA || rallyData[0]?.fecha || '');
        const pilotosBase = analizarCSV(textoPilotos);
        const inscriptosData = analizarCSVBase(textoInscriptos);
        datosPilotos = fusionarPilotosConInscriptos(pilotosBase, inscriptosData, fechaRally);
        datosTramos = analizarTramosCSV(textoTramos);

        renderizarResultados();
        actualizarBotonesNavegacion();
        actualizarUltimaActualizacion();
    } catch (error) {
        document.getElementById('content').innerHTML =
            '<div class="error">Error al cargar los datos.</div>';
        console.error('Error:', error);
    }
}

function calcularTotalAcumulado(piloto, hastaPE) {
    let totalSegundos = 0;

    for (let i = 1; i <= hastaPE; i++) {
        const tiempo = obtenerTiempoEtapa(piloto, i);

        if (!tiempo || tiempo === '') {
            return 999999;
        }

        const segundos = tiempoASegundos(tiempo);

        if (segundos >= 999999) {
            return 999999;
        }

        totalSegundos += segundos;
    }

    return totalSegundos;
}

function calcularPosicionesAnterior(categoria, numeroPEInt) {
    if (numeroPEInt <= 1) return {};

    const pilotosAnterior = datosPilotos
        .filter(p => (p.Categoria || p.CATEGORIA) === categoria)
        .map(p => {
            let totalSegundos = 0;

            for (let i = 1; i < numeroPEInt; i++) {
                const tiempo = obtenerTiempoEtapa(p, i);

                if (!tiempo || tiempo === '') {
                    return null;
                }

                if (esDNF(tiempo)) {
                    const pilotosEsteTramo = datosPilotos
                        .filter(piloto => (piloto.Categoria || piloto.CATEGORIA) === categoria && obtenerTiempoEtapa(piloto, i))
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
                totalConPenalizacion: totalConPenalizacion
            };
        })
        .filter(p => p !== null)
        .sort((a, b) => a.totalConPenalizacion - b.totalConPenalizacion);

    const posiciones = {};
    pilotosAnterior.forEach((piloto, indice) => {
        posiciones[piloto.nombre] = indice + 1;
    });

    return posiciones;
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

function esPowerStage(numeroPE) {
    const pes = datosTramos
        .filter(t => (t['Power Stage'] || '').trim().toLowerCase() === 'si')
        .map(t => t.PE);
    return pes.length === 1 && pes[0] === numeroPE;
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

function mostrarInfoTramo() {
    numeroPE = obtenerParametroURL('pe');
    const tramoActual = datosTramos.find(t => t.PE === numeroPE);
    const tituloElement = document.getElementById('title');

    if (tramoActual) {
        const nombreTramo = obtenerNombreTramo(tramoActual);
        const esPS = esPowerStage(numeroPE);

        if (tituloElement) {
            tituloElement.innerHTML = `
                <span class="titulo-tramo-pe ${esPS ? 'titulo-tramo-pe--power-stage' : ''}">PE ${numeroPE}</span>
                <span class="titulo-tramo-texto">| ${nombreTramo}</span>
            `;
        }
    } else if (tituloElement) {
        tituloElement.textContent = `RESULTADOS - PE ${numeroPE}`;
    }
}

function renderizarResultados() {
    numeroPE = obtenerParametroURL('pe');
    const numeroPEInt = parseInt(numeroPE);

    mostrarInfoTramo();

    if (datosPilotos.length === 0) {
        document.getElementById('content').innerHTML =
            '<div class="error">⚠ No se encontraron datos de pilotos.</div>';
        return;
    }

    const columnaSSActual = `PE${numeroPE}`;
    const tramoActual = datosTramos.find(t => t.PE === numeroPE);
    const distanciaTramo = tramoActual ? tramoActual.KMS : null;

    const categorias = ordenarCategorias(
        [...new Set(datosPilotos.map(p => p.Categoria || p.CATEGORIA))].filter(c => c)
    );

    let htmlCompleto = '';
    const categoriasConDatos = [];

    categorias.forEach(categoria => {
        const pilotosCategoria = datosPilotos
            .filter(p => (p.Categoria || p.CATEGORIA) === categoria && obtenerTiempoEtapa(p, numeroPE))
            .map(p => {
                const totalAcumulado = calcularTotalAcumulado(p, numeroPEInt);
                const valorTiempo = obtenerTiempoEtapa(p, numeroPE);
                const tieneDNF = esDNF(valorTiempo);

                return {
                    nombre: p.Nombre || p.NOMBRE || '',
                    categoria: categoria,
                    tiempoSegundos: tiempoASegundos(valorTiempo),
                    tiempo: segundosATiempo(tiempoASegundos(valorTiempo)),
                    totalSegundos: totalAcumulado,
                    tieneDNF: tieneDNF
                };
            })
            .sort((a, b) => a.tiempoSegundos - b.tiempoSegundos);

        const posicionesAnterior = calcularPosicionesAnterior(categoria, numeroPEInt);

        const pilotosGeneralCategoria = datosPilotos
            .filter(p => (p.Categoria || p.CATEGORIA) === categoria)
            .map(p => {
                let totalSegundos = 0;
                let tuvoDNF = false;

                for (let i = 1; i <= numeroPEInt; i++) {
                    const tiempo = obtenerTiempoEtapa(p, i);

                    if (!tiempo || tiempo === '') {
                        return null;
                    }

                    if (esDNF(tiempo)) {
                        const pilotosEsteTramo = datosPilotos
                            .filter(piloto => (piloto.Categoria || piloto.CATEGORIA) === categoria && obtenerTiempoEtapa(piloto, i))
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
                    vehiculo: p.Vehiculo || p.VEHICULO || p.vehiculo || '',
                    categoria: categoria,
                    totalSegundos: totalSegundos,
                    penalizacionSegundos: penalizacionSegundos,
                    totalConPenalizacion: totalConPenalizacion,
                    tieneDNF: tuvoDNF
                };
            })
            .filter(p => p !== null)
            .sort((a, b) => a.totalConPenalizacion - b.totalConPenalizacion);

        if (pilotosCategoria.length === 0 && pilotosGeneralCategoria.length === 0) return;

        categoriasConDatos.push(categoria);

        const peorTiempoCategoria = obtenerPeorTiempo(pilotosCategoria);
        pilotosCategoria.forEach(piloto => {
            if (piloto.tieneDNF) {
                piloto.tiempoSegundos = calcularTiempoDNF(peorTiempoCategoria);
                piloto.tiempo = segundosATiempo(piloto.tiempoSegundos);
            }
        });
        pilotosCategoria.sort((a, b) => a.tiempoSegundos - b.tiempoSegundos);

        const mejorTiempo = pilotosCategoria.length > 0 ? pilotosCategoria[0].tiempoSegundos : 0;
        const mejorTotal = pilotosGeneralCategoria.length > 0 ? pilotosGeneralCategoria[0].totalConPenalizacion : 0;
        const esPSActual = esPowerStage(numeroPE);

        htmlCompleto += `
            <div class="categoria-completa mb-5" id="categoria-${categoria.replace(/\s+/g, '-').toLowerCase()}">
                <h3 class="text-center categoria-titulo">${categoria}</h3>
                <div class="d-flex justify-content-between gap-4">
                    <div class="tabla-pe-container flex-grow-1">
                        <h4 class="subtitulo-seccion text-center">Clasificación P.E.</h4>
                        <div class="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th class="col-pos">Pos</th>
                                        <th>Piloto</th>
                                        <th class="col-tiempo">Tiempo</th>
                                        <th class="col-dif">Dif. 1°</th>
                                        <th class="col-prom">PROM</th>
                                    </tr>
                                </thead>
                                <tbody>
        `;

        if (pilotosCategoria.length === 0) {
            htmlCompleto += `
                <tr>
                    <td colspan="5" class="no-data">No hay tiempos registrados</td>
                </tr>
            `;
        } else {
            pilotosCategoria.forEach((piloto, indice) => {
                const diferencia = piloto.tiempoSegundos - mejorTiempo;
                const claseFilaDNF = piloto.tieneDNF ? 'fila-dnf' : '';
                const claseFila = indice === 0
                    ? (esPSActual ? 'pos-1 pos-1--power-stage' : 'pos-1')
                    : claseFilaDNF;
                const velocidadProm = calcularVelocidadPromedio(piloto.tiempoSegundos, distanciaTramo);
                const tiempoMostrar = piloto.tieneDNF ? 'DNF' : piloto.tiempo;

                htmlCompleto += `
                    <tr class="${claseFila}">
                        <td class="col-pos"><strong>${indice + 1}</strong></td>
                        <td>${piloto.nombre}</td>
                        <td class="col-tiempo">${tiempoMostrar}</td>
                        <td class="col-dif">${formatearDiferencia(diferencia)}</td>
                        <td class="col-prom">${velocidadProm}</td>
                    </tr>
                `;
            });
        }

        htmlCompleto += `
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="tabla-general-container flex-grow-1">
                        <h4 class="text-center subtitulo-seccion">Clasificación General</h4>
                        <div class="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th class="col-pos">Pos</th>
                                        <th>Piloto</th>
                                        <th style="width:1%">Marca</th>
                                        <th>Tiempo</th>
                                        <th>Penal.</th>
                                        <th>T. Total</th>
                                        <th>Dif. 1°</th>
                                        <th>Dif. Ant.</th>
                                    </tr>
                                </thead>
                                <tbody>
        `;

        if (pilotosGeneralCategoria.length === 0) {
            htmlCompleto += `
                <tr>
                    <td colspan="7" class="no-data">No hay pilotos que completen todos los tramos</td>
                </tr>
            `;
        } else {
            pilotosGeneralCategoria.forEach((piloto, indice) => {
                const posicionActual = indice + 1;
                const posicionAnterior = posicionesAnterior[piloto.nombre];

                let indicadorHTML = '';
                if (posicionAnterior && numeroPEInt > 1) {
                    const cambio = posicionAnterior - posicionActual;
                    if (cambio > 0) {
                        indicadorHTML = `<div class="position-change position-up"><i class="fa-solid fa-arrow-up"></i> +${cambio}</div>`;
                    } else if (cambio < 0) {
                        indicadorHTML = `<div class="position-change position-down"><i class="fa-solid fa-arrow-down"></i> ${cambio}</div>`;
                    }
                }

                const dif1 = piloto.totalConPenalizacion - mejorTotal;
                const difAnt = indice > 0 ? piloto.totalConPenalizacion - pilotosGeneralCategoria[indice - 1].totalConPenalizacion : 0;
                const claseFila = indice === 0 ? 'pos-1' : (piloto.tieneDNF ? 'fila-dnf' : '');

                const tiempoFormateado = segundosATiempoCompleto(piloto.totalSegundos);
                const penalizFormateada = piloto.penalizacionSegundos > 0 ? segundosATiempo(piloto.penalizacionSegundos) : '-';
                const totalFormateado = segundosATiempoCompleto(piloto.totalConPenalizacion);
                const clasePenaliz = piloto.penalizacionSegundos > 0 ? 'penalizacion-activa' : '';
                const rutaLogo = obtenerRutaLogo(piloto.vehiculo);
                const marca = piloto.vehiculo ? piloto.vehiculo.split(' ')[0] : '-';

                htmlCompleto += `
                    <tr class="${claseFila}">
                        <td class="col-pos">
                            <div class="position-cell">
                                <strong>${posicionActual}</strong>
                                ${indicadorHTML}
                            </div>
                        </td>
                        <td>${piloto.nombre}</td>
                        <td>
                            ${rutaLogo
                                ? `<img src="${rutaLogo}" alt="${marca}" style="height:20px; object-fit:contain;"
                                    onerror="this.onerror=null; this.replaceWith(document.createTextNode('${marca}'))">`
                                : marca
                            }
                        </td>
                        <td>${tiempoFormateado}</td>
                        <td class="${clasePenaliz}">${penalizFormateada}</td>
                        <td>${totalFormateado}</td>
                        <td>${formatearDiferencia(dif1)}</td>
                        <td>${formatearDiferencia(difAnt)}</td>
                    </tr>
                `;
            });
        }

        htmlCompleto += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    document.getElementById('content').innerHTML = htmlCompleto;
    renderizarBotonesCategorias(categoriasConDatos);
}

// ── Botones de categoría: scroll ──────────────────────────────────────────────
function scrollACategoria(cat) {
    const id = `categoria-${cat.replace(/\s+/g, '-').toLowerCase()}`;
    const div = document.getElementById(id);
    if (!div) return;

    const ocultas = obtenerCategoriasOcultas();
    if (ocultas.includes(cat)) return;

    div.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderizarBotonesCategorias(categorias) {
    const nav = document.getElementById('categoriasNav');
    if (!nav) return;

    const ocultas = obtenerCategoriasOcultas();

    const botonesHTML = categorias
        .map(cat => {
            const estaOculta = ocultas.includes(cat);
            return `<button 
                class="btn-categoria ${estaOculta ? 'btn-categoria--oculta' : ''}" 
                onclick="scrollACategoria('${cat}')"
                title="${estaOculta ? 'Categoría oculta' : 'Ir a ' + cat}"
            >${cat}</button>`;
        })
        .join('');

    const opcionesHTML = [
        '<option value="" disabled selected>Filtrar categorías</option>',
        '<option value="__todas__">Mostrar todas</option>',
        '<option value="__ninguna__">Ocultar todas</option>',
        ...categorias.map(cat => {
            const oculta = ocultas.includes(cat);
            return `<option value="${cat}">${oculta ? '☐' : '☑'} ${cat}</option>`;
        })
    ].join('');

    const selectHTML = categorias.length === 0 ? '' : `
            <div class="select-filtro-wrapper">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                    aria-hidden="true">
                    <path d="M13 5h8"/>
                    <path d="M13 12h8"/>
                    <path d="M13 19h8"/>
                    <path d="m3 17 2 2 4-4"/>
                    <rect x="3" y="4" width="6" height="6" rx="1"/>
                </svg>
                <select id="selectFiltroCategorias" onchange="aplicarFiltroSelect(this)">
                    ${opcionesHTML}
                </select>
            </div>
        `;

    nav.innerHTML = botonesHTML + selectHTML;

    categorias.forEach(cat => {
        if (ocultas.includes(cat)) ocultarDivCategoria(cat);
        else mostrarDivCategoria(cat);
    });
}
// ─────────────────────────────────────────────────────────────────────────────────

// ── Filtro con select simple ─────────────────────────────────────────────────────
function aplicarFiltroSelect(selectEl) {
    const valor = selectEl.value;
    if (!valor) return;

    const categorias = [...document.querySelectorAll('.categoria-completa')]
        .map(div => div.querySelector('.categoria-titulo')?.textContent.trim())
        .filter(Boolean);

    let nuevasOcultas = obtenerCategoriasOcultas();

    if (valor === '__todas__') {
        nuevasOcultas = [];
    } else if (valor === '__ninguna__') {
        nuevasOcultas = [...categorias];
    } else {
        if (nuevasOcultas.includes(valor)) {
            nuevasOcultas = nuevasOcultas.filter(c => c !== valor);
        } else {
            nuevasOcultas = [...nuevasOcultas, valor];
        }
    }

    guardarCategoriasOcultas(nuevasOcultas);

    categorias.forEach(cat => {
        if (nuevasOcultas.includes(cat)) ocultarDivCategoria(cat);
        else mostrarDivCategoria(cat);
    });

    actualizarEstadoBotonesCategorias(nuevasOcultas);

    // Actualizar los indicadores ●/○ en las opciones
    const opciones = selectEl.querySelectorAll('option[value]:not([value=""]):not([value^="__"])');
    opciones.forEach(opt => {
        const cat = opt.value;
        const oculta = nuevasOcultas.includes(cat);
        opt.textContent = `${oculta ? '☐' : '☑'} ${cat}`;
    });

    // Resetear al placeholder
    selectEl.value = '';
}

function actualizarEstadoBotonesCategorias(ocultas) {
    document.querySelectorAll('.btn-categoria').forEach(btn => {
        const cat = btn.textContent.trim();
        if (ocultas.includes(cat)) {
            btn.classList.add('btn-categoria--oculta');
            btn.title = 'Categoría oculta';
        } else {
            btn.classList.remove('btn-categoria--oculta');
            btn.title = 'Ir a ' + cat;
        }
    });
}

// ─────────────────────────────────────────────────────────────────────────────

// ── Persistencia de categorías ocultas ───────────────────────────────────────
function obtenerCategoriasOcultas() {
    try {
        const guardado = JSON.parse(localStorage.getItem('tramo_categorias_ocultas') || 'null');
        if (!guardado) return [];

        const ahora = Date.now();
        const unDia = 24 * 60 * 60 * 1000;

        if (ahora - guardado.timestamp > unDia) {
            localStorage.removeItem('tramo_categorias_ocultas');
            return [];
        }

        return guardado.categorias || [];
    } catch { return []; }
}

function guardarCategoriasOcultas(ocultas) {
    localStorage.setItem('tramo_categorias_ocultas', JSON.stringify({
        categorias: ocultas,
        timestamp: Date.now()
    }));
}

function ocultarDivCategoria(cat) {
    const id = `categoria-${cat.replace(/\s+/g, '-').toLowerCase()}`;
    const div = document.getElementById(id);
    if (div) div.style.display = 'none';
}

function mostrarDivCategoria(cat) {
    const id = `categoria-${cat.replace(/\s+/g, '-').toLowerCase()}`;
    const div = document.getElementById(id);
    if (div) div.style.display = '';
}
// ─────────────────────────────────────────────────────────────────────────────

function actualizarUltimaActualizacion() {
    const ahora = new Date();
    const horaTexto = ahora.toLocaleTimeString('es-AR');
    document.getElementById('lastUpdate').textContent =
        `Última actualización: ${horaTexto}`;
}

cargarDatos();
setInterval(cargarDatos, 30000);
