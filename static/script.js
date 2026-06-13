const robot = document.getElementById("robotMascota");
const btnSaludar = document.getElementById("btnSaludar");
const estado = document.getElementById("estado");

const formImagen = document.getElementById("formImagen");
const inputImagen = document.getElementById("inputImagen");

let recognizer = null;
let escuchandoAudio = false;
let cargandoAudio = false;
let etiquetasModelo = [];

// ESTA ES LA CORRECCIÓN IMPORTANTE
const BASE_URL = window.location.origin;
const URL_AUDIO = BASE_URL + "/static/my_model/";

// ROBOT SALUDA
if (btnSaludar && robot) {
    btnSaludar.addEventListener("click", () => {
        const animaciones = robot.availableAnimations || [];
        const saludo = animaciones.includes("Wave") ? "Wave" : animaciones[0];

        if (saludo) {
            robot.animationName = saludo;
            robot.currentTime = 0;
            robot.play({ repetitions: 1 });
        } else if (estado) {
            estado.textContent = "El robot está listo, pero este modelo no tiene animación de saludo.";
        }
    });
}

// IMAGEN: al seleccionar archivo, se envía sin botón extra
if (inputImagen && formImagen) {
    inputImagen.addEventListener("change", () => {
        if (inputImagen.files.length > 0) {
            estado.textContent = "Imagen seleccionada. Enviando al backend...";
            formImagen.submit();
        }
    });
}

// AUDIO: activar / detener micrófono
async function iniciarAudioTeachable() {
    if (escuchandoAudio) {
        detenerAudioTeachable();
        return;
    }

    if (cargandoAudio) {
        estado.textContent = "El modelo aún está cargando. Espera un momento...";
        return;
    }

    try {
        if (typeof speechCommands === "undefined") {
            estado.textContent = "No cargó la librería speech-commands. Revisa el HTML.";
            return;
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            estado.textContent = "Tu navegador no soporta acceso al micrófono o requiere HTTPS.";
            return;
        }

        cargandoAudio = true;
        cambiarBotonAudio("⏳", "Cargando modelo", "Espera unos segundos...");
        estado.textContent = "Cargando modelo de audio...";

        const checkpointURL = URL_AUDIO + "model.json";
        const metadataURL = URL_AUDIO + "metadata.json";

        console.log("Modelo:", checkpointURL);
        console.log("Metadata:", metadataURL);

        if (!recognizer) {
            recognizer = speechCommands.create(
                "BROWSER_FFT",
                undefined,
                checkpointURL,
                metadataURL
            );

            await recognizer.ensureModelLoaded();
            etiquetasModelo = recognizer.wordLabels();

            console.log("Etiquetas del modelo:", etiquetasModelo);
        }

        escuchandoAudio = true;
        cargandoAudio = false;

        cambiarBotonAudio("⏹️", "Detener micrófono", "Haz clic para detener el análisis");
        estado.textContent = "Micrófono activo. El modelo está analizando en vivo.";

        recognizer.listen(resultadoAudio, {
            includeSpectrogram: true,
            probabilityThreshold: 0,
            invokeCallbackOnNoiseAndUnknown: true,
            overlapFactor: 0.50
        });

    } catch (error) {
        cargandoAudio = false;
        escuchandoAudio = false;

        cambiarBotonAudio(
            "🎙️",
            "Activar micrófono",
            "El audio se analizará en vivo con Teachable Machine"
        );

        const mensaje = error && error.message ? error.message : String(error);
        estado.textContent = "Error de audio: " + mensaje;
        console.error("Audio error:", error);
    }
}

// RECIBE RESULTADOS DEL MODELO
function resultadoAudio(result) {
    if (!escuchandoAudio) {
        return;
    }

    const scores = result.scores;

    let indiceMayor = 0;
    let confianzaMayor = scores[0];

    for (let i = 1; i < scores.length; i++) {
        if (scores[i] > confianzaMayor) {
            confianzaMayor = scores[i];
            indiceMayor = i;
        }
    }

    const etiqueta = etiquetasModelo[indiceMayor];
    const confianza = (confianzaMayor * 100).toFixed(1);

    mostrarPorcentajes(etiquetasModelo, scores);

    actualizarResultado(
        "🎙️",
        etiqueta,
        "El modelo detectó: " + etiqueta + " con una confianza de " + confianza + "%."
    );

    estado.textContent = "Resultado detectado: " + etiqueta + " (" + confianza + "%)";

    console.log("Resultado:", etiqueta, confianza + "%");
    console.log("Scores:", scores);
}

// DETENER MICRÓFONO
function detenerAudioTeachable() {
    try {
        if (recognizer) {
            recognizer.stopListening();
        }

        escuchandoAudio = false;
        cargandoAudio = false;

        cambiarBotonAudio(
            "🎙️",
            "Activar micrófono",
            "El audio se analizará en vivo con Teachable Machine"
        );

        estado.textContent = "Micrófono detenido.";
        console.log("Micrófono detenido correctamente.");

    } catch (error) {
        escuchandoAudio = false;
        cargandoAudio = false;

        cambiarBotonAudio(
            "🎙️",
            "Activar micrófono",
            "El audio se analizará en vivo con Teachable Machine"
        );

        estado.textContent = "Se intentó detener el micrófono.";
        console.error(error);
    }
}

// CAMBIA TEXTO DEL BOTÓN DE AUDIO
function cambiarBotonAudio(icono, titulo, texto) {
    const iconoAudio = document.getElementById("iconoAudio");
    const tituloAudio = document.getElementById("tituloAudio");
    const textoAudio = document.getElementById("textoAudio");

    if (iconoAudio && tituloAudio && textoAudio) {
        iconoAudio.textContent = icono;
        tituloAudio.textContent = titulo;
        textoAudio.textContent = texto;
    }
}

// ACTUALIZA TARJETA DE RESULTADO
function actualizarResultado(icono, titulo, detalle) {
    const iconoResultado = document.getElementById("iconoResultado");
    const tituloResultado = document.getElementById("tituloResultado");
    const detalleResultado = document.getElementById("detalleResultado");

    if (iconoResultado && tituloResultado && detalleResultado) {
        iconoResultado.textContent = icono;
        tituloResultado.textContent = titulo;
        detalleResultado.textContent = detalle;
    }
}

// MUESTRA PORCENTAJES DE CADA CLASE
function mostrarPorcentajes(etiquetas, scores) {
    const porcentajeIA = document.getElementById("porcentajeIA");
    const porcentajeREAL = document.getElementById("porcentajeREAL");
    const porcentajeRuido = document.getElementById("porcentajeRuido");

    for (let i = 0; i < etiquetas.length; i++) {
        const etiqueta = etiquetas[i];
        const porcentaje = (scores[i] * 100).toFixed(1) + "%";

        if (etiqueta === "IA" && porcentajeIA) {
            porcentajeIA.textContent = porcentaje;
        }

        if (etiqueta === "REAL" && porcentajeREAL) {
            porcentajeREAL.textContent = porcentaje;
        }

        if (etiqueta === "Ruido de fondo" && porcentajeRuido) {
            porcentajeRuido.textContent = porcentaje;
        }
    }
}