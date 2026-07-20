const URL_PILOTOS = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS9KuJ4zzR78fTAwcReep3kCYUG7iod7Ly6SzBgFMvd76_414TyhhkEQiWOXs9j3EOAcXKBKlX4Z7Ri/pub?gid=0&single=true&output=csv';
const URL_TRAMOS  = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vToRsF3zwvqzcMttSdROC5E4tyHqpQsHaGpxJyRPzf4Aunc5-uX3IddO1vXmn64mt5Uur46HkLekr-d/pub?gid=289895386&single=true&output=csv';
const URL_RALLY = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vToRsF3zwvqzcMttSdROC5E4tyHqpQsHaGpxJyRPzf4Aunc5-uX3IddO1vXmn64mt5Uur46HkLekr-d/pub?gid=0&single=true&output=csv';

const URL_INSCRIPTOS = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vToRsF3zwvqzcMttSdROC5E4tyHqpQsHaGpxJyRPzf4Aunc5-uX3IddO1vXmn64mt5Uur46HkLekr-d/pub?gid=551610778&single=true&output=csv';

const { analizarCSV: analizarCSVBase, esValorSi, fusionarPilotosConInscriptos, normalizarFechasComparacion } = window.UtilidadesCSV;
const { esDNF, tiempoASegundos, segundosATiempo } = window.UtilidadesTiempo;
const { obtenerRutaLogoMarca } = window.UtilidadesIconos;

const {
    obtenerCategoriasConTiempos,
    calcularPosicionesAcumuladas,
    calcularTotalInscriptos,
    calcularInscriptos,
    calcularDNFs,
    calcularPorcentajeSinDNF,
    calcularGanadoresPorTramo,
    calcularMayorGanador,
    calcularMarcaMasGanadora,
    calcularVelocidadMaxima,
    calcularTramoMasDisputado,
    calcularPilotoMasConsistente,
    calcularRemontadaPorTiempo,
    calcularRemontadaPorPosicion,
    calcularPilotoMasPosicionesPerdidas,
    calcularEvolucionTop5,
    calcularDatosHeatmap,
    pilotosDeCat,
    ultimoPEConDatos,
    hayTiemposRegistrados,
    calcularKmsTotales,
    calcularResumenGeneral,
    calcularTramoMasRapidoGeneral,
    calcularTramoMasDisputadoGeneral,
    calcularPilotoMayoresSanciones,
    calcularPilotoMasConsistenteGeneral,
    calcularTablasMarcas,
    calcularTramoConMasDNFs,
} = window.UtilidadesCalculos;

const {
    getCategoriaActiva,
    setCategoriaActiva,
    getCategoriaGuardada,
    getHeatmapFilas,
    setHeatmapFilas,
    getEstadoHeatmap,
    setEstadoHeatmap,
    deleteEstadoHeatmap,
} = window.UtilidadesEstado;

let datosPilotos = [];
let datosTramos  = [];

// ── Parseo ────────────────────────────────────────────────────────────────────

function analizarPilotosCSV(csv) {
    return analizarCSVBase(csv, {
        filtrarFila: fila => Boolean((fila.Nombre || fila.NOMBRE || fila.Piloto || fila.PILOTO) && esValorSi(fila.Online || fila.ONLINE))
    });
}

function analizarTramosCSV(csv) {
    return analizarCSVBase(csv, {
        filtrarFila: fila => {
            const pe = String(fila.PE || '').trim();
            const desde = String(fila.Desde || '').trim();
            const hasta = String(fila.Hasta || '').trim();
            const esShakedown = pe === '0' && /shakedown/i.test(desde) && (!hasta || /shakedown/i.test(hasta));

            return Boolean(pe && pe !== '' && !esShakedown);
        }
    });
}

// ── Botones de categoría ──────────────────────────────────────────────────────

function renderizarBotonesCategorias(categorias) {
    const nav = document.getElementById('categoriasNav');
    if (!nav) return;

    const hayTiempos = hayTiemposRegistrados(datosPilotos, datosTramos);

    const btnGeneral = hayTiempos
        ? `<button
                class="btn-categoria${getCategoriaActiva() === 'General' ? ' activo' : ''}"
                onclick="seleccionarCategoria('General')"
            >General</button>`
        : '';

    nav.innerHTML = btnGeneral + categorias
        .map(cat => {
            const esActiva = cat === getCategoriaActiva();
            return `<button
                class="btn-categoria${esActiva ? ' activo' : ''}"
                onclick="seleccionarCategoria('${cat}')"
            >${cat}</button>`;
        })
        .join('');
}

function seleccionarCategoria(categoria) {
    setCategoriaActiva(categoria);

    document.querySelectorAll('.btn-categoria').forEach(btn => {
        btn.classList.toggle('activo', btn.textContent === categoria);
    });

    if (categoria === 'General') {
        renderizarEstadisticasGenerales();
    } else {
        renderizarEstadisticasCategoria(categoria);
    }
}

// ── Render principal ──────────────────────────────────────────────────────────

function renderizarEstadisticasCategoria(categoria) {
    const contenedor = document.getElementById('content');

    const ganadoresPE      = calcularGanadoresPorTramo(categoria, datosPilotos, datosTramos);
    const mayorGanador     = calcularMayorGanador(ganadoresPE);
    const marcaMasGanadora = calcularMarcaMasGanadora(ganadoresPE, categoria, datosPilotos, datosTramos);
    const porcentajeSinDNF = calcularPorcentajeSinDNF(categoria, datosPilotos, datosTramos);
    const velocidadMax     = calcularVelocidadMaxima(categoria, datosPilotos, datosTramos);
    const consistente      = calcularPilotoMasConsistente(categoria, datosPilotos, datosTramos);
    const remontadaTiempo  = calcularRemontadaPorTiempo(categoria, datosPilotos, datosTramos);
    const remontadaPos     = calcularRemontadaPorPosicion(categoria, datosPilotos, datosTramos);
    const tramoDisputado   = calcularTramoMasDisputado(categoria, datosPilotos, datosTramos);
    const posicionesPerdidas = calcularPilotoMasPosicionesPerdidas(categoria, datosPilotos, datosTramos);

    contenedor.innerHTML = [
        renderizarResumen(categoria, porcentajeSinDNF),
        renderizarGanadores(categoria, ganadoresPE, mayorGanador, marcaMasGanadora),
        renderizarEvolucionTop5(categoria),
        renderizarHeatmapRendimiento(categoria),
        renderizarFilaInferior(velocidadMax, consistente, categoria, tramoDisputado, remontadaTiempo, remontadaPos, posicionesPerdidas),
    ].join('');
}

