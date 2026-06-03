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

    function normalizarTextoCompacto(valor) {
        return normalizarTextoComparacion(valor).replace(/\s+/g, '');
    }

    function expandirApodos(tokens) {
        if (!Array.isArray(tokens) || tokens.length === 0) return [];

        const alias = {
            nico: 'nicolas',
            fer: 'fernando',
            fede: 'federico',
            facu: 'facundo',
            eze: 'ezequiel',
            peter: 'pedro',
            lichy: 'lisandro',
            nacho: 'ignacio'
        };

        return tokens.map((token, indice) => {
            if (indice === 0 && alias[token]) return alias[token];
            return token;
        });
    }

    function normalizarNombreComponentes(valor) {
        if (valor === undefined || valor === null) return [];

        const texto = String(valor)
            .trim()
            .replace(/\d+/g, ' ')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/[^A-Za-z\u00C0-\u00FF]+/g, ' ')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();

        if (!texto) return [];

        return expandirApodos(texto.split(' ').filter(Boolean));
    }

    function _obtenerApellido(tokens) {
        if (!Array.isArray(tokens) || tokens.length === 0) return '';
        return tokens[tokens.length - 1] || '';
    }

    function _obtenerNombre(tokens) {
        if (!Array.isArray(tokens) || tokens.length === 0) return '';
        return tokens[0] || '';
    }

    function _esAbreviacionPrefijo(corto, largo) {
        if (!corto || !largo) return false;
        if (corto === largo) return true;
        if (corto.length < 4) return false;
        if (largo.length <= corto.length) return false;
        return largo.startsWith(corto);
    }

    function _tokensCompartidos(tokensA, tokensB) {
        if (!Array.isArray(tokensA) || !Array.isArray(tokensB)) return [];

        const setB = new Set(tokensB);
        return tokensA.filter(token => token && token.length >= 4 && setB.has(token));
    }

    function generarPermutaciones(tokens) {
        const resultados = [];
        const arr = [...tokens];

        const permutar = (inicio = 0) => {
            if (inicio === arr.length - 1) {
                resultados.push([...arr]);
                return;
            }

            for (let i = inicio; i < arr.length; i++) {
                [arr[inicio], arr[i]] = [arr[i], arr[inicio]];
                permutar(inicio + 1);
                [arr[inicio], arr[i]] = [arr[i], arr[inicio]];
            }
        };

        if (arr.length === 1) {
            resultados.push(arr);
            return resultados;
        }

        permutar(0);
        return resultados;
    }

    function obtenerClavesNombre(valor) {
        const tokens = normalizarNombreComponentes(valor);
        if (tokens.length === 0) return [];

        const claves = new Set();
        const compacta = tokens.join('');
        const ordenada = [...tokens].sort();

        claves.add(tokens.join(' '));
        claves.add(compacta);
        claves.add(ordenada.join(' '));
        claves.add(ordenada.join(''));

        if (tokens.length <= 3) {
            generarPermutaciones(tokens).forEach(permutacion => {
                claves.add(permutacion.join(' '));
                claves.add(permutacion.join(''));
            });
        }

        return [...claves].filter(Boolean);
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
        return inscriptos
            .map(inscripto => ({
                nombre: obtenerPrimerValor(inscripto, ['NOMBRE', 'Nombre', 'Piloto', 'PILOTO']),
                vehiculo: obtenerPrimerValor(inscripto, ['VEHICULO', 'Vehiculo', 'Auto', 'AUTO']),
                categoria: obtenerPrimerValor(inscripto, ['CATEGORIA', 'Categoria']),
                fecha: obtenerPrimerValor(inscripto, ['Fecha', 'FECHA', 'fecha']),
                online: obtenerPrimerValor(inscripto, ['Online', 'ONLINE']),
                claves: obtenerClavesNombre(obtenerPrimerValor(inscripto, ['NOMBRE', 'Nombre', 'Piloto', 'PILOTO']))
            }))
            .filter(inscripto => inscripto.nombre);
    }

    function _compactarClave(clave) {
        return String(clave || '').replace(/\s+/g, '');
    }

    function _ordenarTokens(clave) {
        return String(clave || '')
            .trim()
            .split(' ')
            .filter(Boolean)
            .sort()
            .join(' ');
    }

    function _esSubsecuencia(tokensCortos, tokensLargos) {
        if (!Array.isArray(tokensCortos) || !Array.isArray(tokensLargos)) return false;
        if (tokensCortos.length === 0 || tokensCortos.length > tokensLargos.length) return false;

        let indiceLargo = 0;

        for (const token of tokensCortos) {
            let encontrado = false;

            while (indiceLargo < tokensLargos.length) {
                if (tokensLargos[indiceLargo] === token) {
                    encontrado = true;
                    indiceLargo++;
                    break;
                }
                indiceLargo++;
            }

            if (!encontrado) return false;
        }

        return true;
    }

    function obtenerExcepcionNombre(nombrePiloto) {
        const excepciones = {
            leoespindola: 'Leonardo Espindola'
        };

        return excepciones[normalizarTextoCompacto(nombrePiloto)] || '';
    }

    function _puntuarCoincidenciaNombre(nombrePiloto, inscripto, clavesPiloto, tokensPiloto, nombrePilotoBase, compactoPiloto) {
        const claves = inscripto.claves || [];
        const tokensIncripto = normalizarNombreComponentes(inscripto.nombre);
        const nombreIncriptoBase = _obtenerNombre(tokensIncripto);
        const compactoIncripto = _compactarClave(normalizarTextoComparacion(inscripto.nombre));
        const compartidos = _tokensCompartidos(tokensPiloto, tokensIncripto);

        let mejorPuntaje = 0;

        for (const clavePiloto of clavesPiloto) {
            const clavePilotoCompacta = _compactarClave(clavePiloto);
            const clavePilotoOrdenada = _ordenarTokens(clavePiloto);

            for (const claveIncripto of claves) {
                const claveIncriptoCompacta = _compactarClave(claveIncripto);
                const claveIncriptoOrdenada = _ordenarTokens(claveIncripto);

                if (!clavePilotoCompacta || !claveIncriptoCompacta) continue;

                let puntaje = 0;

                if (clavePilotoCompacta === claveIncriptoCompacta) {
                    puntaje = Math.max(puntaje, 100);
                }

                if (clavePilotoOrdenada && clavePilotoOrdenada === claveIncriptoOrdenada) {
                    puntaje = Math.max(puntaje, 95);
                }

                if (compartidos.length > 0 && _esAbreviacionPrefijo(nombrePilotoBase, nombreIncriptoBase)) {
                    puntaje = Math.max(puntaje, 35 + (compartidos.length * 5));
                }

                if (compartidos.length > 0 && _esAbreviacionPrefijo(nombreIncriptoBase, nombrePilotoBase)) {
                    puntaje = Math.max(puntaje, 35 + (compartidos.length * 5));
                }

                if (_esSubsecuencia(tokensPiloto, tokensIncripto) || _esSubsecuencia(tokensIncripto, tokensPiloto)) {
                    puntaje = Math.max(puntaje, 45 + (compartidos.length * 5));
                }

                if (compactoPiloto && compactoIncripto) {
                    const pilotoContieneIncripto = tokensIncripto
                        .filter(token => token.length >= 4)
                        .every(token => compactoPiloto.includes(token));
                    const incriptoContienePiloto = tokensPiloto
                        .filter(token => token.length >= 4)
                        .every(token => compactoIncripto.includes(token));

                    if (pilotoContieneIncripto || incriptoContienePiloto) {
                        puntaje = Math.max(puntaje, 25 + (compartidos.length * 5));
                    }
                }

                if (compartidos.length > 0) {
                    puntaje = Math.max(puntaje, 15 + (compartidos.length * 5));
                }

                mejorPuntaje = Math.max(mejorPuntaje, puntaje);
            }
        }

        return mejorPuntaje;
    }

    function encontrarCoincidenciaNombre(nombrePiloto, indiceInscriptos) {
        const nombreExcepcion = obtenerExcepcionNombre(nombrePiloto);
        if (nombreExcepcion) {
            const coincidenciaExcepcion = indiceInscriptos.find(inscripto =>
                normalizarTextoCompacto(inscripto.nombre) === normalizarTextoCompacto(nombreExcepcion)
            );

            if (coincidenciaExcepcion) {
                return coincidenciaExcepcion;
            }
        }

        const clavesPiloto = obtenerClavesNombre(nombrePiloto);
        const tokensPiloto = normalizarNombreComponentes(nombrePiloto);
        const nombrePilotoBase = _obtenerNombre(tokensPiloto);
        const compactoPiloto = _compactarClave(normalizarTextoComparacion(nombrePiloto));
        let mejorCoincidencia = null;
        let mejorPuntaje = 0;

        for (const inscripto of indiceInscriptos) {
            const puntaje = _puntuarCoincidenciaNombre(
                nombrePiloto,
                inscripto,
                clavesPiloto,
                tokensPiloto,
                nombrePilotoBase,
                compactoPiloto
            );

            if (puntaje > mejorPuntaje) {
                mejorPuntaje = puntaje;
                mejorCoincidencia = inscripto;
            }
        }

        return mejorPuntaje >= 40 ? mejorCoincidencia : null;
    }

    function fusionarPilotosConInscriptos(pilotos, inscriptos, fechaRally = '') {
        const indice = construirIndiceInscriptos(inscriptos);
        const fechaRallyNormalizada = normalizarFechaComparacion(fechaRally);

        return pilotos
            .map(piloto => {
                const nombrePiloto = obtenerPrimerValor(piloto, ['Nombre', 'NOMBRE', 'Piloto', 'PILOTO']);
                const inscripto = encontrarCoincidenciaNombre(nombrePiloto, indice);

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
        normalizarTextoCompacto,
        normalizarNombreComponentes,
        obtenerClavesNombre,
        normalizarFechaComparacion,
        obtenerPrimerValor,
        fusionarPilotosConInscriptos
    };
})();
