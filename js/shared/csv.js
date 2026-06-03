window.UtilidadesCSV = (function () {
    function normalizarColumnasEtapa(fila) {
        Object.keys(fila)
            .filter(clave => /^(PE|SS)\d+$/.test(clave))
            .forEach(clave => {
                const numero = clave.replace(/^(PE|SS)/, '');
                const alias = clave.startsWith('PE') ? `SS${numero}` : `PE${numero}`;

                if (fila[clave] !== '' && fila[alias] === undefined) {
                    fila[alias] = fila[clave];
                }
            });

        return fila;
    }

    function aplicarAliasColumna(fila, origen, destino) {
        if (fila[origen] !== undefined && fila[origen] !== '' && fila[destino] === undefined) {
            fila[destino] = fila[origen];
        }
    }

    function esValorSi(valor) {
        return String(valor || '').trim().toLowerCase() === 'si';
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

    function normalizarTextoComparacion(valor) {
        if (valor === undefined || valor === null) return '';

        return String(valor)
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function normalizarFechaComparacion(valor) {
        if (valor === undefined || valor === null) return '';

        const texto = String(valor).trim();
        if (!texto) return '';

        const fechaBase = texto.split(/\s+/)[0];
        const partes = fechaBase.split(/[\/\-.]/).map(parte => parte.trim()).filter(Boolean);

        if (partes.length !== 3) {
            return normalizarTextoComparacion(fechaBase);
        }

        let dia = partes[0];
        let mes = partes[1];
        let anio = partes[2];

        if (/^\d{4}$/.test(partes[0])) {
            anio = partes[0];
            mes = partes[1];
            dia = partes[2];
        }

        return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${String(anio).padStart(4, '0')}`;
    }

    function construirIndiceInscriptos(inscriptos) {
        const indice = new Map();

        inscriptos.forEach(inscripto => {
            const nombre = obtenerPrimerValor(inscripto, ['NOMBRE', 'Nombre', 'Piloto', 'PILOTO']);
            const clave = normalizarTextoComparacion(nombre);

            if (!clave || indice.has(clave)) return;

            indice.set(clave, {
                nombre,
                vehiculo: obtenerPrimerValor(inscripto, ['VEHICULO', 'Vehiculo', 'Auto', 'AUTO']),
                categoria: obtenerPrimerValor(inscripto, ['CATEGORIA', 'Categoria']),
                fecha: obtenerPrimerValor(inscripto, ['Fecha', 'FECHA', 'fecha']),
                online: obtenerPrimerValor(inscripto, ['Online', 'ONLINE']),
            });
        });

        return indice;
    }

    function fusionarPilotosConInscriptos(pilotos, inscriptos, fechaRally = '') {
        const indice = construirIndiceInscriptos(inscriptos);
        const fechaRallyNormalizada = normalizarFechaComparacion(fechaRally);

        return pilotos
            .map(piloto => {
                const nombrePiloto = obtenerPrimerValor(piloto, ['Nombre', 'NOMBRE', 'Piloto', 'PILOTO']);
                const clave = normalizarTextoComparacion(nombrePiloto);
                const inscripto = indice.get(clave);

                if (!inscripto) return null;

                const fechaPiloto = obtenerPrimerValor(piloto, ['Fecha', 'FECHA', 'fecha']);
                if (fechaRallyNormalizada && normalizarFechaComparacion(fechaPiloto) !== fechaRallyNormalizada) {
                    return null;
                }

                const nombreMostrado = inscripto.nombre || nombrePiloto;
                const vehiculo = inscripto.vehiculo || obtenerPrimerValor(piloto, ['Vehiculo', 'VEHICULO', 'vehiculo']);
                const categoria = inscripto.categoria || obtenerPrimerValor(piloto, ['Categoria', 'CATEGORIA']);

                return {
                    ...piloto,
                    nombre: nombreMostrado,
                    Nombre: nombreMostrado,
                    NOMBRE: nombreMostrado,
                    Piloto: nombreMostrado,
                    PILOTO: nombreMostrado,
                    vehiculo: vehiculo,
                    Vehiculo: vehiculo,
                    VEHICULO: vehiculo,
                    categoria: categoria,
                    Categoria: categoria,
                    CATEGORIA: categoria,
                    fecha: fechaPiloto,
                    Fecha: fechaPiloto,
                    FECHA: fechaPiloto,
                };
            })
            .filter(Boolean);
    }

    function normalizarColumnasEspeciales(fila) {
        aplicarAliasColumna(fila, 'Piloto', 'Nombre');
        aplicarAliasColumna(fila, 'Nombre', 'Piloto');
        aplicarAliasColumna(fila, 'Penalizacion', 'PENALIZACION');
        aplicarAliasColumna(fila, 'PENALIZACION', 'Penalizacion');
        return fila;
    }

    function analizarCSV(csv, opciones = {}) {
        const {
            transformarEncabezados = (encabezado) => encabezado.trim(),
            mapearFila = null,
            filtrarFila = null
        } = opciones;

        const lineas = csv.trim().split('\n');
        const encabezados = lineas[0].split(',').map(transformarEncabezados);
        const datos = [];

        for (let i = 1; i < lineas.length; i++) {
            const linea = lineas[i].trim();
            if (!linea) continue;

            const valores = lineas[i].split(',').map(valor => valor.trim());
            const fila = {};

            encabezados.forEach((encabezado, indice) => {
                fila[encabezado] = valores[indice] || '';
            });

            normalizarColumnasEtapa(fila);
            normalizarColumnasEspeciales(fila);

            if (filtrarFila && !filtrarFila(fila)) continue;

            datos.push(mapearFila ? mapearFila(fila) : fila);
        }

        return datos;
    }

    return {
        analizarCSV,
        esValorSi,
        normalizarTextoComparacion,
        normalizarFechaComparacion,
        obtenerPrimerValor,
        fusionarPilotosConInscriptos
    };
})();