function renderizarEstadisticasGenerales() {
    const contenedor = document.getElementById('content');

    const kms                = calcularKmsTotales(datosTramos);
    const resumen            = calcularResumenGeneral(datosPilotos, datosTramos, window.inscriptosData || []);
    const tramoRapido        = calcularTramoMasRapidoGeneral(datosPilotos, datosTramos);
    const tramoDisputado     = calcularTramoMasDisputadoGeneral(datosPilotos, datosTramos);
    const mayorSancion       = calcularPilotoMayoresSanciones(datosPilotos, datosTramos);
    const consistenteGeneral = calcularPilotoMasConsistenteGeneral(datosPilotos, datosTramos);
    const tablaMarcas        = calcularTablasMarcas(datosPilotos, datosTramos);
    const tramoMasDNFs       = calcularTramoConMasDNFs(datosPilotos, datosTramos);

    const colorPorcentaje = resumen.porcentaje === null ? '#16a34a'
        : resumen.porcentaje < 30  ? '#dc2626'
        : resumen.porcentaje <= 70 ? '#ea580c'
        :                            '#16a34a';

    const htmlPorcentaje = resumen.porcentaje !== null
        ? `<div class="tarjeta-resumen">
               <div class="seccion-titulo">Finalizaron sin DNF</div>
               <div class="tarjeta-valor" style="color:${colorPorcentaje};">${resumen.porcentaje}%</div>
               <div class="tarjeta-label">${resumen.sinDNF} de ${resumen.largaron} vehículos completaron todos los PE</div>
           </div>`
        : `<div class="tarjeta-resumen">
               <div class="seccion-titulo">Finalizaron sin DNF</div>
               <div class="no-data">Sin información</div>
           </div>`;

    const htmlKms = kms
        ? `<div class="tarjeta-resumen" style="text-align:center;">
            <div class="seccion-titulo">Kilómetros totales</div>
            <div class="tarjeta-valor" style="font-size:42px;">${kms} <span style="font-size:22px;font-weight:700;color:var(--color-texto-suave);">km</span></div>
            <div class="tarjeta-label">cronometrados en ${datosTramos.length} PE${datosTramos.length !== 1 ? 's' : ''}</div>
        </div>`
        : '';

    const htmlMayorSancion = mayorSancion
        ? `<div class="tarjeta-velocidad" style="--accent:#dc2626;">
               <div class="seccion-titulo">Piloto mas sancionado</div>
               <div class="velocidad-piloto">${mayorSancion.nombre}</div>
               <div style="text-align:center;font-size:13px;color:var(--color-texto-suave);margin-bottom:10px;">${mayorSancion.categoria}</div>
               <div class="velocidad-numero-row">
                   <span class="velocidad-numero" style="color:#dc2626;font-size:32px;">${mayorSancion.penDisplay}</span>
               </div>
               <div class="velocidad-detalle">
                   <span>Total de penalizaciones acumuladas</span>
               </div>
           </div>`
        : '';

    const colsFila = mayorSancion ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)';

    contenedor.innerHTML = `

        <div class="resumen-grid">
            <div class="tarjeta-resumen">
                <div class="seccion-titulo">Inscriptos</div>
                <div class="tarjeta-valor">${resumen.totalInscriptos}</div>
                <div class="tarjeta-label">anotados</div>
            </div>
            <div class="tarjeta-resumen">
                <div class="seccion-titulo">Largaron</div>
                <div class="tarjeta-valor">${resumen.largaron}</div>
                <div class="tarjeta-label">pilotos</div>
            </div>
            <div class="tarjeta-resumen tarjeta-dnf">
                <div class="seccion-titulo">Abandonos</div>
                <div class="tarjeta-valor">${resumen.dnfs}</div>
                <div class="tarjeta-label">abandonos registrados</div>
            </div>
            ${htmlPorcentaje}
        </div>

        <div style="display:grid;grid-template-columns:1fr 340px;gap:20px;margin-bottom:30px;align-items:center;">
            <div>
                ${_renderTablaMarcas(tablaMarcas)}
            </div>
            <div style="display:flex;flex-direction:column;gap:20px;">
                ${htmlKms}
                ${_renderTramoConMasDNFs(tramoMasDNFs)}
            </div>
        </div>

        <div class="fila-inferior" style="grid-template-columns:${colsFila};">
            ${_renderVelocidad(tramoRapido)}
            ${_renderTramoDisputado(tramoDisputado)}
            ${_renderConsistenteGeneral(consistenteGeneral)}
            ${htmlMayorSancion}
        </div>
    `;
}

// ── Render: resumen ───────────────────────────────────────────────────────────

function renderizarResumen(categoria, porcentajeSinDNF) {
    const totalInscriptos = calcularTotalInscriptos(categoria, datosPilotos, window.inscriptosData || []);
    const largaron        = calcularInscriptos(categoria, datosPilotos, datosTramos);
    const dnfs            = calcularDNFs(categoria, datosPilotos, datosTramos);

    const colorPorcentaje = !porcentajeSinDNF          ? '#16a34a'
        : porcentajeSinDNF.porcentaje < 30              ? '#dc2626'
        : porcentajeSinDNF.porcentaje <= 70              ? '#ea580c'
        :                                                  '#16a34a';

    const htmlPorcentaje = porcentajeSinDNF
        ? `<div class="tarjeta-resumen tarjeta-sin-dnf">
               <div class="seccion-titulo">Finalizaron sin DNF</div>
               <div class="tarjeta-valor" style="color:${colorPorcentaje};">${porcentajeSinDNF.porcentaje}%</div>
               <div class="tarjeta-label">${porcentajeSinDNF.sinDNF} de ${porcentajeSinDNF.total} vehículos completaron todos los PE</div>
           </div>`
        : `<div class="tarjeta-resumen">
               <div class="seccion-titulo">Finalizaron sin DNF</div>
               <div class="no-data">Sin información</div>
           </div>`;

    return `
        <div class="resumen-grid">
            <div class="tarjeta-resumen">
                <div class="seccion-titulo">Inscriptos</div>
                <div class="tarjeta-valor">${totalInscriptos}</div>
                <div class="tarjeta-label">anotados</div>
            </div>
            <div class="tarjeta-resumen">
                <div class="seccion-titulo">Largaron</div>
                <div class="tarjeta-valor">${largaron}</div>
                <div class="tarjeta-label">pilotos</div>
            </div>
            <div class="tarjeta-resumen tarjeta-dnf">
                <div class="seccion-titulo">Abandonos</div>
                <div class="tarjeta-valor">${dnfs}</div>
                <div class="tarjeta-label">abandonos registrados</div>
            </div>
            ${htmlPorcentaje}
        </div>`;
}

// ── Render: ganadores por tramo ───────────────────────────────────────────────

