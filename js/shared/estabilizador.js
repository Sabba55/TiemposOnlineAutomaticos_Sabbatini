window.UtilidadesEstabilizador = (function () {
    // namespace ('tramo', 'tramoGeneral', 'shakedown', ...) -> Map(clavePiloto -> registro)
    // registro = { valores: { campo: ultimoValorNoVacio }, vacios: { campo: contadorVaciosConsecutivos } }
    const estados = new Map();

    function _obtenerMapaNamespace(namespace) {
        if (!estados.has(namespace)) {
            estados.set(namespace, new Map());
        }
        return estados.get(namespace);
    }

    function clavePiloto(piloto) {
        return String((piloto && (piloto.Nombre || piloto.NOMBRE || piloto.Piloto || piloto.PILOTO)) || '')
            .trim()
            .toLowerCase();
    }

    function estabilizarValor(namespace, clave, campo, valorNuevo) {
        if (!namespace || !clave || !campo) return valorNuevo;

        const mapaPilotos = _obtenerMapaNamespace(namespace);
        let registro = mapaPilotos.get(clave);
        if (!registro) {
            registro = { valores: {}, vacios: {} };
            mapaPilotos.set(clave, registro);
        }

        const hayValorNuevo = valorNuevo !== undefined && valorNuevo !== null && String(valorNuevo).trim() !== '';

        if (hayValorNuevo) {
            registro.valores[campo] = valorNuevo;
            registro.vacios[campo] = 0;
            return valorNuevo;
        }

        const valorPrevio = registro.valores[campo];
        const teniaValorPrevio = valorPrevio !== undefined && String(valorPrevio).trim() !== '';

        if (!teniaValorPrevio) {
            // Nunca tuvo valor: no hay nada que estabilizar, se muestra el vacío tal cual.
            return valorNuevo;
        }

        registro.vacios[campo] = (registro.vacios[campo] || 0) + 1;

        if (registro.vacios[campo] >= 2) {
            // Segundo vacío consecutivo: se acepta como borrado real.
            delete registro.valores[campo];
            return valorNuevo;
        }

        // Primer vacío: se conserva el valor anterior (probable recálculo transitorio).
        return valorPrevio;
    }

    function estabilizarPilotos(namespace, pilotos, obtenerCampos) {
        const clavesVistas = new Set();

        const resultado = pilotos.map(piloto => {
            const clave = clavePiloto(piloto);
            clavesVistas.add(clave);

            const pilotoEstabilizado = { ...piloto };
            const campos = obtenerCampos(piloto) || [];

            campos.forEach(campo => {
                pilotoEstabilizado[campo] = estabilizarValor(namespace, clave, campo, piloto[campo]);
            });

            return pilotoEstabilizado;
        });

        limpiarNoVistos(namespace, clavesVistas);
        return resultado;
    }

    /** Descarta de la memoria a los pilotos que ya no aparecieron en la última sincronización. */
    function limpiarNoVistos(namespace, clavesVistas) {
        const mapaPilotos = estados.get(namespace);
        if (!mapaPilotos) return;

        [...mapaPilotos.keys()].forEach(clave => {
            if (!clavesVistas.has(clave)) mapaPilotos.delete(clave);
        });
    }

    return { clavePiloto, estabilizarValor, estabilizarPilotos, limpiarNoVistos };
})();