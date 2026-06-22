import { NextRequest, NextResponse } from "next/server";
import { isPlainObject } from "@/lib/isObject";
import { contentDispositionAttachment } from "@/server/anki";
import { localJson } from "@/server/localRuntime";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_INPUT_BYTES = 5 * 1024 * 1024; // 5MB
const PUBLIC_APKG_ERROR =
  "Não foi possível gerar o deck agora. Tente novamente em instantes.";

function parseBool(v: string | null): boolean {
  if (!v) return false;
  return v === "1" || v.toLowerCase() === "true" || v.toLowerCase() === "yes";
}

function safeDelimiter(raw: string | null): string {
  const d = (raw ?? ",").slice(0, 1);
  return d.length === 1 ? d : ",";
}

function parseNoHeaderValue(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return parseBool(v);
  return false;
}

function safeTrimmedString(v: unknown, fallback: string, maxLen = 200): string {
  const s =
    typeof v === "string"
      ? v
      : v === null || v === undefined
        ? ""
        : String(v);
  const trimmed = s.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLen);
}

function safeFloat(
  v: unknown,
  fallback: number,
  opts: { min: number; max: number },
): number {
  const n =
    typeof v === "number"
      ? v
      : typeof v === "string"
        ? Number(v)
        : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(opts.max, Math.max(opts.min, n));
}

function isProbablyJsonUpload(file: File, head: Buffer): boolean {
  const name = (file.name ?? "").toLowerCase();
  const type = (file.type ?? "").toLowerCase();
  if (type.includes("json")) return true;
  if (name.endsWith(".json")) return true;

  const sniff = head.toString("utf8").trimStart();
  return sniff.startsWith("{") || sniff.startsWith("[");
}

function csvEscapeCell(value: string, delimiter: string): string {
  const needsQuotes =
    value.includes(delimiter) ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r");
  if (!needsQuotes) return value;
  return `"${value.replaceAll('"', '""')}"`;
}

function toCellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

function jsonToCsvBytesFromParsed(
  parsed: unknown,
  opts: { delimiter: string; noHeader: boolean; ptCol: string; enCol: string },
): Buffer {
  const cards: unknown = Array.isArray(parsed)
    ? parsed
    : isPlainObject(parsed)
      ? parsed.cards
      : null;
  if (!Array.isArray(cards)) {
    throw new Error(
      'JSON inválido: esperado um array (ex: [{"pt":"...","en":"..."}]) ou um objeto com a chave "cards".',
    );
  }

  const hasHeader = !opts.noHeader;
  const ptIdx =
    opts.noHeader && /^\d+$/.test(opts.ptCol) ? Number(opts.ptCol) : null;
  const enIdx =
    opts.noHeader && /^\d+$/.test(opts.enCol) ? Number(opts.enCol) : null;
  const ptKey = hasHeader ? opts.ptCol : null;
  const enKey = hasHeader ? opts.enCol : null;

  const lines: string[] = [];
  if (hasHeader) {
    lines.push(
      [opts.ptCol, opts.enCol]
        .map((c) => csvEscapeCell(String(c ?? ""), opts.delimiter))
        .join(opts.delimiter),
    );
  }

  for (const card of cards) {
    let pt = "";
    let en = "";

    if (Array.isArray(card)) {
      const p = ptIdx ?? 0;
      const e = enIdx ?? 1;
      pt = toCellText(card[p]);
      en = toCellText(card[e]);
    } else if (isPlainObject(card)) {
      if (!hasHeader) {
        throw new Error(
          'JSON inválido: quando usar --noHeader com JSON, cada card precisa ser um array (ex: ["pt", "en"]).',
        );
      }
      pt = toCellText(card[ptKey as string]);
      en = toCellText(card[enKey as string]);
    } else {
      throw new Error(
        "JSON inválido: cada item deve ser um objeto (ex: {pt,en}) ou um array (ex: [pt,en]).",
      );
    }

    lines.push(
      [pt, en]
        .map((c) => csvEscapeCell(String(c ?? ""), opts.delimiter))
        .join(opts.delimiter),
    );
  }

  return Buffer.from(lines.join("\n"), "utf8");
}

function jsonToCsvBytes(opts: {
  jsonText: string;
  delimiter: string;
  noHeader: boolean;
  ptCol: string;
  enCol: string;
}): Buffer {
  const parsed: unknown = JSON.parse(opts.jsonText);
  return jsonToCsvBytesFromParsed(parsed, {
    delimiter: opts.delimiter,
    noHeader: opts.noHeader,
    ptCol: opts.ptCol,
    enCol: opts.enCol,
  });
}

