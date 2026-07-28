import fs from "fs/promises";
import { pdf as pdfToImages } from "pdf-to-img";
import sharp from "sharp";
import { createWorker } from "tesseract.js";

const MAX_OCR_PDF_PAGES = 15;
const OCR_TEXT_THRESHOLD = 20;

const createOcrWorker = async () => {
  const worker = await createWorker("eng");
  return worker;
};

const recognizeText = async (worker, imagePathOrBuffer) => {
  const result = await worker.recognize(imagePathOrBuffer);
  return result?.data?.text?.trim() || "";
};

const preprocessImage = async (imagePathOrBuffer) => {
  return sharp(imagePathOrBuffer, { failOn: "none" })
    .rotate()
    .resize({ width: 1800, withoutEnlargement: false, fit: "inside" })
    .grayscale()
    .normalize()
    .sharpen()
    .png()
    .toBuffer();
};

const extractBestTextFromImage = async (worker, imagePathOrBuffer) => {
  const rawText = await recognizeText(worker, imagePathOrBuffer);
  if (rawText.length >= OCR_TEXT_THRESHOLD) {
    return rawText;
  }

  try {
    const processedImage = await preprocessImage(imagePathOrBuffer);
    const processedText = await recognizeText(worker, processedImage);
    return processedText.length > rawText.length ? processedText : rawText;
  } catch (_error) {
    return rawText;
  }
};

export const extractTextFromImage = async (imagePathOrBuffer) => {
  let worker;

  try {
    worker = await createOcrWorker();
    return await extractBestTextFromImage(worker, imagePathOrBuffer);
  } finally {
    if (worker) {
      await worker.terminate();
    }
  }
};

export const extractTextFromScannedPdf = async (pdfPath) => {
  const document = await pdfToImages(pdfPath, { scale: 3 });
  let worker;
  const extractedPages = [];
  const pagesToProcess = Math.min(document.length || 0, MAX_OCR_PDF_PAGES);

  try {
    worker = await createOcrWorker();

    for (let pageNumber = 1; pageNumber <= pagesToProcess; pageNumber += 1) {
      try {
        const pageImage = await document.getPage(pageNumber);
        const pageText = await extractBestTextFromImage(worker, pageImage);

        if (pageText) {
          extractedPages.push(pageText);
        }
      } catch (_pageError) {
        continue;
      }
    }
  } finally {
    if (worker) {
      await worker.terminate();
    }

    try {
      await document.destroy();
    } catch (_destroyError) {
      // Ignore cleanup failures.
    }
  }

  return {
    text: extractedPages.join("\n\n--- Page Break ---\n\n"),
    pagesProcessed: pagesToProcess,
    truncated: (document.length || 0) > MAX_OCR_PDF_PAGES
  };
};