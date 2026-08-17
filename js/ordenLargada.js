const ORDENLARGADA_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vToRsF3zwvqzcMttSdROC5E4tyHqpQsHaGpxJyRPzf4Aunc5-uX3IddO1vXmn64mt5Uur46HkLekr-d/pub?gid=2144629647&single=true&output=csv';
const { analizarCSV } = window.UtilidadesCSV;
const { obtenerClavesTiempo, obtenerTiempoEtapa } = window.UtilidadesTiempo;
const { ordenarCategorias } = window.UtilidadesCategorias;

let ordenLargadaData = [];
let intervaloContador = null;
let minutoActualTabla = null;
let filtroNombrePiloto = '';
let filtroCategoria = '';
let restaurarFiltroNombre = null;

const MAX_FIJADOS = 3;

// ── Persistencia de pilotos fijados (mismo patrón que tramo.js) ───────────────
function obtenerPilotosFijados() {
    try {
        const guardado = JSON.parse(localStorage.getItem('ordenLargada_fijados') || 'null');
        if (!guardado) return [];

        const ahora = Date.now();
        const unDia = 24 * 60 * 60 * 1000;

        if (ahora - guardado.timestamp > unDia) {
            localStorage.removeItem('ordenLargada_fijados');
            return [];
        }

        return guardado.pilotos || [];
    } catch { return []; }
}

function guardarPilotosFijados(pilotos) {
    localStorage.setItem('ordenLargada_fijados', JSON.stringify({
        pilotos: pilotos,
        timestamp: Date.now()
    }));
}
// ─────────────────────────────────────────────────────────────────────────────

function normalizarTextoFiltro(texto) {
    return String(texto || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function obtenerCategoriasDisponibles(datos) {
    const categorias = [...new Set(datos.map(p => p.Categoria || p.CATEGORIA || '').filter(Boolean))];
    return ordenarCategorias(categorias);
}

function filtrarOrdenLargada(datos) {
    const nombreFiltro = normalizarTextoFiltro(filtroNombrePiloto);
    const categoriaFiltro = normalizarTextoFiltro(filtroCategoria);

    return datos.filter(piloto => {
        const nombre = normalizarTextoFiltro(piloto.Nombre || piloto.NOMBRE || '');
        const categoria = normalizarTextoFiltro(piloto.Categoria || piloto.CATEGORIA || '');

        const coincideNombre = !nombreFiltro || nombre.includes(nombreFiltro);
        const coincideCategoria = !categoriaFiltro || categoria === categoriaFiltro;

        return coincideNombre && coincideCategoria;
    });
}

function renderizarFiltrosOrdenLargada() {
    const categorias = obtenerCategoriasDisponibles(ordenLargadaData);
    const contenido = `
        <div class="filtros-orden-largada">
            <div class="filtro-grupo filtro-grupo--buscador">
                <label for="filtroPiloto">Buscar piloto</label>
                <input
                    id="filtroPiloto"
                    type="text"
                    placeholder="Escribí el nombre..."
                    value="${filtroNombrePiloto.replace(/"/g, '&quot;')}"
                    oninput="actualizarFiltroNombrePiloto(this)"
                >
            </div>
            <div class="filtro-grupo filtro-grupo--select">
                <label for="filtroCategoria">Categoría</label>
                <select id="filtroCategoria" onchange="actualizarFiltroCategoria(this.value)">
                    <option value="">Todas</option>
                    ${categorias.map(categoria => `
                        <option value="${categoria.replace(/"/g, '&quot;')}" ${normalizarTextoFiltro(categoria) === normalizarTextoFiltro(filtroCategoria) ? 'selected' : ''}>
                            ${categoria}
                        </option>
                    `).join('')}
                </select>
            </div>
        </div>
    `;

    return contenido;
}

function actualizarFiltroNombrePiloto(input) {
    filtroNombrePiloto = input.value;
    restaurarFiltroNombre = {
        selectionStart: input.selectionStart,
        selectionEnd: input.selectionEnd
    };
    renderizarOrdenLargada();
}

function actualizarFiltroCategoria(valor) {
    filtroCategoria = valor;
    renderizarOrdenLargada();
}

function toggleFijarPiloto(nombrePiloto) {
    const fijados = obtenerPilotosFijados();
    const yaFijado = fijados.includes(nombrePiloto);

    if (yaFijado) {
        // Desfijar
        const nuevos = fijados.filter(n => n !== nombrePiloto);
        guardarPilotosFijados(nuevos);
    } else {
        // Fijar (máximo 3)
        if (fijados.length >= MAX_FIJADOS) return;
        guardarPilotosFijados([...fijados, nombrePiloto]);
    }

    renderizarOrdenLargada();
}