function renderizarGanadores(categoria, ganadoresPE, mayorGanador, marcaMasGanadora) {
    let htmlFilas = '';

    if (ganadoresPE.length === 0) {
        htmlFilas = `<tr><td colspan="4" class="no-data">Sin tiempos registrados</td></tr>`;
    } else {
        ganadoresPE.forEach(({ pe, ganador, tiempo }) => {
            const pilotoData = pilotosDeCat(categoria, datosPilotos, datosTramos)
                .find(p => (p.Nombre || p.NOMBRE) === ganador);
            const vehiculo = pilotoData
                ? (pilotoData.Vehiculo || pilotoData.VEHICULO || pilotoData.vehiculo || '—')
                : '—';
            const rutaLogo = obtenerRutaLogoMarca(vehiculo);
            const marca = vehiculo.trim().split(' ')[0];

            htmlFilas += `
                <tr>
                    <td class="col-pos"><div class="pe-cell"><span class="pe-badge">PE ${pe}</span></div></td>
                    <td class="col-ganador"><div class="piloto-cell">${ganador}</div></td>
                    <td class="col-vehicle">
                        <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;justify-content:center;">
                            ${rutaLogo ? `<img src="${rutaLogo}" alt="${marca}" style="height:18px;object-fit:contain;" onerror="this.style.display='none'">` : ''}
                            <span style="font-size:13px;font-weight:600;color:var(--color-texto);">${vehiculo}</span>
                        </div>
                    </td>
                    <td class="col-tiempo tiempo-cell"><span class="tiempo-val">${tiempo}</span></td>
                </tr>`;
        });
    }

    const htmlMayorGanador = _renderTarjetaMayorGanador(mayorGanador);
    const htmlMarcaMasGanadora = _renderTarjetaMarcaGanadora(marcaMasGanadora);

    return `
        <div class="ganadores-layout">
            <div>
                <div class="seccion-titulo">Ganadores por tramo</div>
                <div class="tbl-ganadores-outer">
                    <table>
                        <thead>
                            <tr>
                                <th class="center">PE</th>
                                <th class="center">Ganador</th>
                                <th class="center">Vehículo</th>
                                <th class="center">Tiempo</th>
                            </tr>
                        </thead>
                        <tbody>${htmlFilas}</tbody>
                    </table>
                </div>
            </div>
            <div class="ganadores-derecha">
                ${htmlMayorGanador}
                ${htmlMarcaMasGanadora}
            </div>
        </div>`;
}

function _renderTarjetaMayorGanador(mayorGanador) {
    if (!mayorGanador) return '';

    if (mayorGanador.todosDistintos) {
        return `
            <div class="tarjeta-mayor-ganador">
                <div class="mayor-ganador-label">Mayor ganador de tramos</div>
                <div class="mayor-ganador-todos-distintos">Cada tramo fue ganado por un piloto diferente</div>
            </div>`;
    }

    const etiqueta = mayorGanador.lideres.length > 1 ? 'Mayor ganadores de tramos' : 'Mayor ganador de tramos';
    const nombresHTML = mayorGanador.lideres.map(l => `<div class="mayor-ganador-nombre">${l.nombre}</div>`).join('');

    return `
        <div class="tarjeta-mayor-ganador">
            <div class="mayor-ganador-label">${etiqueta}</div>
            ${nombresHTML}
            <div class="mayor-ganador-victorias">${mayorGanador.lideres[0].victorias}</div>
            <div class="mayor-ganador-victorias-label">victoria${mayorGanador.lideres[0].victorias !== 1 ? 's' : ''}</div>
        </div>`;
}

function _renderTarjetaMarcaGanadora(marcaMasGanadora) {
    if (!marcaMasGanadora) return '';

    if (marcaMasGanadora.todosDistintos) {
        return `
            <div class="tarjeta-mayor-ganador tarjeta-marca-ganadora">
                <div class="mayor-ganador-label">Marca más ganadora de tramos</div>
                <div class="mayor-ganador-todos-distintos">Cada tramo fue ganado por una marca diferente</div>
            </div>`;
    }

    const marcasHTML = marcaMasGanadora.marcasLideres.map(({ marca }) => {
        const logo = obtenerRutaLogoMarca(marca + ' x');
        const esToyota = marca.trim().toLowerCase() === 'toyota';
        const logoStyle = esToyota ? 'style="filter:brightness(0) invert(1);"' : '';
        return `
            <div class="marca-ganadora-fila">
                ${logo ? `<img src="${logo}" alt="${marca}" class="marca-ganadora-logo" ${logoStyle} onerror="this.style.display='none'">` : ''}
                <span class="mayor-ganador-nombre" style="margin:0;">${marca}</span>
            </div>`;
    }).join('');

    const etiqueta = marcaMasGanadora.marcasLideres.length > 1 ? 'Marcas más ganadoras' : 'Marca más ganadora de tramos';

    return `
        <div class="tarjeta-mayor-ganador tarjeta-marca-ganadora">
            <div class="mayor-ganador-label">${etiqueta}</div>
            ${marcasHTML}
            <div class="mayor-ganador-victorias">${marcaMasGanadora.marcasLideres[0].victorias}</div>
            <div class="mayor-ganador-victorias-label">victoria${marcaMasGanadora.marcasLideres[0].victorias !== 1 ? 's' : ''}</div>
        </div>`;
}

// ── Render: fila inferior ─────────────────────────────────────────────────────

function renderizarFilaInferior(velocidadMax, consistente, categoria, tramoDisputado, remontadaTiempo, remontadaPos, posicionesPerdidas) {
    return `
        <div class="fila-inferior">
            ${_renderVelocidad(velocidadMax)}
            ${_renderConsistente(consistente, categoria)}
            ${_renderTramoDisputado(tramoDisputado)}
            ${_renderRemontadaTiempo(remontadaTiempo)}
            ${_renderRemontadaPos(remontadaPos)}
            ${_renderPosicionesPerdidas(posicionesPerdidas)}
        </div>`;
}

function _renderVelocidad(velocidadMax) {
    if (!velocidadMax) {
        return `
            <div class="tarjeta-velocidad">
                <div class="seccion-titulo">Velocidad promedio más alta</div>
                <div class="no-data">Sin datos de distancia</div>
            </div>`;
    }
    return `
        <div class="tarjeta-velocidad">
            <div class="seccion-titulo">Velocidad promedio más alta</div>
            <div class="velocidad-piloto">${velocidadMax.piloto}</div>
            <div class="velocidad-numero-row">
                <span class="velocidad-numero">${velocidadMax.velocidad}</span>
                <span class="velocidad-unidad">km/h</span>
            </div>
            <div class="velocidad-detalle">
                <span>Tiempo: ${velocidadMax.tiempo} | ${velocidadMax.pe}${velocidadMax.kms ? `  ${velocidadMax.kms} km` : ''}</span>
            </div>
        </div>`;
}

function _renderConsistente(consistente, categoria) {
    if (!consistente) {
        return `
            <div class="tarjeta-consistencia">
                <div class="seccion-titulo">Piloto más consistente</div>
                <div class="no-data">Sin información</div>
            </div>`;
    }

    const ultimoPE = ultimoPEConDatos(categoria, datosPilotos, datosTramos);
    const posFin = ultimoPE > 0
        ? calcularPosicionesAcumuladas(categoria, ultimoPE, datosPilotos, datosTramos)[consistente.nombre] ?? null
        : null;

    return `
        <div class="tarjeta-consistencia">
            <div class="seccion-titulo">Piloto más consistente</div>
            <div class="consistencia-piloto">${consistente.nombre}</div>
            ${posFin !== null ? `<div class="consistencia-pos-final">Finalizó <strong>${posFin}°</strong></div>` : ''}
            <div class="consistencia-desvio">${consistente.desvio}%</div>
            <div class="consistencia-desvio-label">variación promedio</div>
            <div class="consistencia-explicacion">
                Menor variación porcentual de tiempos entre tramos repetidos.
                Cuanto más bajo, más regular es el piloto.
            </div>
        </div>`;
}

