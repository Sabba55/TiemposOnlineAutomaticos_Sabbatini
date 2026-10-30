window.AutoActualizacion = (function () {
    const INTERVALO_MS = 30000; // único lugar donde se cambia el intervalo
    let ultimaCarga = 0;
    let cargando = false;

    async function ejecutar(funcionCarga) {
        if (cargando) return;
        cargando = true;
        try {
            await funcionCarga();
            ultimaCarga = Date.now();
        } finally {
            cargando = false;
        }
    }

    function programar(funcionCarga) {
        const margen = Math.random() * 3000; // reparte a los usuarios en el tiempo
        setTimeout(async () => {
            if (!document.hidden) await ejecutar(funcionCarga);
            programar(funcionCarga);
        }, INTERVALO_MS + margen);
    }

    function iniciar(funcionCarga) {
        ultimaCarga = Date.now();
        programar(funcionCarga);
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && Date.now() - ultimaCarga > INTERVALO_MS) {
                ejecutar(funcionCarga);
            }
        });
    }

    return { iniciar };
})();