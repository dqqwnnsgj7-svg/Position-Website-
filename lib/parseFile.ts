export async function parsePdf(buffer: Buffer): Promise<{ text: string; numPages: number }> {
  const pdfParse = (await import('pdf-parse')).default;
  const data = await pdfParse(buffer);
  return { text: data.text, numPages: data.numpages };
}

export async function parseFile(buffer: Buffer, mimeType: string, fileName: string): Promise<string> {
  const ext = fileName.toLowerCase().split('.').pop() || '';

  if (ext === 'pdf' || mimeType === 'application/pdf') {
    const { text } = await parsePdf(buffer);
    return text;
  }

  if (
    ext === 'docx' ||
    ext === 'doc' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword'
  ) {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff'].includes(ext)) {
    return `[Image file: ${fileName}. The resume was submitted as an image. Please review it directly.]`;
  }

  // For text-based files (txt, md, rtf, csv, json, etc.) try to read as UTF-8
  try {
    const text = buffer.toString('utf-8');
    if (text && text.trim().length > 20) return text;
  } catch {
    // fall through
  }

  // Last resort: attempt to extract printable ASCII characters
  const printable = buffer.toString('binary').replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s{3,}/g, '\n');
  if (printable.trim().length > 50) return printable;

  throw new Error(`Could not extract text from ${fileName}. Try uploading as PDF or Word document.`);
}