function _renderConsistenteGeneral(consistente) {
    if (!consistente) {
        return `
            <div class="tarjeta-consistencia">
                <div class="seccion-titulo">Piloto más consistente</div>
                <div class="no-data">Sin información</div>
            </div>`;
    }
    return `
        <div class="tarjeta-consistencia">
            <div class="seccion-titulo">Piloto más consistente</div>
            <div class="consistencia-piloto">${consistente.nombre}</div>
            <div style="text-align:center;font-size:13px;color:var(--color-texto-suave);margin-bottom:10px;">${consistente.categoria}</div>
            <div class="consistencia-desvio">${consistente.desvio}%</div>
            <div class="consistencia-desvio-label">variación promedio</div>
            <div class="consistencia-explicacion">
                Cuanto más bajo, más regular es el piloto.
            </div>
        </div>`;
}

function _fmtDif(seg) {
    const total = Math.abs(seg);
    const m  = Math.floor(total / 60);
    const s  = Math.floor(total % 60);
    const dec = Math.round((total % 1) * 10);
    const sStr = dec > 0 ? `${s}.${dec}s` : `${s}s`;
    return m > 0 ? `${m}m ${sStr}` : sStr;
}

function _fmtDifFinal(seg) {
    if (seg <= 0) return '<span style="color:#16a34a;font-weight:800;">Líder</span>';
    return `+${_fmtDif(seg)}`;
}

function _renderRemontadaTiempo(remontadaTiempo) {
    if (!remontadaTiempo) {
        return `
            <div class="tarjeta-remontada">
                <div class="seccion-titulo">Mejor remontada (tiempo)</div>
                <div class="no-data">Sin información</div>
            </div>`;
    }
    return `
        <div class="tarjeta-remontada">
            <div class="seccion-titulo">Mejor remontada (tiempo)</div>
            <div class="remontada-piloto">${remontadaTiempo.nombre}</div>
            <span class="remontada-badge">−${_fmtDif(remontadaTiempo.recorteSegundos)} al líder</span>
            <div class="remontada-posiciones">
                <div class="remontada-pos-inicio">
                    <div class="remontada-pos-numero" style="font-size:20px;">+${_fmtDif(remontadaTiempo.peorDifSegundos)}</div>
                    <div class="remontada-pos-label">tras PE ${remontadaTiempo.desdePE}</div>
                </div>
                <div class="remontada-flecha">→</div>
                <div class="remontada-pos-fin">
                    <div class="remontada-pos-numero" style="font-size:20px;">${_fmtDifFinal(remontadaTiempo.difFinalSegundos)}</div>
                    <div class="remontada-pos-label">Actual</div>
                </div>
            </div>
            <div class="remontada-ganancia">
                Recortó <strong>${_fmtDif(remontadaTiempo.recorteSegundos)}</strong> al líder desde su peor momento (tras PE ${remontadaTiempo.desdePE})
            </div>
        </div>`;
}

function _renderRemontadaPos(remontadaPos) {
    if (!remontadaPos || remontadaPos.ganancia <= 0) {
        return `
            <div class="tarjeta-remontada">
                <div class="seccion-titulo">Mejor remontada (posición)</div>
                <div class="no-data">Sin información</div>
            </div>`;
    }
    const g = remontadaPos.ganancia;
    return `
        <div class="tarjeta-remontada">
            <div class="seccion-titulo">Mejor remontada (posición)</div>
            <div class="remontada-piloto">${remontadaPos.nombre}</div>
            <span class="remontada-badge">+${g} posicion${g !== 1 ? 'es' : ''}</span>
            <div class="remontada-posiciones">
                <div class="remontada-pos-inicio">
                    <div class="remontada-pos-numero">${remontadaPos.posInicio}°</div>
                    <div class="remontada-pos-label">tras PE ${remontadaPos.desdePE}</div>
                </div>
                <div class="remontada-flecha">→</div>
                <div class="remontada-pos-fin">
                    <div class="remontada-pos-numero">${remontadaPos.posFin}°</div>
                    <div class="remontada-pos-label">Actual</div>
                </div>
            </div>
            <div class="remontada-ganancia">
                Ganó <strong>${g}</strong> lugar${g !== 1 ? 'es' : ''} desde su peor posición (tras PE ${remontadaPos.desdePE})
            </div>
        </div>`;
}

function _renderTramoDisputado(tramoDisputado) {
    const fmtDifDisputado = seg => {
        const total = Math.abs(seg);
        const m   = Math.floor(total / 60);
        const s   = Math.floor(total % 60);
        const dec = String(Math.round((total % 1) * 1000)).padStart(3, '0');
        const sStr = `${s}.${dec}s`;
        return m > 0 ? `${m}m ${sStr}` : sStr;
    };

    if (!tramoDisputado) {
        return `
            <div class="tarjeta-disputado">
                <div class="seccion-titulo">Tramo más disputado</div>
                <div class="no-data">Sin información</div>
            </div>`;
    }
    return `
        <div class="tarjeta-disputado">
            <div class="seccion-titulo">Tramo más disputado</div>
            <div class="disputado-header">
                <span class="disputado-pe" style="font-size:12px">PE ${tramoDisputado.pe}</span>
                <span class="disputado-nombre">| ${tramoDisputado.nombre}</span>
            </div>
            <div class="disputado-dif">${fmtDifDisputado(tramoDisputado.difSegundos)}</div>
            <div class="disputado-dif-label">de diferencia entre 1° y 2°</div>
            <div class="disputado-tiempos">
                <span>
                    <span class="disputado-badge disputado-badge-1">1</span>
                    <span style="display:flex;flex-direction:column;align-items:flex-start;gap:1px;">
                        <span style="font-size:11px;font-weight:600;color:#334155;">${tramoDisputado.piloto1}</span>
                        <span>${tramoDisputado.tiempo1}</span>
                    </span>
                </span>
                <span>
                    <span class="disputado-badge disputado-badge-2">2</span>
                    <span style="display:flex;flex-direction:column;align-items:flex-start;gap:1px;">
                        <span style="font-size:11px;font-weight:600;color:#334155;">${tramoDisputado.piloto2}</span>
                        <span>${tramoDisputado.tiempo2}</span>
                    </span>
                </span>
            </div>
        </div>`;
}

function _renderPosicionesPerdidas(posicionesPerdidas) {
    if (!posicionesPerdidas || posicionesPerdidas.perdida <= 0) {
        return `
            <div class="tarjeta-remontada tarjeta-perdida">
                <div class="seccion-titulo">Más posiciones perdidas</div>
                <div class="no-data">Sin información</div>
            </div>`;
    }
    const p = posicionesPerdidas.perdida;
    return `
        <div class="tarjeta-remontada tarjeta-perdida">
            <div class="seccion-titulo">Más posiciones perdidas</div>
            <div class="remontada-piloto">${posicionesPerdidas.nombre}</div>
            <span class="remontada-badge perdida-badge">−${p} posicion${p !== 1 ? 'es' : ''}</span>
            <div class="remontada-posiciones">
                <div class="remontada-pos-inicio">
                    <div class="remontada-pos-numero perdida-pos-mejor">${posicionesPerdidas.posMejor}°</div>
                    <div class="remontada-pos-label">tras PE ${posicionesPerdidas.desdePE}</div>
                </div>
                <div class="remontada-flecha perdida-flecha">→</div>
                <div class="remontada-pos-fin">
                    <div class="remontada-pos-numero perdida-pos-fin">${posicionesPerdidas.posFin}°</div>
                    <div class="remontada-pos-label">Actual</div>
                </div>
            </div>
            <div class="remontada-ganancia perdida-ganancia">
                Cayó <strong>${p}</strong> lugar${p !== 1 ? 'es' : ''} desde su mejor posición (tras PE ${posicionesPerdidas.desdePE})
            </div>
        </div>`;
}

