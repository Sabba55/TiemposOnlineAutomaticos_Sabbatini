const TRAMOS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vToRsF3zwvqzcMttSdROC5E4tyHqpQsHaGpxJyRPzf4Aunc5-uX3IddO1vXmn64mt5Uur46HkLekr-d/pub?gid=289895386&single=true&output=csv';
const PILOTOS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS9KuJ4zzR78fTAwcReep3kCYUG7iod7Ly6SzBgFMvd76_414TyhhkEQiWOXs9j3EOAcXKBKlX4Z7Ri/pub?gid=0&single=true&output=csv';
const RALLY_NAME_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vToRsF3zwvqzcMttSdROC5E4tyHqpQsHaGpxJyRPzf4Aunc5-uX3IddO1vXmn64mt5Uur46HkLekr-d/pub?gid=0&single=true&output=csv';
const INSCRIPTOS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vToRsF3zwvqzcMttSdROC5E4tyHqpQsHaGpxJyRPzf4Aunc5-uX3IddO1vXmn64mt5Uur46HkLekr-d/pub?gid=551610778&single=true&output=csv';
const HORARIOS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vToRsF3zwvqzcMttSdROC5E4tyHqpQsHaGpxJyRPzf4Aunc5-uX3IddO1vXmn64mt5Uur46HkLekr-d/pub?gid=2144629647&single=true&output=csv';
const { analizarCSV, esValorSi, fusionarPilotosConInscriptos, normalizarFechasComparacion } = window.UtilidadesCSV;
const { esDNF, tiempoASegundos, segundosATiempo: formatearSegundos, obtenerTiempoEtapa, obtenerClavesTiempo } = window.UtilidadesTiempo;
const { obtenerPeorTiempo, calcularTiempoDNF } = window.UtilidadesDNF;
const { ordenarCategorias } = window.UtilidadesCategorias;

let tramosData = [];
let pilotosData = [];
let inscriptosData = [];
let horariosData = [];
let fechaRallyActiva = [];

async function cargarNombreRally() {
    try {
        const response = await fetch(RALLY_NAME_URL);
        const text = await response.text();
        const data = analizarCSV(text);
        
        if (data.length > 0 && data[0].Nombre && data[0].Nombre.trim() !== '') {
            const nombreRally = data[0].Nombre.trim();
            document.getElementById('rallyName').textContent = nombreRally;
            document.title = nombreRally;
        }

        fechaRallyActiva = normalizarFechasComparacion(data[0]?.Fecha || data[0]?.FECHA || data[0]?.fecha || '');
    } catch (error) {
        console.error('Error al cargar el nombre del rally:', error);
    }
}

function segundosATiempo(segundos) {
    return formatearSegundos(segundos, 3);
}

function capitalizarTexto(texto) {
    if (!texto) return '';
    return texto.toLowerCase().replace(/(?:^|\s)\S/g, function(a) { 
        return a.toUpperCase(); 
    });
}

function contarRepeticionesTramo(desdeHasta, indiceActual) {
    let contador = 0;
    for (let i = 0; i <= indiceActual; i++) {
        const tramoActual = tramosData[i];
        const desdeActual = tramoActual.Desde || '';
        const hastaActual = tramoActual.Hasta || '';
        const textoActual = `${desdeActual} - ${hastaActual}`;
        
        if (textoActual === desdeHasta) {
            contador++;
        }
    }
    return contador;
}

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

function numeroARomano(num) {
    const romanos = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
    return romanos[num - 1] || num.toString();
}

function obtenerGanadorPE(peNumber) {
    let mejorPiloto = null;
    let mejorTiempo = 999999;

    pilotosData.forEach(piloto => {
        const tiempo = obtenerTiempoEtapa(piloto, peNumber);
        if (tiempo && tiempo !== '') {
            const segundos = tiempoASegundos(tiempo);
            if (segundos < mejorTiempo) {
                mejorTiempo = segundos;
                mejorPiloto = {
                    nombre: piloto.Nombre || piloto.NOMBRE || '',
                    tiempo: tiempo,
                    clase: piloto.Categoria || piloto.CATEGORIA || ''
                };
            }
        }
    });

    return mejorPiloto;
}

