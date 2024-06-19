// Función asincrónica para configurar la entrada de video
async function setupVideoInput() {
  const video = document.getElementById("video");
  const videoInput = document.getElementById("videoInput");
  const runButton = document.getElementById("runButton");

  return new Promise((resolve) => {
    // Agregar un listener para cuando se cambie el archivo de video
    videoInput.addEventListener("change", (event) => {
      // Obtener el primer archivo seleccionado por el usuario
      const file = event.target.files[0];

      if (file) {
        // Crear una URL temporal para el archivo de video seleccionado
        const fileURL = URL.createObjectURL(file);
        // Asignar la URL del archivo de video al elemento de video
        video.src = fileURL;

        // Resolver la promesa cuando los metadatos del video estén cargados
        video.onloadedmetadata = () => {
          resolve(video);
        };
      } else {
        // Mostrar una alerta si no se seleccionó un archivo de video válido
        alert("Por favor selecciona un archivo de video válido.");
      }
    });

    // Agregar un listener para cuando se haga clic en el botón de ejecutar
    runButton.addEventListener("click", () => {
      if (video.src) {
        video.style.display = "block";
        video.play();
      }
    });
  });
}

// Agregar un listener para guardar la imagen cuando se haga clic en el botón de guardar
document.getElementById("saveButton").addEventListener("click", () => {
  const canvas = document.getElementById("canvas");
  const link = document.createElement("a");
  link.download = "pose.png";
  link.href = canvas.toDataURL();
  link.click();
});

// Función asincrónica para cargar el modelo de Posenet
async function loadPosenet() {
  const net = await posenet.load();
  return net;
}

// Función para dibujar puntos clave en el canvas
function drawKeypoints(keypoints, contexto) {
  // Iterar sobre cada punto clave estimado
  keypoints.forEach((keypoint) => {
    const { x, y } = keypoint.position; // Obtener las coordenadas del punto
    const confianza = keypoint.score.toFixed(2); // Redondear la confianza a dos decimales
    contexto.beginPath(); // Comenzar un nuevo trazado
    contexto.arc(x, y, 5, 0, 2 * Math.PI); // Dibujar un círculo en la posición del punto clave
    contexto.fillStyle = "blue";
    contexto.fill();
    contexto.font = "10px Arial"; // Establecer la fuente y el tamaño del texto
    contexto.fillText(`${keypoint.part} (${confianza})`, x + 6, y - 6); // Mostrar el nombre del punto y su confianza cerca del punto
  });
}

// Función para dibujar el esqueleto en el canvas
function drawSkeleton(keypoints, minConfidence, contexto) {
  // Obtener los puntos clave adyacentes con una confianza mínima
  const adjacentKeyPoints = posenet.getAdjacentKeyPoints(
    keypoints,
    minConfidence
  );
  console.log(adjacentKeyPoints);

  // Iterar sobre cada par de puntos clave adyacentes
  adjacentKeyPoints.forEach(([keypoint1, keypoint2]) => {
    // Dibujar un segmento entre los dos puntos clave adyacentes
    drawSegment(keypoint1.position, keypoint2.position, "aqua", 2, contexto);
  });
}

// Función para dibujar un segmento (línea) entre dos puntos en el canvas
function drawSegment({ y: ay, x: ax }, { y: by, x: bx }, color, scale, ctx) {
  // Inicia un nuevo trazado o camino en el contexto del canvas
  ctx.beginPath();
  // Mueve el cursor del contexto del canvas a la posición inicial del segmento
  ctx.moveTo(ax, ay);
  // Dibuja una línea desde la posición inicial a la posición final del segmento
  ctx.lineTo(bx, by);
  // Establece el grosor de la línea
  ctx.lineWidth = scale;
  // Establece el color de la línea
  ctx.strokeStyle = color;
  // Dibuja (traza) la línea en el canvas
  ctx.stroke();
}

// Función para verificar si la pose es una "T Pose"
function isTPose(keypoints, minConfidence) {
  // Buscar los puntos clave relevantes
  const leftWrist = keypoints.find((k) => k.part === "leftWrist");
  const rightWrist = keypoints.find((k) => k.part === "rightWrist");
  const leftShoulder = keypoints.find((k) => k.part === "leftShoulder");
  const rightShoulder = keypoints.find((k) => k.part === "rightShoulder");

  // Verificar si los puntos clave tienen una confianza mínima
  if (
    leftWrist.score > minConfidence &&
    rightWrist.score > minConfidence &&
    leftShoulder.score > minConfidence &&
    rightShoulder.score > minConfidence
  ) {
    // Calcular la rectitud de los brazos izquierdo y derecho
    const leftArmStraight =
      Math.abs(leftWrist.position.y - leftShoulder.position.y) < 50;
    const rightArmStraight =
      Math.abs(rightWrist.position.y - rightShoulder.position.y) < 50;

    // Verificar si ambos brazos están rectos
    return leftArmStraight && rightArmStraight;
  }

  // Si alguno de los puntos clave no tiene suficiente confianza, no se considera una "T Pose"
  return false;
}

// Función asincrónica para detectar la pose en el video
async function detectPose(video, net) {
  const canvas = document.getElementById("canvas");
  const contexto = canvas.getContext("2d");

  // Función asincrónica para detectar la pose en cada frame del video
  async function poseDetectionFrame() {
    // Si el video está en pausa o ha terminado, salir de la función
    if (video.paused || video.ended) {
      return;
    }

    // Estimar la pose en el video actual usando el modelo de Posenet
    const pose = await net.estimateSinglePose(video, { flipHorizontal: false });

    // Limpiar el canvas antes de dibujar el nuevo frame
    contexto.clearRect(0, 0, canvas.width, canvas.height);
    // Dibujar el video en el canvas
    contexto.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Dibujar los puntos clave estimados en el canvas
    drawKeypoints(pose.keypoints, contexto);
    // Dibujar el esqueleto estimado en el canvas
    drawSkeleton(pose.keypoints, 0.6, contexto);

    // Verificar si la pose detectada es una "T Pose"
    if (isTPose(pose.keypoints, 0.6)) {
      contexto.font = "20px Arial";
      contexto.fillText("T Pose Detectada", 10, 50);
    }

    // Llamar a esta función nuevamente para el siguiente frame
    requestAnimationFrame(poseDetectionFrame);
  }

  // Iniciar la detección de pose en los frames del video
  poseDetectionFrame();
}

// Función principal asincrónica
async function main() {
  // Configurar entrada de video
  const video = await setupVideoInput();
  // Cargar el modelo de Posenet
  const net = await loadPosenet();

  video.addEventListener("play", () => {
    // Detectar la pose cuando el video se esté reproduciendo
    detectPose(video, net);
  });
}

main(); // Ejecutar la función principal