function _renderTablaMarcas(marcas) {
    if (!marcas || marcas.length === 0) {
        return `
            <div style="margin-bottom:0;">
                <div class="seccion-titulo">Marcas</div>
                <div class="no-data">Sin información</div>
            </div>`;
    }

    const filas = marcas.map((m, idx) => {
        const rutaLogo = obtenerRutaLogoMarca(m.marca + ' x');
        const porcentaje = m.largaron > 0
            ? Math.round((m.finalizaron / m.largaron) * 100)
            : 0;
        const colorPct = porcentaje < 30 ? '#dc2626'
            : porcentaje <= 70           ? '#ea580c'
            :                              '#16a34a';
        const bgFila = idx % 2 === 0 ? '#f0f3f6' : '#ffffff';

        const badgesCategorias = m.victoriasPE > 0
            ? Object.entries(m.victoriasPorCategoria)
                .map(([cat, count]) => `
                    <span style="background:var(--color-azul-principal);color:var(--color-texto-claro);
                        border-radius:5px;padding:2px 7px;font-size:10px;font-weight:700;
                        letter-spacing:0.5px;white-space:nowrap;">
                        ${cat} ${count}
                    </span>`)
                .join('')
            : '';

        return `
            <tr style="background:${bgFila};">
                <td style="padding:12px 16px;text-align:center;">
                    <div style="display:flex;align-items:center;justify-content:center;gap:10px;">
                        ${rutaLogo
                            ? `<img src="${rutaLogo}" alt="${m.marca}"
                                style="height:22px;object-fit:contain;"
                                onerror="this.style.display='none'">`
                            : ''}
                        <span style="font-size:14px;font-weight:700;color:var(--color-texto);">${m.marca}</span>
                    </div>
                </td>
                <td style="text-align:center;padding:12px 16px;">
                    <span style="font-family:'Orbitron',serif;font-size:17px;font-weight:600;color:var(--color-texto);">${m.largaron}</span>
                </td>
                <td style="text-align:center;padding:12px 16px;">
                    <span style="font-family:'Orbitron',serif;font-size:18px;font-weight:800;color:${colorPct};">
                        ${porcentaje}%
                    </span>
                    <div style="font-size:11px;color:var(--color-texto-suave);margin-top:2px;">
                        ${m.finalizaron} de ${m.largaron}
                    </div>
                </td>
                <td style="text-align:center;padding:12px 16px;">
                    <span style="font-family:'Orbitron',serif;font-size:18px;font-weight:800;color:var(--color-azul-principal);">
                        ${m.victoriasPE > 0 ? m.victoriasPE : '—'}
                    </span>
                </td>
                <td style="text-align:center;padding:12px 16px;">
                    ${m.victoriasPE > 0
                        ? `<div style="display:grid;grid-template-rows:repeat(2, auto);grid-auto-flow:column;gap:4px;justify-content:center;">
                            ${Object.entries(m.victoriasPorCategoria)
                                .map(([cat, count]) => `
                                    <span style="background:var(--color-azul-principal);color:var(--color-texto-claro);
                                        border-radius:5px;padding:2px 7px;font-size:10px;font-weight:700;
                                        letter-spacing:0.5px;white-space:nowrap;">
                                        ${count} en ${cat}
                                    </span>`)
                                .join('')}
                        </div>`
                        : '<span style="color:var(--color-texto-suave);">—</span>'}
                </td>
            </tr>`;
    }).join('');

    return `
        <div style="margin-bottom:0;">
            <div class="seccion-titulo">Marcas</div>
            <div style="background:#f8fafc;border:1.5px solid #d7dde5;border-radius:12px;
                overflow:hidden;box-shadow:0 4px 14px rgba(15,23,42,0.07);">
                <table style="width:100%;border-collapse:collapse;">
                    <thead>
                        <tr>
                            <th style="text-align:center;padding:12px 16px;">Marca</th>
                            <th style="text-align:center;padding:12px 16px;">Largaron</th>
                            <th style="text-align:center;padding:12px 16px;">Finalizaron sin DNF</th>
                            <th style="text-align:center;padding:12px 16px;">P.E Ganados</th>
                            <th style="text-align:center;padding:12px 16px;">En</th>
                        </tr>
                    </thead>
                    <tbody>${filas}</tbody>
                </table>
            </div>
        </div>`;
}

function _renderTramoConMasDNFs(tramo) {
    if (!tramo) {
        return `
            <div class="tarjeta-disputado">
                <div class="seccion-titulo">PE con más abandonos</div>
                <div class="no-data">Sin abandonos registrados</div>
            </div>`;
    }
    return `
        <div class="tarjeta-disputado">
            <div class="seccion-titulo">PE con más abandonos</div>
            <div class="disputado-header">
                <span class="disputado-pe" style="font-size:12px">PE ${tramo.pe}</span>
                <span class="disputado-nombre">| ${tramo.nombre}</span>
            </div>
            <div class="disputado-dif" style="color:#dc2626;">${tramo.dnfs}</div>
            <div class="disputado-dif-label">abandono${tramo.dnfs !== 1 ? 's' : ''} en este tramo</div>
            ${tramo.kms ? `
            <div class="disputado-tiempos" style="background:#fef2f2;color:#dc2626;">
                <span>${parseFloat(tramo.kms).toFixed(2)} km</span>
            </div>` : ''}
        </div>`;
}

// ── Render: evolución top 5 ───────────────────────────────────────────────────