function convertirHorarioAMinutos(horario) {
    if (!horario || horario === '-' || horario === '') return Infinity;
    
    const match = horario.match(/(\d{1,2}):(\d{2})/);
    if (!match) return Infinity;
    
    const horas = parseInt(match[1]);
    const minutos = parseInt(match[2]);
    return horas * 60 + minutos;
}

function obtenerHorarioMasTemplanoPE(peNumber) {
    let minTiempo = Infinity;
    let horarioMasTemplano = '';
    
    horariosData.forEach(inscripto => {
        const horario = obtenerTiempoEtapa(inscripto, peNumber);
        if (horario && horario !== '-' && horario !== '') {
            const tiempo = convertirHorarioAMinutos(horario);
            if (tiempo < minTiempo) {
                minTiempo = tiempo;
                horarioMasTemplano = horario;
            }
        }
    });
    
    return horarioMasTemplano;
}

function obtenerPowerStagePE() {
    const pes = tramosData
        .filter(t => !esFilaShakedownTramo(t))
        .filter(t => (t['Power Stage'] || '').trim().toLowerCase() === 'si')
        .map(t => t.PE);

    if (pes.length === 1) return pes[0];
    return null; // 0 o 2+ → se ignora
}

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

function validarConsistenciaDatos() {
    const numeroPEs = obtenerTramosCarrera().length;
    
    if (pilotosData.length === 0) {
        return { valido: true };
    }

    const primeraFila = pilotosData[0];
    const columnasTiempo = obtenerClavesTiempo(primeraFila);
    const numeroSS = columnasTiempo.length;
    
    if (numeroPEs !== numeroSS) {
        return {
            valido: false,
            mensaje: `⚠️ INCONSISTENCIA DE DATOS: ⚠️\n\n` +
                    `• PE en tabla de Tramos: ${numeroPEs}\n` +
                    `• Columnas de tiempos en tabla de Pilotos: ${numeroSS}\n\n` +
                    `El número de PE debe coincidir con el número de columnas de tiempos en la tabla de pilotos.\n` +
                    `Por favor, no seas boludo y corregi las hojas de cálculo.`
        };
    }
    
    return { valido: true };
}

async function cargarDatos() {
    try {
        const [rallyResponse, tramosResponse, pilotosResponse, inscriptosResponse, horariosResponse] = await Promise.all([
            fetch(RALLY_NAME_URL),
            fetch(TRAMOS_URL),
            fetch(PILOTOS_URL),
            fetch(INSCRIPTOS_URL),
            fetch(HORARIOS_URL)
        ]);
        
        const rallyText = await rallyResponse.text();
        const tramosText = await tramosResponse.text();
        const pilotosText = await pilotosResponse.text();
        const inscriptosText = await inscriptosResponse.text();
        const horariosText = await horariosResponse.text();
        
        const rallyData = analizarCSV(rallyText);
        fechaRallyActiva = normalizarFechasComparacion(rallyData[0]?.Fecha || rallyData[0]?.FECHA || rallyData[0]?.fecha || '');
        if (rallyData.length > 0 && rallyData[0].Nombre && rallyData[0].Nombre.trim() !== '') {
            const nombreRally = rallyData[0].Nombre.trim();
            document.getElementById('rallyName').textContent = nombreRally;
            document.title = nombreRally;
        }

        tramosData = analizarCSV(tramosText);
        const pilotosBaseData = analizarCSV(pilotosText, {
            filtrarFila: fila => Boolean((fila.Nombre || fila.NOMBRE || fila.Piloto || fila.PILOTO) && esValorSi(fila.Online || fila.ONLINE))
        });
        inscriptosData = analizarCSV(inscriptosText);
        horariosData = analizarCSV(horariosText);
        pilotosData = fusionarPilotosConInscriptos(pilotosBaseData, inscriptosData, fechaRallyActiva);
        window.pilotosData = pilotosData;
        window.tramosData  = tramosData;
        window.horariosData = horariosData;
        
        const validacion = validarConsistenciaDatos();
        if (!validacion.valido) {
            alert(validacion.mensaje);
            document.getElementById('content').innerHTML = 
                '<div class="error"> ' + validacion.mensaje.replace(/\n/g, '<br>') + '</div>';
            return;
        }
        
        renderizarMenu();
        actualizarUltimaActualizacion();
    } catch (error) {
        document.getElementById('content').innerHTML = 
            '<div class="error">Error al cargar los datos. Por favor, verifica que la hoja de cálculo esté publicada correctamente.</div>';
        console.error('Error:', error);
    }
}

