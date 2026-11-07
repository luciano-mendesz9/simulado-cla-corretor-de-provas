"use client";

export type ImageToAnalyze = { name: string; blob: Blob; error?: string };
function blobFromCanvas(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Não foi possível preparar a imagem.")), "image/jpeg", quality));
}
async function sizedJpeg(canvas: HTMLCanvasElement, name: string): Promise<ImageToAnalyze> {
  if (Math.min(canvas.width, canvas.height) < 700) throw new Error(`${name}: resolução insuficiente para ler as bolinhas. Use uma imagem com pelo menos 700 pixels no lado menor.`);
  let blob = await blobFromCanvas(canvas, .88);
  if (blob.size > 3_700_000) blob = await blobFromCanvas(canvas, .78);
  if (blob.size > 3_700_000) throw new Error(`${name}: imagem acima do limite sem compressão segura. Use uma foto mais nítida ou recorte o cartão.`);
  return { name, blob };
}
export async function preparePhoto(file: File) {
  if (file.size > 25_000_000) throw new Error(`${file.name}: arquivo acima de 25 MB.`);
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const factor = Math.min(1, 2600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * factor); canvas.height = Math.round(bitmap.height * factor);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas indisponível.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await sizedJpeg(canvas, file.name);
  } finally { bitmap.close(); }
}

export async function openPdf(file: File) {
  if (file.size > 25_000_000) throw new Error("O PDF excede 25 MB.");
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data, isEvalSupported: false });
  let pdf;
  try { pdf = await task.promise; } catch { throw new Error("PDF inválido, protegido ou danificado."); }
  if (pdf.numPages > 15) { await task.destroy(); throw new Error("O PDF pode ter no máximo 15 páginas A4 (30 cartões)." ); }
  return { file, pages: pdf.numPages, document: pdf, destroy: () => task.destroy() };
}
export async function* pdfCards(pdf: Awaited<ReturnType<typeof openPdf>>): AsyncGenerator<ImageToAnalyze> {
  for (let pageNumber = 1; pageNumber <= pdf.pages; pageNumber++) {
    let page: Awaited<ReturnType<typeof pdf.document.getPage>> | undefined;
    let nextHalf = 0;
    try {
      page = await pdf.document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 2.8 });
      if (viewport.width / viewport.height < .68 || viewport.width / viewport.height > .74) throw new Error(`Página ${pageNumber}: use páginas A4 em retrato.`);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height);
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Canvas indisponível.");
      await page.render({ canvasContext: context, canvas, viewport }).promise;
      for (let half = 0; half < 2; half++) {
        nextHalf = half;
        const card = document.createElement("canvas");
        card.width = canvas.width; card.height = Math.floor(canvas.height / 2);
        const c = card.getContext("2d", { willReadFrequently: true });
        if (!c) throw new Error("Canvas indisponível.");
        c.drawImage(canvas, 0, half * card.height, canvas.width, card.height, 0, 0, card.width, card.height);
        const pixels = c.getImageData(0, 0, card.width, card.height).data;
        let dark = 0;
        for (let i = 0; i < pixels.length; i += 160) if (pixels[i] < 180) dark++;
        if (dark < 100) { nextHalf = half + 1; continue; }
        const name = `${pdf.file.name} · página ${pageNumber}, cartão ${half + 1}`;
        try { yield await sizedJpeg(card, name); }
        catch (error) { yield { name, blob: new Blob(), error: error instanceof Error ? error.message : "Falha na página do PDF." }; }
        nextHalf = half + 1;
      }
      canvas.width = 0; canvas.height = 0;
    } catch (error) {
      for (let half = nextHalf; half < 2; half++) yield { name: `${pdf.file.name} · página ${pageNumber}, cartão ${half + 1}`, blob: new Blob(), error: error instanceof Error ? error.message : "Falha na página do PDF." };
    } finally { page?.cleanup(); }
  }
}
