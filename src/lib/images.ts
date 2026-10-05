export function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not open that image."));
    image.src = source;
  });
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that photo. Please try again."));
    reader.readAsDataURL(file);
  });
}

export async function processImage(source: string, operation: "compress" | "rotate" | "crop" | "enhance" = "compress", maxDimension = 1150): Promise<string> {
  const image = await loadImage(source);
  const rotated = operation === "rotate";
  const crop = operation === "crop" ? .06 : 0;
  const sourceX = image.width * crop;
  const sourceY = image.height * crop;
  const sourceW = image.width * (1 - crop * 2);
  const sourceH = image.height * (1 - crop * 2);
  const scale = Math.min(1, maxDimension / Math.max(sourceW, sourceH));
  const width = Math.round(sourceW * scale);
  const height = Math.round(sourceH * scale);
  const canvas = document.createElement("canvas");
  canvas.width = rotated ? height : width;
  canvas.height = rotated ? width : height;
  const context = canvas.getContext("2d", { willReadFrequently: operation === "enhance" });
  if (!context) throw new Error("Image processing is unavailable on this device.");
  if (rotated) { context.translate(canvas.width, 0); context.rotate(Math.PI / 2); }
  context.drawImage(image, sourceX, sourceY, sourceW, sourceH, 0, 0, width, height);
  if (operation === "enhance") {
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const lightness = pixels.data[i] * .3 + pixels.data[i + 1] * .59 + pixels.data[i + 2] * .11;
      const crisp = Math.min(255, Math.max(0, (lightness - 128) * 1.7 + 154));
      pixels.data[i] = crisp;
      pixels.data[i + 1] = crisp;
      pixels.data[i + 2] = crisp;
    }
    context.putImageData(pixels, 0, 0);
  }
  return canvas.toDataURL("image/jpeg", .72);
}

export function typedSignature(name: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 640; canvas.height = 160;
  const context = canvas.getContext("2d");
  if (!context) return "";
  context.fillStyle = "#1b304c";
  context.font = "italic 52px Georgia, serif";
  context.fillText(name, 18, 100, 590);
  return canvas.toDataURL("image/png");
}