function limpiarTodosFijados() {
    guardarPilotosFijados([]);
    renderizarOrdenLargada();
}

// ── SVG del pin (Lucide) ──────────────────────────────────────────────────────
function iconoPin() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 17v5"/>
        <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>
    </svg>`;
}
// ─────────────────────────────────────────────────────────────────────────────

async function cargarDatos() {
    try {
        const cacheBuster = `&t=${Date.now()}`;
        const response = await fetch(ORDENLARGADA_URL + cacheBuster);
        const text = await response.text();

        ordenLargadaData = analizarCSV(text, {
            filtrarFila: fila => Boolean((fila.Nombre || fila.NOMBRE) && (fila.Categoria || fila.CATEGORIA))
        });

        renderizarOrdenLargada();
        actualizarContadorProximaLargada();
        actualizarUltimaActualizacion();
    } catch (error) {
        document.getElementById('content').innerHTML =
            '<div class="error">Error al cargar los datos. Por favor, verificá que la hoja de cálculo esté publicada correctamente.</div>';
        console.error('Error:', error);
    }
}

function obtenerColumnasTiempo() {
    if (ordenLargadaData.length === 0) return [];

    const primeraFila = ordenLargadaData[0];
    return obtenerClavesTiempo(primeraFila)
        .sort((a, b) => {
            const numeroA = parseInt(a.replace(/^(PE|SS)/, ''), 10);
            const numeroB = parseInt(b.replace(/^(PE|SS)/, ''), 10);
            return numeroA - numeroB;
        });
}

function convertirHorarioAMinutos(horario) {
    if (!horario || horario === '-') return Infinity;

    const match = horario.match(/(\d{1,2}):(\d{2})/);
    if (!match) return Infinity;

    const horas = parseInt(match[1], 10);
    const minutos = parseInt(match[2], 10);
    return horas * 60 + minutos;
}

function obtenerHorarioMasTemprano(piloto, columnasTiempo) {
    let horarioMinimo = Infinity;

    columnasTiempo.forEach(columna => {
        const horario = obtenerTiempoEtapa(piloto, columna.replace(/^(PE|SS)/, ''));
        const minutos = convertirHorarioAMinutos(horario);
        if (minutos < horarioMinimo) {
            horarioMinimo = minutos;
        }
    });

    return horarioMinimo;
}

function formatearTiempoRestante(minutos) {
    if (minutos < 60) {
        return `${minutos} minutos`;
    }

    const horas = Math.floor(minutos / 60);
    const minutosRestantes = minutos % 60;

    if (minutosRestantes === 0) {
        return horas === 1 ? '1 hora' : `${horas} horas`;
    }

    const textoHoras = horas === 1 ? '1 hora' : `${horas} horas`;
    return `${textoHoras} y ${minutosRestantes} minutos`;
}

function encontrarProximasLargadas() {
    if (ordenLargadaData.length === 0) return [];

    const ahora = new Date();
    const tiempoActualEnMinutos = ahora.getHours() * 60 + ahora.getMinutes();
    const columnasTiempo = obtenerColumnasTiempo();
    let menorDiferencia = Infinity;
    const candidatos = [];

    ordenLargadaData.forEach(piloto => {
        columnasTiempo.forEach(columna => {
            const tiempoLargada = convertirHorarioAMinutos(obtenerTiempoEtapa(piloto, columna.replace(/^(PE|SS)/, '')));
            if (tiempoLargada !== Infinity) {
                const diferencia = tiempoLargada - tiempoActualEnMinutos;
                if (diferencia >= 0 && diferencia < menorDiferencia) {
                    menorDiferencia = diferencia;
                }
            }
        });
    });

    if (menorDiferencia === Infinity) return [];

    ordenLargadaData.forEach(piloto => {
        const nombre = piloto.Nombre || piloto.NOMBRE || '';
        const categoria = piloto.Categoria || piloto.CATEGORIA || '';

        columnasTiempo.forEach(columna => {
            const tiempoLargada = convertirHorarioAMinutos(obtenerTiempoEtapa(piloto, columna.replace(/^(PE|SS)/, '')));
            if (tiempoLargada !== Infinity) {
                const diferencia = tiempoLargada - tiempoActualEnMinutos;
                if (diferencia === menorDiferencia) {
                    candidatos.push({
                        nombre,
                        categoria,
                        horario: obtenerTiempoEtapa(piloto, columna.replace(/^(PE|SS)/, '')),
                        pe: columna.replace(/^(PE|SS)/, ''),
                        minutosRestantes: Math.floor(diferencia)
                    });
                }
            }
        });
    });

    return candidatos;
}

function actualizarContadorProximaLargada() {
    const proximasLargadas = encontrarProximasLargadas();
    const containerContador = document.getElementById('proximaLargadaContainer');

    if (!containerContador) return;

    if (proximasLargadas.length === 0) {
        containerContador.innerHTML = '<div class="sin-largadas">No hay largadas programadas próximamente</div>';
        return;
    }

    const minutosRestantes = proximasLargadas[0].minutosRestantes;
    const segundosRestantes = 60 - new Date().getSeconds();
    let estadoTexto = '';
    let estadoClass = '';

    if (minutosRestantes === 0) {
        estadoTexto = '¡Largando ahora!';
        estadoClass = 'largando-ahora';
    } else if (minutosRestantes <= 5) {
        estadoTexto = `Próxima largada en ${minutosRestantes} min ${segundosRestantes}s`;
        estadoClass = 'urgente';
    } else if (minutosRestantes <= 15) {
        estadoTexto = `Próxima largada en ${formatearTiempoRestante(minutosRestantes)}`;
        estadoClass = 'cercana';
    } else {
        estadoTexto = `Próxima largada en ${formatearTiempoRestante(minutosRestantes)}`;
        estadoClass = 'normal';
    }

    const pilotosHTML = proximasLargadas.map((piloto, indice) => `
        <div class="info-piloto">
            <div class="info-item">
                <span class="label">Piloto:</span>
                <span class="valor nombre">${piloto.nombre}</span>
            </div>
            <div class="info-item">
                <span class="label">Categoría:</span>
                <span class="valor">${piloto.categoria}</span>
            </div>
            <div class="info-item">
                <span class="label">PE:</span>
                <span class="valor">${piloto.pe}</span>
            </div>
            <div class="info-item">
                <span class="label">Horario:</span>
                <span class="valor horario">${piloto.horario}</span>
            </div>
        </div>
        ${indice < proximasLargadas.length - 1 ? '<hr class="separador-piloto">' : ''}
    `).join('');

    containerContador.innerHTML = `
        <div class="contador-card ${estadoClass}">
            <div class="contador-header">
                <h2 class="contador-titulo">${estadoTexto}</h2>
            </div>
            <div class="contador-body">
                ${pilotosHTML}
            </div>
        </div>
    `;
}

function actualizarTablaSiCambioElMinuto() {
    const ahora = new Date();
    const minutoActual = ahora.getHours() * 60 + ahora.getMinutes();

    if (minutoActualTabla === minutoActual) {
        return;
    }

    minutoActualTabla = minutoActual;

    if (ordenLargadaData.length > 0) {
        renderizarOrdenLargada();
    }
}

function construirFilaPiloto(piloto, index, columnasTiempo, tiempoActualEnMinutos, fijados, totalFijados, esSeccionFijados) {
    const nombre = piloto.Nombre || piloto.NOMBRE || '';
    const categoria = piloto.Categoria || piloto.CATEGORIA || '';
    const estaFijado = fijados.includes(nombre);

    const estaLargando = columnasTiempo.some(columna => {
        const tiempoLargada = convertirHorarioAMinutos(obtenerTiempoEtapa(piloto, columna.replace(/^(PE|SS)/, '')));
        return tiempoLargada !== Infinity && tiempoLargada === tiempoActualEnMinutos;
    });

    const claseLargando = estaLargando ? 'celda-largando' : '';
    const claseFijada = estaFijado && !esSeccionFijados ? 'fila-fijada' : '';

    // Estado del botón pin
    let clasePin = '';
    if (estaFijado) {
        clasePin = 'fijado';
    } else if (totalFijados >= MAX_FIJADOS) {
        clasePin = 'deshabilitado';
    }

    const nombreEscapado = nombre.replace(/'/g, "\\'");

    let html = `
        <tr class="${claseFijada}" data-piloto="${nombre}">
            <td class="col-pin ${claseLargando}">
                <button
                    class="btn-pin ${clasePin}"
                    onclick="toggleFijarPiloto('${nombreEscapado}')"
                    title="${estaFijado ? 'Desfijar piloto' : 'Fijar piloto'}"
                >
                    ${iconoPin()}
                </button>
            </td>
            <td class="${claseLargando}"><span class="numero-badge">${index + 1}</span></td>
            <td class="${claseLargando}"><strong>${nombre}</strong></td>
            <td class="${claseLargando}"><strong>${categoria}</strong></td>
    `;

    columnasTiempo.forEach(columna => {
        const numero = columna.replace(/^(PE|SS)/, '');
        const horario = obtenerTiempoEtapa(piloto, numero) || '-';
        const tiempoLargada = convertirHorarioAMinutos(horario);
        const estaLargandoEste = tiempoLargada !== Infinity && tiempoLargada === tiempoActualEnMinutos;
        html += `<td class="pe-horario-cell${estaLargandoEste ? ' celda-largando' : ''}">${horario}</td>`;
    });

    html += '</tr>';
    return html;
}

function renderizarSeccionFijados(datosOrdenados, columnasTiempo, tiempoActualEnMinutos, fijados) {
    if (!fijados.length) {
        return '';
    }

    const datosFiltrados = filtrarOrdenLargada(datosOrdenados);

    const pilotosFijados = datosFiltrados.filter(p => {
        const nombre = p.Nombre || p.NOMBRE || '';
        return fijados.includes(nombre);
    });

    if (pilotosFijados.length === 0) {
        return '';
    }

    let html = `
        <div id="fijadosContainer" class="fijados-section">
        <div class="fijados-header">
            <span class="fijados-titulo">Pilotos fijados</span>
            <span class="fijados-badge">${pilotosFijados.length} / ${MAX_FIJADOS}</span>
            <button class="fijados-limpiar" onclick="limpiarTodosFijados()">Limpiar todo</button>
        </div>
        <div class="table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th class="col-pin"></th>
                        <th>#</th>
                        <th>Piloto</th>
                        <th>Categoría</th>
    `;

    columnasTiempo.forEach(columna => {
        html += `<th>PE ${columna.replace(/^(PE|SS)/, '')}</th>`;
    });

    html += `
                    </tr>
                </thead>
                <tbody>
    `;

    pilotosFijados.forEach((piloto, index) => {
        // Para la sección de fijados mostramos la posición original en la tabla completa
        const posicionOriginal = datosOrdenados.indexOf(piloto);
        html += construirFilaPiloto(piloto, posicionOriginal, columnasTiempo, tiempoActualEnMinutos, fijados, fijados.length, true);
    });

    html += `
                </tbody>
            </table>
        </div>
        </div>
    `;

    return html;
}

function renderizarOrdenLargada() {
    if (ordenLargadaData.length === 0) {
        document.getElementById('content').innerHTML =
            '<div class="error">No se encontraron órdenes de largada.</div>';
        return;
    }

    const columnasTiempo = obtenerColumnasTiempo();
    const datosOrdenados = [...ordenLargadaData].sort((a, b) => {
        const tiempoA = obtenerHorarioMasTemprano(a, columnasTiempo);
        const tiempoB = obtenerHorarioMasTemprano(b, columnasTiempo);
        return tiempoA - tiempoB;
    });

    const ahora = new Date();
    const tiempoActualEnMinutos = ahora.getHours() * 60 + ahora.getMinutes();
    minutoActualTabla = tiempoActualEnMinutos;

    const fijados = obtenerPilotosFijados();
    const datosFiltrados = filtrarOrdenLargada(datosOrdenados);

    // Renderizar filtros + sección de fijados + tabla principal
    let html = `
        ${renderizarFiltrosOrdenLargada()}
        ${renderizarSeccionFijados(datosOrdenados, columnasTiempo, tiempoActualEnMinutos, fijados)}
        <div class="category-section">
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th class="col-pin"></th>
                            <th>#</th>
                            <th>Piloto</th>
                            <th>Categoría</th>
    `;

    columnasTiempo.forEach(columna => {
        const numero = columna.replace(/^(PE|SS)/, '');
        html += `<th>PE ${numero}</th>`;
    });

    html += `
                        </tr>
                    </thead>
                    <tbody>
    `;

    datosFiltrados.forEach((piloto, index) => {
        html += construirFilaPiloto(piloto, index, columnasTiempo, tiempoActualEnMinutos, fijados, fijados.length, false);
    });

    html += `
                    </tbody>
                </table>
            </div>
        </div>
    `;

    document.getElementById('content').innerHTML = html;

    if (restaurarFiltroNombre) {
        const input = document.getElementById('filtroPiloto');
        if (input) {
            input.focus({ preventScroll: true });
            if (typeof input.setSelectionRange === 'function') {
                input.setSelectionRange(restaurarFiltroNombre.selectionStart, restaurarFiltroNombre.selectionEnd);
            }
        }
        restaurarFiltroNombre = null;
    }
}

function actualizarUltimaActualizacion() {
    const ahora = new Date();
    const hora = ahora.toLocaleTimeString('es-AR');
    document.getElementById('lastUpdate').textContent = `Última actualización: ${hora}`;
}

cargarDatos();
setInterval(cargarDatos, 30000);

if (intervaloContador) {
    clearInterval(intervaloContador);
}

intervaloContador = setInterval(actualizarContadorProximaLargada, 1000);
setInterval(actualizarTablaSiCambioElMinuto, 1000);
