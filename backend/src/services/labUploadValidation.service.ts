import sharp from "sharp";

const MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

const positiveInteger = (name: string, fallback: number) => {
  const value = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const isHeic = (buffer: Buffer, mimeType?: string) => {
  if (mimeType === "image/heic" || mimeType === "image/heif") return true;
  if (buffer.length >= 12) {
    const ftyp = buffer.subarray(4, 12).toString("ascii");
    if (ftyp.includes("ftyp") && (ftyp.includes("heic") || ftyp.includes("heif") || ftyp.includes("mif1") || ftyp.includes("msf1"))) {
      return true;
    }
  }
  return false;
};

const isEncryptedPdf = (buffer: Buffer) => {
  const sample = buffer.toString("latin1", 0, Math.min(buffer.length, 10000));
  return sample.includes("/Encrypt");
};

const hasSignature = (buffer: Buffer, mimeType: string) => {
  if (mimeType === "image/jpeg") return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === "image/webp") return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  if (mimeType === "application/pdf") return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  return false;
};

const decodeBase64 = (data: unknown) => {
  if (typeof data !== "string" || data.length === 0 || data.length % 4 !== 0) {
    throw new Error("LAB_UPLOAD_MALFORMED_BASE64");
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
    throw new Error("LAB_UPLOAD_MALFORMED_BASE64");
  }
  return Buffer.from(data, "base64");
};

export async function validateLabUpload(contents: unknown): Promise<void> {
  if (!Array.isArray(contents)) throw new Error("LAB_UPLOAD_MISSING_CONTENTS");
  const inlineParts = contents.flatMap((entry: any) =>
    Array.isArray(entry?.parts) ? entry.parts.filter((part: any) => part?.inlineData) : []
  );
  if (inlineParts.length !== 1) throw new Error("LAB_UPLOAD_REQUIRES_ONE_FILE");
  const { mimeType, data } = inlineParts[0].inlineData;

  if (typeof mimeType !== "string") {
    throw new Error("LAB_UPLOAD_UNSUPPORTED_MIME_TYPE");
  }

  const buffer = decodeBase64(data);

  if (buffer.length === 0) {
    throw new Error("LAB_UPLOAD_EMPTY_FILE");
  }

  if (isHeic(buffer, mimeType)) {
    throw new Error("LAB_UPLOAD_HEIC_UNSUPPORTED");
  }

  if (!MIME_TYPES.has(mimeType)) {
    throw new Error("LAB_UPLOAD_UNSUPPORTED_MIME_TYPE");
  }

  if (buffer.length > positiveInteger("LAB_REPORT_MAX_BYTES", 10 * 1024 * 1024)) {
    throw new Error("LAB_UPLOAD_SIZE_LIMIT_EXCEEDED");
  }

  if (!hasSignature(buffer, mimeType)) {
    throw new Error("LAB_UPLOAD_MIME_SIGNATURE_MISMATCH");
  }

  if (mimeType === "application/pdf" && isEncryptedPdf(buffer)) {
    throw new Error("LAB_UPLOAD_PDF_UNREADABLE");
  }

  if (mimeType.startsWith("image/")) {
    let metadata;
    try {
      metadata = await sharp(buffer, { limitInputPixels: false }).metadata();
    } catch {
      throw new Error("LAB_UPLOAD_INVALID_IMAGE");
    }
    const maxWidth = positiveInteger("LAB_REPORT_MAX_WIDTH", 12000);
    const maxHeight = positiveInteger("LAB_REPORT_MAX_HEIGHT", 12000);
    if (!metadata.width || !metadata.height || metadata.width > maxWidth || metadata.height > maxHeight) {
      throw new Error("LAB_UPLOAD_DIMENSIONS_EXCEEDED");
    }
  }
}
