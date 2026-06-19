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
const URL_AUDIO = BASE_URL + "/static/audio_model/";

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
let modeloImagen = null;
let etiquetasImagen = [];

const URL_IMAGEN = BASE_URL + "/static/image_model/";

// IMAGEN: al seleccionar archivo, se analiza con TensorFlow.js
if (inputImagen) {
    inputImagen.addEventListener("change", analizarImagenTensorFlow);
}

async function analizarImagenTensorFlow() {
    try {
        if (!inputImagen.files || inputImagen.files.length === 0) {
            return;
        }

        if (typeof tf === "undefined") {
            estado.textContent = "No cargó TensorFlow.js. Revisa el HTML.";
            return;
        }

        estado.textContent = "Cargando modelo de imagen...";

        const modelURL = URL_IMAGEN + "model.json";
        const metadataURL = URL_IMAGEN + "metadata.json";

        console.log("Modelo imagen:", modelURL);
        console.log("Metadata imagen:", metadataURL);

        if (!modeloImagen) {
            modeloImagen = await tf.loadLayersModel(modelURL);

            const respuestaMetadata = await fetch(metadataURL);
            const metadata = await respuestaMetadata.json();

            etiquetasImagen = metadata.labels;

            console.log("Modelo de imagen cargado.");
            console.log("Etiquetas imagen:", etiquetasImagen);
        }

        const archivo = inputImagen.files[0];
        const urlTemporal = URL.createObjectURL(archivo);

        const imagen = new Image();

        imagen.onload = async () => {
            const tensorImagen = tf.tidy(() => {
                return tf.browser.fromPixels(imagen)
                    .resizeNearestNeighbor([224, 224])
                    .toFloat()
                    .div(127.5)
                    .sub(1)
                    .expandDims(0);
            });

            const prediccion = modeloImagen.predict(tensorImagen);
            const scores = await prediccion.data();

            tensorImagen.dispose();
            prediccion.dispose();

            let indiceMayor = 0;
            let confianzaMayor = scores[0];

            for (let i = 1; i < scores.length; i++) {
                if (scores[i] > confianzaMayor) {
                    confianzaMayor = scores[i];
                    indiceMayor = i;
                }
            }

            const etiqueta = etiquetasImagen[indiceMayor];
            const confianza = (confianzaMayor * 100).toFixed(1);

            let detalle = "";

            for (let i = 0; i < etiquetasImagen.length; i++) {
                detalle += etiquetasImagen[i] + ": " + (scores[i] * 100).toFixed(1) + "%";
                if (i < etiquetasImagen.length - 1) {
                    detalle += " | ";
                }
            }

            actualizarResultado(
                "🖼️",
                "Imagen: " + etiqueta,
                detalle
            );

            estado.textContent = "Imagen analizada: " + etiqueta + " (" + confianza + "%)";

            console.log("Scores imagen:", scores);
            console.log("Resultado imagen:", etiqueta, confianza + "%");

            URL.revokeObjectURL(urlTemporal);
        };

        imagen.src = urlTemporal;

    } catch (error) {
        const mensaje = error && error.message ? error.message : String(error);
        estado.textContent = "Error al analizar imagen: " + mensaje;
        console.error("Error imagen:", error);
    }
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
            estado.textContent = "ERROR";
            return;
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            estado.textContent = "Tu navegador no soporta acceso al micrófono.";
            return;
        }

        cargandoAudio = true;
        cambiarBotonAudio("⏳", "Cargando", "Espera unos segundos...");
        estado.textContent = "Cargando audio...";

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
        estado.textContent = "Micrófono activo. analizando en vivo.";

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
        "Se detectó: " + etiqueta + " con una confianza de " + confianza + "%."
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
            "El audio se analizará en vivo"
        );

        estado.textContent = "Micrófono detenido.";
        console.log("Micrófono detenido correctamente.");

    } catch (error) {
        escuchandoAudio = false;
        cargandoAudio = false;

        cambiarBotonAudio(
            "🎙️",
            "Activar micrófono",
            
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