function renderizarMenu() {
    if (tramosData.length === 0) {
        document.getElementById('content').innerHTML = 
            '<div class="error">❌ No se encontraron datos de tramos.</div>';
        return;
    }

    const powerStagePE = obtenerPowerStagePE();

    let html = `
        <table>
            <thead>
                <tr>
                    <th class="col-pe">PE</th>
                    <th>Desde - Hasta</th>
                    <th>KMS</th>
                    <th>Hora</th>
                    <th>Resultados</th>
                    <th>Ganador</th>
                </tr>
            </thead>
            <tbody>
    `;

    tramosData.forEach((tramo, index) => {
        const pe = tramo.PE || '';
        const desde = tramo.Desde || '';
        const hasta = tramo.Hasta || '';
        const esShakedown = esFilaShakedownTramo(tramo);
        
        let desdeHasta = '';
        if (esShakedown) {
            desdeHasta = 'Shakedown';
        } else if (desde && hasta) {
            const desdeCapitalizado = capitalizarTexto(desde);
            const hastaCapitalizado = capitalizarTexto(hasta);
            const textoBase = `${desdeCapitalizado} - ${hastaCapitalizado}`;
            const repeticion = contarRepeticionesTramo(`${desde} - ${hasta}`, index);
            const romano = numeroARomano(repeticion);
            desdeHasta = `${textoBase} (${romano})`;
        }
        
        const kms = tramo.KMS || '';
        const hora = esShakedown ? '-' : obtenerHorarioMasTemplanoPE(pe);
        const ganador = esShakedown ? null : obtenerGanadorPE(pe);
        const esPS = pe === powerStagePE;
        
        let ganadorHTML = '-';
        if (ganador) {
            ganadorHTML = `
                <div style="font-weight: 600; color: ${esPS ? '#4c1d95' : '#0f172a'}; margin-bottom: 4px;">${ganador.nombre}</div>
                <div style="font-size: 12px; font-weight: 700; color: #404955;">
                    ${ganador.clase} | ${ganador.tiempo}
                </div>
            `;
        }

        html += `
            <tr>
                <td class="col-pe">
                    <span class="pe-number ${esPS ? 'pe-power-stage' : ''}">
                        ${pe}
                    </span>
                </td>
                <td style="font-weight: 600;">
                    ${desdeHasta}
                    ${esPS ? '<div><span class="badge-power-stage">Power Stage</span></div>' : ''}
                </td>
                <td>${kms}</td>
                <td>${hora}</td>
                <td>
                    <div style="display: flex; gap: 8px; justify-content: center;">
                        ${esShakedown
                            ? `<button class="btn-clases btn-shakedown" onclick="window.location.href='pages/shakedown.html'">
                                    Shakedown
                               </button>`
                            : `
                                <button class="btn-clases" onclick="verGeneral('${pe}')">
                                    General
                                </button>
                                <button class="btn-clases" onclick="verClases('${pe}')">
                                    Por Clases
                                </button>
                              `
                        }
                    </div>
                </td>
                <td class="ganador-cell">${ganadorHTML}</td>
            </tr>
        `;
    });

    html += `
        <tr class="fila-clasificacion-final">
            <td class="col-pe">

            </td>
            <td class="clasificacion-final-label">
                CLASIFICACION FINAL
            </td>
            <td></td>
            <td></td>
            <td class="clasificacion-final-actions">
                <div class="clasificacion-final-actions-inner">
                    <button class="btn-clases btn-clasificacion-final" onclick="verClasificacionFinal()">
                        CLASIFICACION FINAL
                    </button>
                </div>
            </td>
            <td></td>
        </tr>
    `;

    html += `
            </tbody>
        </table>
    `;

    document.getElementById('content').innerHTML = html;
    
    renderizarGanadoresFinales();
}

