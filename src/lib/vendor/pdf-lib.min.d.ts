export type PdfColor = object;
export type PdfFont = { widthOfTextAtSize(text: string, size: number): number; encodeText(text: string): unknown };
export type PdfPage = {
  drawText(text: string, options: { x: number; y: number; size: number; font: PdfFont; color?: PdfColor }): void;
  drawRectangle(options: { x: number; y: number; width: number; height: number; color?: PdfColor; borderColor?: PdfColor; borderWidth?: number }): void;
  drawCircle(options: { x: number; y: number; size: number; color?: PdfColor; borderColor?: PdfColor; borderWidth?: number }): void;
  drawLine(options: { start: { x: number; y: number }; end: { x: number; y: number }; thickness?: number; color?: PdfColor }): void;
};
export type PdfDocument = { addPage(size: [number, number]): PdfPage; embedFont(name: string): Promise<PdfFont>; save(options?: { useObjectStreams?: boolean }): Promise<Uint8Array>; getPageCount(): number; getPages(): { getSize(): { width: number; height: number } }[] };
export const PDFDocument: { create(): Promise<PdfDocument>; load(bytes: Uint8Array): Promise<PdfDocument> };
export const StandardFonts: { Helvetica: string; HelveticaBold: string };
export function rgb(r: number, g: number, b: number): PdfColor;