function renderizarEvolucionTop5(categoria) {
    const data = calcularEvolucionTop5(categoria, datosPilotos, datosTramos);
    if (!data || data.series.length === 0 || data.totalPEs < 2) return '';

    const { series, totalPEs } = data;
    const W = 860, H = 260;
    const PAD = { top: 20, right: 160, bottom: 40, left: 48 };
    const gW = W - PAD.left - PAD.right;
    const gH = H - PAD.top - PAD.bottom;

    const xScale = pe  => PAD.left + ((pe - 1) / Math.max(totalPEs - 1, 1)) * gW;
    const yScale = pos => PAD.top  + ((pos - 1) / 5) * gH;
    const Y_FUERA = yScale(6);

    const COLORES = [
        '#ffab1a', '#3b82f6', '#22c55e', '#ef4444', '#a855f7',
        '#06b6d4', '#f97316', '#ec4899', '#84cc16', '#14b8a6',
        '#8b5cf6', '#f59e0b',
    ];

    let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;">`;
    svg += `<rect x="0" y="0" width="${W}" height="${H}" fill="transparent"/>`;

    for (let pos = 1; pos <= 5; pos++) {
        const y = yScale(pos);
        svg += `<line x1="${PAD.left}" y1="${y}" x2="${PAD.left + gW}" y2="${y}"
            stroke="#d7dde5" stroke-width="${pos === 1 ? 1.5 : 1}" stroke-dasharray="${pos === 1 ? 'none' : '4,3'}"/>`;
        svg += `<text x="${PAD.left - 10}" y="${y + 4.5}" text-anchor="end"
            font-size="11" font-weight="700" font-family="Orbitron,serif" fill="#5a6472">${pos}°</text>`;
    }

    for (let pe = 1; pe <= totalPEs; pe++) {
        const x = xScale(pe);
        svg += `<line x1="${x}" y1="${PAD.top}" x2="${x}" y2="${PAD.top + gH}" stroke="#e2e8f0" stroke-width="1"/>`;
        svg += `<text x="${x}" y="${PAD.top + gH + 18}" text-anchor="middle"
            font-size="11" font-weight="600" font-family="Orbitron,serif" fill="#303743">PE ${pe}</text>`;
    }

    series.forEach(({ nombre, puntos }, idx) => {
        if (puntos.length === 0) return;
        const color = COLORES[idx % COLORES.length];

        const segmentos = [];
        let segActual = null;

        for (let pe = 1; pe <= totalPEs; pe++) {
            const punto = puntos.find(p => p.pe === pe);
            if (punto) {
                if (!segActual) segActual = [];
                segActual.push(punto);
            } else {
                if (segActual) { segmentos.push(segActual); segActual = null; }
            }
        }
        if (segActual) segmentos.push(segActual);

        segmentos.forEach(seg => {
            const primero = seg[0];
            const ultimo  = seg[seg.length - 1];

            if (primero.pe !== 1) {
                const d = `M${xScale(primero.pe - 1).toFixed(1)},${Y_FUERA.toFixed(1)} L${xScale(primero.pe).toFixed(1)},${yScale(primero.pos).toFixed(1)}`;
                svg += `<path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="4,3" stroke-linecap="round" opacity="0.4"/>`;
            }

            if (seg.length > 1) {
                const d = seg.map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(p.pe).toFixed(1)},${yScale(p.pos).toFixed(1)}`).join(' ');
                svg += `<path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>`;
            }

            if (ultimo.pe !== totalPEs) {
                const d = `M${xScale(ultimo.pe).toFixed(1)},${yScale(ultimo.pos).toFixed(1)} L${xScale(ultimo.pe + 1).toFixed(1)},${Y_FUERA.toFixed(1)}`;
                svg += `<path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="4,3" stroke-linecap="round" opacity="0.4"/>`;
            }

            seg.forEach(({ pe, pos }) => {
                svg += `<circle cx="${xScale(pe).toFixed(1)}" cy="${yScale(pos).toFixed(1)}" r="5" fill="${color}" stroke="white" stroke-width="2"/>`;
            });
        });

        const ultimoSeg   = segmentos[segmentos.length - 1];
        const ultimoPunto = ultimoSeg[ultimoSeg.length - 1];
        const nombreCorto = nombre.length > 18 ? nombre.split(' ').slice(-1)[0] : nombre;
        svg += `<text x="${(xScale(ultimoPunto.pe) + 10).toFixed(1)}" y="${(yScale(ultimoPunto.pos) + 4.5).toFixed(1)}"
            font-size="11.5" font-weight="700" font-family="'Segoe UI',sans-serif" fill="${color}">${nombreCorto}</text>`;
    });

    svg += `</svg>`;

    const leyenda = series.map(({ nombre }, idx) => {
        const color = COLORES[idx % COLORES.length];
        return `
            <div style="display:flex;align-items:center;gap:7px;font-size:12px;font-weight:600;color:#161c25;">
                <svg width="22" height="4"><rect width="22" height="4" rx="2" fill="${color}"/></svg>
                <span>${nombre}</span>
            </div>`;
    }).join('');

    return `
        <div style="margin-bottom:30px;">
            <div class="seccion-titulo">Evolución Top 5</div>
            <div style="background:#f8fafc;border:1.5px solid #d7dde5;border-radius:12px;padding:18px 18px 10px;box-shadow:0 4px 14px rgba(15,23,42,0.07);">
                ${svg}
                <div style="display:flex;flex-wrap:wrap;gap:14px;margin-top:12px;padding-top:10px;border-top:1px solid #e2e8f0;justify-content:center;">
                    ${leyenda}
                </div>
            </div>
        </div>`;
}

// ── Render: heatmap ───────────────────────────────────────────────────────────

function renderizarHeatmapRendimiento(categoria) {
    const datos = calcularDatosHeatmap(categoria, datosPilotos, datosTramos);
    if (!datos) return '';

    const { pilotosOrdenados, ganadorFinal, posicionesFinales, ultimoPE } = datos;

    function obtenerColor(delta, esDNFVal, sinDato, esGanador = false) {
        if (sinDato)   return { bg: '#e2e8f0', text: '#94a3b8' };
        if (esDNFVal)  return { bg: '#f87171', text: '#7f1d1d' };
        if (esGanador) return { bg: '#a3d977', text: '#1a3a00' };
        if (delta < -0.001) {
            if (delta < -20) return { bg: '#0ea5e9', text: '#ffffff' };
            if (delta < -8)  return { bg: '#38bdf8', text: '#0c4a6e' };
            if (delta < -3)  return { bg: '#7dd3fc', text: '#0c4a6e' };
            return { bg: '#bae6fd', text: '#0369a1' };
        }
        if (delta > 0.001) {
            if (delta > 20) return { bg: '#f4694b', text: '#5a0d00' };
            if (delta > 8)  return { bg: '#ffb347', text: '#6b2500' };
            if (delta > 3)  return { bg: '#ffe066', text: '#6b4700' };
            return { bg: '#c8e87a', text: '#2d4a00' };
        }
        return { bg: '#a3d977', text: '#1a3a00' };
    }

    function formatearDelta(seg) {
        if (Math.abs(seg) < 0.001) return '0.000';
        const abs = Math.abs(seg);
        const m = Math.floor(abs / 60);
        const s = (abs % 60).toFixed(3).padStart(6, '0');
        const base = m > 0 ? `${m}:${s}` : `${parseFloat(s).toFixed(3)}`;
        return seg < 0 ? `-${base}` : `+${base}`;
    }

    function kmsDelPE(pe) {
        const tramo = datosTramos.find(t => String(t.PE) === String(pe));
        return tramo?.KMS ? `${parseFloat(tramo.KMS).toFixed(2)} km` : '';
    }

    const ganadorNombre = ganadorFinal.Nombre || ganadorFinal.NOMBRE || '';
    const COLORES_POS = ['#f5b800','#6c9de8','#3db87a','#e84a4a','#9b6be8',
                         '#06b6d4','#f97316','#ec4899','#84cc16','#14b8a6',
                         '#8b5cf6','#f59e0b','#64748b'];

    const thPEs = Array.from({ length: ultimoPE }, (_, i) => {
        const pe = i + 1;
        const kms = kmsDelPE(pe);
        return `<th style="background:#0f172a;color:#e8edf3;padding:12px 10px 10px;text-align:center;
            font-family:'Orbitron',serif;font-size:13px;font-weight:700;min-width:100px;
            border-left:1px solid #1e293b;">
            PE${pe}
            ${kms ? `<div style="font-size:10px;font-weight:500;color:#94a3b8;margin-top:3px;font-family:'Segoe UI',sans-serif;">${kms}</div>` : ''}
        </th>`;
    }).join('');

    const todasLasFilas = pilotosOrdenados.map((piloto, idx) => {
        const nombre = piloto.Nombre || piloto.NOMBRE || '';
        const pos = posicionesFinales[nombre] ?? (idx + 1);
        const colorPos = COLORES_POS[idx % COLORES_POS.length];
        const esGanadorFinal = nombre === ganadorNombre;

        const penRaw = piloto.PENALIZACION || piloto.Penalizacion || '';
        const penSeg = tiempoASegundos(penRaw);
        const tienePen = penSeg > 0 && penSeg < 999999;
        const penDisplay = tienePen ? segundosATiempo(penSeg, 2) : null;

        const celdas = Array.from({ length: ultimoPE }, (_, i) => {
            const pe  = i + 1;
            const col = `PE${pe}`;

            if (esGanadorFinal) {
                const t = piloto[col];
                const colorInfo = obtenerColor(0, false, false, true);
                let displayVal = '—';
                if (t && t.trim() !== '') {
                    displayVal = esDNF(t) ? 'DNF' : (() => {
                        const seg = tiempoASegundos(t);
                        return seg < 999999 ? segundosATiempo(seg, 3) : '—';
                    })();
                }
                return `<td style="background:${colorInfo.bg};color:${colorInfo.text};text-align:center;
                    padding:16px 8px;font-size:14px;font-weight:700;
                    border-left:1px solid rgba(255,255,255,0.3);white-space:nowrap;">${displayVal}</td>`;
            }

            const tPiloto  = piloto[col];
            const tGanador = ganadorFinal[col];

            if (!tPiloto || tPiloto.trim() === '') {
                const c = obtenerColor(0, false, true);
                return `<td style="background:${c.bg};color:${c.text};text-align:center;padding:16px 8px;
                    font-size:14px;font-weight:700;border-left:1px solid rgba(255,255,255,0.3);white-space:nowrap;">—</td>`;
            }
            if (esDNF(tPiloto)) {
                const c = obtenerColor(0, true, false);
                return `<td style="background:${c.bg};color:${c.text};text-align:center;padding:16px 8px;
                    font-size:14px;font-weight:700;border-left:1px solid rgba(255,255,255,0.3);white-space:nowrap;">DNF</td>`;
            }
            if (!tGanador || esDNF(tGanador)) {
                const c = obtenerColor(0, false, true);
                return `<td style="background:${c.bg};color:${c.text};text-align:center;padding:16px 8px;
                    font-size:14px;font-weight:700;border-left:1px solid rgba(255,255,255,0.3);white-space:nowrap;">—</td>`;
            }

            const segPiloto  = tiempoASegundos(tPiloto);
            const segGanador = tiempoASegundos(tGanador);

            if (segPiloto >= 999999 || segGanador >= 999999) {
                const c = obtenerColor(0, false, true);
                return `<td style="background:${c.bg};color:${c.text};text-align:center;padding:16px 8px;
                    font-size:14px;font-weight:700;border-left:1px solid rgba(255,255,255,0.3);white-space:nowrap;">—</td>`;
            }

            const delta = segPiloto - segGanador;
            const c = obtenerColor(delta, false, false);
            return `<td style="background:${c.bg};color:${c.text};text-align:center;padding:16px 8px;
                font-size:14px;font-weight:700;border-left:1px solid rgba(255,255,255,0.3);white-space:nowrap;">
                ${formatearDelta(delta)}</td>`;
        }).join('');

        const bgFila = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
        return `
            <tr style="background:${bgFila};">
                <td style="padding:0;width:52px;border-right:1px solid #e2e8f0;">
                    <div style="display:flex;align-items:center;height:100%;min-height:56px;">
                        <div style="width:5px;background:${colorPos};align-self:stretch;flex-shrink:0;"></div>
                        <div style="flex:1;text-align:center;font-family:'Orbitron',serif;
                            font-size:18px;font-weight:800;color:#0f172a;padding:16px 8px;">${pos}</div>
                    </div>
                </td>
                <td style="padding:16px;font-size:13px;font-weight:700;color:#0f172a;
                    border-right:1px solid #e2e8f0;white-space:nowrap;min-width:140px;">
                    ${nombre}
                    ${penDisplay ? `<div style="font-size:11px;font-weight:600;color:#dc2626;margin-top:3px;">+${penDisplay}</div>` : ''}
                </td>
                ${celdas}
            </tr>`;
    });

    const PAGINA = 5;
    const heatmapId = `heatmap-tbody-${categoria.replace(/\s+/g, '')}`;
    const btnId = `heatmap-btn-${categoria.replace(/\s+/g, '')}`;
    const hayMas = pilotosOrdenados.length > PAGINA;

    setHeatmapFilas(heatmapId, todasLasFilas);

    const estadoPrevio = getEstadoHeatmap(heatmapId);
    if (estadoPrevio && estadoPrevio.visible > PAGINA) {
        setTimeout(() => _restaurarEstadoHeatmap(heatmapId, btnId, PAGINA, pilotosOrdenados.length), 0);
    }

    const leyendaItems = [
        { color: '#0ea5e9', text: 'Recortó +20s' }, { color: '#38bdf8', text: 'Recortó 8–20s' },
        { color: '#7dd3fc', text: 'Recortó 3–8s' }, { color: '#bae6fd', text: 'Recortó ≤3s' },
        { color: '#a3d977', text: 'Lider' },         { color: '#c8e87a', text: 'Perdió ≤3s' },
        { color: '#ffe066', text: 'Perdió 3–8s' },  { color: '#ffb347', text: 'Perdió 8–20s' },
        { color: '#f4694b', text: 'Perdió +20s' },  { color: '#f87171', text: 'DNF' },
    ];
    const leyendaHTML = leyendaItems.map(({ color, text }) => `
        <div style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#334155;">
            <div style="width:20px;height:14px;background:${color};border-radius:3px;"></div>
            <span>${text}</span>
        </div>`).join('');

    return `
        <div style="margin-bottom:30px;">
            <div class="seccion-titulo">Diferencias al Líder por Tramo</div>
            <div style="background:#f8fafc;border:1.5px solid #d7dde5;border-radius:12px;
                padding:18px;box-shadow:0 4px 14px rgba(15,23,42,0.07);overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;border-radius:10px;
                    overflow:hidden;box-shadow:0 4px 16px rgba(15,23,42,0.12);">
                    <thead>
                        <tr>
                            <th style="background:#0f172a;color:#e8edf3;padding:12px 10px;text-align:center;
                                font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;width:52px;">POS</th>
                            <th style="background:#0f172a;color:#e8edf3;padding:12px 16px;text-align:center;
                                font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;
                                border-left:1px solid #1e293b;">PILOTO</th>
                            ${thPEs}
                        </tr>
                    </thead>
                    <tbody id="${heatmapId}">${todasLasFilas.slice(0, PAGINA).join('')}</tbody>
                </table>
                ${hayMas ? `
                    <div id="${btnId}-container" style="display:flex;justify-content:center;gap:10px;margin-top:14px;">
                        <button
                            data-visible="${PAGINA}"
                            data-total="${pilotosOrdenados.length}"
                            data-heatmap="${heatmapId}"
                            onclick="expandirHeatmap(this)"
                            style="background:linear-gradient(135deg,#0f172a 0%,#232830 100%);
                                color:#e8edf3;border:none;border-radius:8px;padding:10px 28px;
                                font-family:'Orbitron',serif;font-size:13px;font-weight:600;
                                cursor:pointer;letter-spacing:0.5px;
                                box-shadow:0 4px 12px rgba(15,23,42,0.25);transition:all 0.2s ease;"
                            onmouseover="this.style.transform='translateY(-2px)'"
                            onmouseout="this.style.transform='translateY(0)'">
                            ▼ Ver más
                        </button>
                    </div>` : ''}
                <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:14px;
                    padding-top:12px;border-top:1px solid #e2e8f0;justify-content:center;">
                    ${leyendaHTML}
                </div>
            </div>
        </div>`;
}