export async function POST(req: NextRequest) {
  try {
    const contentType = (req.headers.get("content-type") ?? "").toLowerCase();
    const contentLength = Number(req.headers.get("content-length") ?? "0") || 0;
    if (contentLength > MAX_INPUT_BYTES) {
      return NextResponse.json(
        { error: "Arquivo muito grande (máx 5MB)." },
        { status: 413 },
      );
    }

    let deck = "English - new method";
    let ptCol = "pt";
    let enCol = "en";
    let delimiter = ",";
    let noHeader = false;
    let enKokoroVoice = "af_heart";
    let enKokoroSpeed = 1.15;
    let enKokoroLang: string | null = null;
    let csvBytes: Buffer;

    if (contentType.includes("application/json")) {
      const body = (await req.json()) as unknown;
      const obj = isPlainObject(body) ? body : null;

      deck = safeTrimmedString(obj?.deck, deck, 200);
      ptCol = safeTrimmedString(obj?.ptCol, ptCol, 64);
      enCol = safeTrimmedString(obj?.enCol, enCol, 64);
      delimiter = safeDelimiter(String(obj?.delimiter ?? delimiter));
      noHeader = parseNoHeaderValue(obj?.noHeader ?? noHeader);
      enKokoroVoice = safeTrimmedString(obj?.enKokoroVoice, enKokoroVoice, 64);
      enKokoroSpeed = safeFloat(obj?.enKokoroSpeed, enKokoroSpeed, {
        min: 0.25,
        max: 3.0,
      });
      enKokoroLang = obj?.enKokoroLang
        ? safeTrimmedString(obj?.enKokoroLang, "", 16) || null
        : null;

      try {
        csvBytes = jsonToCsvBytesFromParsed(body, {
          delimiter,
          noHeader,
          ptCol,
          enCol,
        });
      } catch (e: unknown) {
        const msg =
          e instanceof Error
            ? e.message
            : "JSON inválido. Envie um array de cards ou um objeto com { cards: [...] }.";
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    } else {
      const formData = await req.formData();

      deck = safeTrimmedString(formData.get("deck"), deck, 200);
      ptCol = safeTrimmedString(formData.get("ptCol"), ptCol, 64);
      enCol = safeTrimmedString(formData.get("enCol"), enCol, 64);
      delimiter = safeDelimiter(String(formData.get("delimiter") ?? delimiter));
      noHeader = parseBool(String(formData.get("noHeader") ?? "0"));
      enKokoroVoice = safeTrimmedString(
        formData.get("enKokoroVoice"),
        enKokoroVoice,
        64,
      );
      enKokoroSpeed = safeFloat(formData.get("enKokoroSpeed"), enKokoroSpeed, {
        min: 0.25,
        max: 3.0,
      });
      enKokoroLang = formData.get("enKokoroLang")
        ? safeTrimmedString(formData.get("enKokoroLang"), "", 16) || null
        : null;

      const f = formData.get("file");
      const jsonText = formData.get("json");
      const text = formData.get("text");

      if (f instanceof File) {
        if (f.size > MAX_INPUT_BYTES) {
          return NextResponse.json(
            { error: "Arquivo muito grande (máx 5MB)." },
            { status: 413 },
          );
        }
        const uploadedBytes = Buffer.from(await f.arrayBuffer());
        const head = uploadedBytes.subarray(0, Math.min(uploadedBytes.length, 2048));
        if (isProbablyJsonUpload(f, head)) {
          try {
            csvBytes = jsonToCsvBytes({
              jsonText: uploadedBytes.toString("utf8"),
              delimiter,
              noHeader,
              ptCol,
              enCol,
            });
          } catch (e: unknown) {
            const msg =
              e instanceof Error
                ? e.message
                : "JSON inválido. Envie um array de cards ou um objeto com { cards: [...] }.";
            return NextResponse.json({ error: msg }, { status: 400 });
          }
        } else {
          csvBytes = uploadedBytes;
        }
      } else if (typeof jsonText === "string" || typeof text === "string") {
        const raw = String(jsonText ?? text ?? "");
        if (Buffer.byteLength(raw, "utf8") > MAX_INPUT_BYTES) {
          return NextResponse.json(
            { error: "Arquivo muito grande (máx 5MB)." },
            { status: 413 },
          );
        }
        try {
          csvBytes = jsonToCsvBytes({
            jsonText: raw,
            delimiter,
            noHeader,
            ptCol,
            enCol,
          });
        } catch (e: unknown) {
          const msg =
            e instanceof Error
              ? e.message
              : "JSON inválido. Envie um array de cards ou um objeto com { cards: [...] }.";
          return NextResponse.json({ error: msg }, { status: 400 });
        }
      } else {
        return NextResponse.json(
          {
            error:
              'Envie "file" (CSV/JSON) ou "json"/"text" (JSON em texto) no multipart/form-data.',
          },
          { status: 400 },
        );
      }
    }

    const exported = await localJson("/anki/apkg", {
      csvBase64: csvBytes.toString("base64"), deck, ptCol, enCol, delimiter,
      noHeader, voice: enKokoroVoice, speed: enKokoroSpeed, lang: enKokoroLang,
    }, 300_000);
    if (exported.status < 200 || exported.status >= 300) {
      console.error("Anki runtime failed:", exported.status, exported.body.toString("utf8"));
      return NextResponse.json({ error: PUBLIC_APKG_ERROR }, { status: 500 });
    }

    const apkg = exported.body;
    const filenameUtf8 = `${deck.trim() || "anki-deck"}.apkg`;
    const disposition = contentDispositionAttachment(filenameUtf8);

    return new NextResponse(new Uint8Array(apkg), {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": disposition,
        "Content-Length": apkg.byteLength.toString(),
      },
    });
  } catch (err: unknown) {
    console.error("Anki export error:", err);
    return NextResponse.json({ error: PUBLIC_APKG_ERROR }, { status: 500 });
  }
}
