import fs from "fs/promises";
import path from "path";
import pdfParse from "pdf-parse";
import { pathToFileURL } from "url";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractTextFromScannedPdf } from "./ocrService.js";

const MIN_EMBEDDED_TEXT_LENGTH = 50;

const extractTextWithPdfJs = async (fileBuffer) => {
  const standardFontDir = path.resolve(process.cwd(), "node_modules/pdfjs-dist/standard_fonts");
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(fileBuffer),
    disableWorker: true,
    standardFontDataUrl: pathToFileURL(`${standardFontDir}${path.sep}`).href,
    useSystemFonts: true
  });

  const pdfDocument = await loadingTask.promise;
  const extractedPages = [];

  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
    const page = await pdfDocument.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(" ").trim();

    if (pageText) {
      extractedPages.push(pageText);
    }
  }

  return extractedPages.join("\n\n");
};

export const parseUploadedFile = async (filePath, originalName) => {
  const lowerName = originalName.toLowerCase();

  if (lowerName.endsWith(".txt")) {
    const text = await fs.readFile(filePath, "utf8");
    return { text, method: "embedded" };
  }

  if (lowerName.endsWith(".pdf")) {
    const fileBuffer = await fs.readFile(filePath);
    let embeddedText = "";

    try {
      const parsed = await pdfParse(fileBuffer);
      embeddedText = (parsed.text || "").trim();
    } catch (_error) {
      embeddedText = "";
    }

    if (embeddedText.length >= MIN_EMBEDDED_TEXT_LENGTH) {
      return { text: embeddedText, method: "embedded" };
    }

    try {
      const pdfJsText = (await extractTextWithPdfJs(fileBuffer)).trim();

      if (pdfJsText.length >= MIN_EMBEDDED_TEXT_LENGTH) {
        return { text: pdfJsText, method: "embedded" };
      }
    } catch (_error) {
      // Fall through to OCR for scanned PDFs when embedded text extraction fails.
    }

    const scannedResult = await extractTextFromScannedPdf(filePath);
    return { text: scannedResult.text || "", method: "ocr", ocrMeta: scannedResult };
  }

  throw new Error("Unsupported file type");
};