function _estilosBtnHeatmap() {
    return `background:linear-gradient(135deg,#374151 0%,#4b5563 100%);
        color:#e8edf3;border:none;border-radius:8px;padding:10px 28px;
        font-family:'Orbitron',serif;font-size:13px;font-weight:600;
        cursor:pointer;letter-spacing:0.5px;
        box-shadow:0 4px 12px rgba(15,23,42,0.25);transition:all 0.2s ease;`;
}

function _crearBotonOcultar(tbodyId, btnVisible, PAGINA) {
    const btn = document.createElement('button');
    btn.dataset.ocultar = 'true';
    btn.dataset.heatmap = tbodyId;
    btn.textContent = '▲ Ocultar';
    btn.style.cssText = _estilosBtnHeatmap();
    btn.onmouseover = () => btn.style.transform = 'translateY(-2px)';
    btn.onmouseout  = () => btn.style.transform = 'translateY(0)';
    btn.onclick = () => {
        const tbody = document.getElementById(tbodyId);
        const filas = Array.from(tbody.querySelectorAll('tr'));
        filas.slice(PAGINA).forEach(f => f.classList.add('heatmap-ocultando'));
        setTimeout(() => {
            tbody.classList.remove('heatmap-tbody-animado');
            tbody.innerHTML = (getHeatmapFilas(tbodyId) || []).slice(0, PAGINA).join('');
            if (btnVisible) { btnVisible.dataset.visible = PAGINA; btnVisible.style.display = ''; }
            deleteEstadoHeatmap(tbodyId);
            btn.remove();
        }, 260);
    };
    return btn;
}

