import { MAX_IMAGE_DATA_LENGTH } from "./model";

/**
 * Riduce una foto del dispositivo prima del salvataggio in Firestore.
 * Nessun upload a Storage o ad altri servizi: viene memorizzata una miniatura
 * WebP/JPEG nel campo image del regalo, sincronizzata come gli altri dati.
 */
export async function preparePhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/") && !/\.(heic|heif|jpg|jpeg|png|webp|gif|avif)$/i.test(file.name))
    throw Error("Seleziona un file immagine dalla galleria.");
  if (file.size > 20 * 1024 * 1024)
    throw Error("La foto è troppo grande (massimo 20 MB).");

  const localUrl = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(Error("Il formato della foto non è supportato dal browser. Prova con JPG o PNG."));
      image.src = localUrl;
    });
    if (!image.naturalWidth || !image.naturalHeight)
      throw Error("Impossibile leggere la fotografia.");

    const maxSide = Math.max(image.naturalWidth, image.naturalHeight);
    const attempts: Array<[number, number]> = [
      [980, 0.82], [850, 0.75], [720, 0.68], [600, 0.56], [500, 0.47], [420, 0.4],
    ];
    for (const [side, quality] of attempts) {
      const factor = Math.min(1, side / maxSide);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * factor));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * factor));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw Error("Il browser non può elaborare questa fotografia.");
      ctx.fillStyle = "#ffffff"; // Sfondo chiaro se occorre ripiegare su JPEG.
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      let result = canvas.toDataURL("image/webp", quality);
      if (!result.startsWith("data:image/webp;base64,"))
        result = canvas.toDataURL("image/jpeg", quality);
      if (result.length <= MAX_IMAGE_DATA_LENGTH) return result;
    }
    throw Error("La foto non entra nei limiti gratuiti. Prova a ritagliarla o sceglierne una più semplice.");
  } finally {
    URL.revokeObjectURL(localUrl);
  }
}