function verificarPEsCompletas() {
    const totalPEs = obtenerTramosCarrera().length;
    
    const categorias = [...new Set(pilotosData.map(p => p.Categoria || p.CATEGORIA))].filter(c => c);
    
    for (const categoria of categorias) {
        const pilotosCategoria = pilotosData.filter(p => (p.Categoria || p.CATEGORIA) === categoria);
        
        const algunoPilotoCompleto = pilotosCategoria.some(piloto => {
            for (let i = 1; i <= totalPEs; i++) {
                const tiempo = obtenerTiempoEtapa(piloto, i);
                if (!tiempo || tiempo === '') {
                    return false;
                }
            }
            return true;
        });
        
        if (algunoPilotoCompleto) {
            return true;
        }
    }
    
    return false;
}

function calcularClasificacionGeneral(totalPEs) {
    const todosLosPilotos = pilotosData
        .map(piloto => {
            const categoria = piloto.Categoria || piloto.CATEGORIA || '';
            let totalSegundos = 0;
            let tieneDatos = false;
            
            for (let i = 1; i <= totalPEs; i++) {
                const tiempo = obtenerTiempoEtapa(piloto, i);
                
                if (!tiempo || tiempo === '') {
                    return null;
                }
                
                tieneDatos = true;
                
                if (esDNF(tiempo)) {
                    // Peor tiempo filtrado por la misma categoría del piloto
                    const pilotosEsteTramo = pilotosData
                        .filter(p => (p.Categoria || p.CATEGORIA) === categoria && obtenerTiempoEtapa(p, i))
                        .map(p => ({
                            tiempoSegundos: tiempoASegundos(obtenerTiempoEtapa(p, i)),
                            tieneDNF: esDNF(obtenerTiempoEtapa(p, i))
                        }))
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
            
            if (!tieneDatos) return null;
            
            const penalizacion = tiempoASegundos(piloto.PENALIZACION || piloto.Penalizacion || '');
            const penalizacionSegundos = penalizacion < 999999 ? penalizacion : 0;
            const totalConPenalizacion = totalSegundos + penalizacionSegundos;
            
            return {
                nombre: piloto.Nombre || piloto.NOMBRE || '',
                categoria: categoria,
                totalConPenalizacion: totalConPenalizacion
            };
        })
        .filter(p => p !== null)
        .sort((a, b) => a.totalConPenalizacion - b.totalConPenalizacion);
    
    const clasificacion = {};
    todosLosPilotos.forEach((piloto, index) => {
        clasificacion[piloto.nombre] = index + 1;
    });
    
    return clasificacion;
}

function calcularGanadorCategoria(categoria, totalPEs, clasificacionGeneral) {
    const pilotosCategoria = pilotosData
        .filter(p => (p.Categoria || p.CATEGORIA) === categoria)
        .map(piloto => {
            let totalSegundos = 0;
            let tuvoDNF = false;
            
            for (let i = 1; i <= totalPEs; i++) {
                const tiempo = obtenerTiempoEtapa(piloto, i);
                
                if (!tiempo || tiempo === '') {
                    return null;
                }
                
                if (esDNF(tiempo)) {
                    const pilotosEsteTramo = pilotosData
                        .filter(p => (p.Categoria || p.CATEGORIA) === categoria && obtenerTiempoEtapa(p, i))
                        .map(p => ({
                            tiempoSegundos: tiempoASegundos(obtenerTiempoEtapa(p, i)),
                            tieneDNF: esDNF(obtenerTiempoEtapa(p, i))
                        }))
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
            
            const penalizacion = tiempoASegundos(piloto.PENALIZACION || piloto.Penalizacion || '');
            const penalizacionSegundos = penalizacion < 999999 ? penalizacion : 0;
            const totalConPenalizacion = totalSegundos + penalizacionSegundos;
            
            const nombre = piloto.Nombre || piloto.NOMBRE || '';
            
            return {
                nombre: nombre,
                categoria: categoria,
                vehiculo: piloto.Vehiculo || piloto.VEHICULO || piloto.vehiculo || '',
                totalSegundos: totalSegundos,
                penalizacionSegundos: penalizacionSegundos,
                totalConPenalizacion: totalConPenalizacion,
                tiempoFormateado: segundosATiempo(totalConPenalizacion),
                tieneDNF: tuvoDNF,
                posicionGeneral: clasificacionGeneral[nombre] || '-'
            };
        })
        .filter(p => p !== null)
        .sort((a, b) => a.totalConPenalizacion - b.totalConPenalizacion);
    
    return pilotosCategoria.length > 0 ? pilotosCategoria[0] : null;
}

function renderizarGanadoresFinales() {
    if (!verificarPEsCompletas()) {
        return;
    }
    
    const totalPEs = obtenerTramosCarrera().length;
    const categorias = [...new Set(pilotosData.map(p => p.Categoria || p.CATEGORIA))].filter(c => c);
    const categoriaOrdenadas = ordenarCategorias(categorias);
    
    const clasificacionGeneral = calcularClasificacionGeneral(totalPEs);
    const { obtenerRutaLogoMarca } = window.UtilidadesIconos;
    
    let html = '<div class="ganadores-finales-container">';
    html += '<h2 class="ganadores-title">Ganadores por Categoría</h2>';
    html += '<div class="ganadores-grid">';
    
    categoriaOrdenadas.forEach(categoria => {
        const ganador = calcularGanadorCategoria(categoria, totalPEs, clasificacionGeneral);
        
        if (ganador) {
            const rutaLogo = obtenerRutaLogoMarca(ganador.vehiculo);
            const marcaNombre = ganador.vehiculo || '';

            html += `
                <div class="ganador-card">
                    <div class="ganador-categoria">${categoria}</div>
                    <div class="ganador-nombre">${ganador.nombre}</div>
                    ${marcaNombre ? `
                    <div class="ganador-vehiculo">
                        ${rutaLogo
                            ? `<img src="${rutaLogo}" alt="${marcaNombre}"
                                onerror="this.onerror=null; this.style.display='none'">`
                            : ''}
                        <span>${marcaNombre}</span>
                    </div>` : ''}
                    <div class="ganador-stats">
                        <div class="ganador-tiempo-total">
                            <span class="tiempo-label">Tiempo Total</span>
                            <span class="tiempo-valor">${ganador.tiempoFormateado}</span>
                        </div>
                        <div class="ganador-posicion">
                            <span class="tiempo-label">Pos. General</span>
                            <span class="tiempo-valor">P${ganador.posicionGeneral}</span>
                        </div>
                    </div>
                </div>
            `;
        }
    });
    
    html += '</div></div>';
    
    document.getElementById('content').innerHTML += html;
}

function verClases(pe) {
    window.location.href = `pages/tramo.html?pe=${pe}`;
}

function verGeneral(pe) {
    window.location.href = `pages/tramoGeneral.html?pe=${pe}`;
}

function verClasificacionFinal() {
    window.location.href = 'pages/clasificacionFinal.html';
}

function actualizarUltimaActualizacion() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-AR');
    document.getElementById('lastUpdate').textContent = 
        `Última actualización: ${timeStr}`;
}

cargarDatos();
setInterval(cargarDatos, 30000);