function _restaurarEstadoHeatmap(heatmapId, btnId, PAGINA, total) {
    const estadoPrevio = getEstadoHeatmap(heatmapId);
    if (!estadoPrevio) return;

    const tbody = document.getElementById(heatmapId);
    const container = document.getElementById(`${btnId}-container`);
    if (!tbody || !container) return;

    tbody.innerHTML = (getHeatmapFilas(heatmapId) || []).slice(0, estadoPrevio.visible).join('');

    const btnExpandir = container.querySelector('button:not([data-ocultar])');
    if (btnExpandir) {
        btnExpandir.dataset.visible = estadoPrevio.visible;
        if (estadoPrevio.visible >= total) btnExpandir.style.display = 'none';
    }

    if (!container.querySelector('[data-ocultar]')) {
        container.appendChild(_crearBotonOcultar(heatmapId, btnExpandir, PAGINA));
    }
}

function expandirHeatmap(btn) {
    const PAGINA = 5;
    const tbodyId = btn.dataset.heatmap;
    const total = parseInt(btn.dataset.total);
    let visible = parseInt(btn.dataset.visible);
    const containerId = tbodyId.replace('heatmap-tbody-', 'heatmap-btn-') + '-container';
    const container = document.getElementById(containerId);
    const tbody = document.getElementById(tbodyId);
    const filas = getHeatmapFilas(tbodyId);

    if (!tbody || !filas) return;

    visible = Math.min(visible + PAGINA, total);
    btn.dataset.visible = visible;
    setEstadoHeatmap(tbodyId, { visible });

    tbody.classList.remove('heatmap-tbody-animado');
    void tbody.offsetWidth;
    tbody.innerHTML = filas.slice(0, visible).join('');
    tbody.classList.add('heatmap-tbody-animado');

    if (visible >= total) btn.style.display = 'none';

    if (!container.querySelector('[data-ocultar]')) {
        container.appendChild(_crearBotonOcultar(tbodyId, btn, PAGINA));
    }
}

// ── Carga de datos ────────────────────────────────────────────────────────────

function actualizarUltimaActualizacion() {
    document.getElementById('lastUpdate').textContent =
        `Última actualización: ${new Date().toLocaleTimeString('es-AR')}`;
}

async function cargarDatos() {
    try {
        const cacheBuster = `&t=${Date.now()}`;
        const [respRally, respPilotos, respTramos, respInscriptos] = await Promise.all([
            fetch(URL_RALLY + cacheBuster),
            fetch(URL_PILOTOS + cacheBuster),
            fetch(URL_TRAMOS  + cacheBuster),
            fetch(URL_INSCRIPTOS + cacheBuster)
        ]);

        const rallyData = analizarCSVBase(await respRally.text());
        const pilotosBase = analizarPilotosCSV(await respPilotos.text());
        const inscriptosData = analizarCSVBase(await respInscriptos.text());
        const fechaRally = normalizarFechasComparacion(rallyData[0]?.Fecha || rallyData[0]?.FECHA || rallyData[0]?.fecha || '');
        datosPilotos = fusionarPilotosConInscriptos(pilotosBase, inscriptosData, fechaRally);
        datosTramos  = analizarTramosCSV(await respTramos.text());
        window.inscriptosData = inscriptosData;

        const categorias = obtenerCategoriasConTiempos(datosPilotos, datosTramos);
        renderizarBotonesCategorias(categorias);

        const guardada = getCategoriaGuardada();
        const activa   = getCategoriaActiva();

        if (!activa && guardada && (guardada === 'General' || categorias.includes(guardada))) {
            seleccionarCategoria(guardada);
        } else if (!activa && categorias.length > 0) {
            seleccionarCategoria(categorias[0]);
        } else if (activa) {
            seleccionarCategoria(activa);
        } else {
            document.getElementById('content').innerHTML =
                '<div class="no-data">No hay tiempos cargados todavía.</div>';
        }

        actualizarUltimaActualizacion();
    } catch (error) {
        const hayDatos = datosPilotos.length > 0 || datosTramos.length > 0;
        if (!hayDatos) {
            document.getElementById('content').innerHTML =
                '<div class="error">Error al cargar los datos.</div>';
        }
        console.error('Error al recargar:', error);
    }
}

cargarDatos();
setInterval(cargarDatos, 30000);
