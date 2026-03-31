import { PDFParse } from "pdf-parse";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let parser: InstanceType<typeof PDFParse> | null = null;

  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { ok: false, error: "Missing PDF file in form field `file`." },
        { status: 400 }
      );
    }

    const blob = file as File;
    const type = blob.type || "";
    if (
      type &&
      type !== "application/pdf" &&
      !type.includes("pdf") &&
      type !== "application/octet-stream"
    ) {
      return NextResponse.json(
        { ok: false, error: `Expected a PDF file; got “${type}”.` },
        { status: 415 }
      );
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    if (buffer.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Empty file." },
        { status: 400 }
      );
    }

    parser = new PDFParse({ data: new Uint8Array(buffer) });
    const textResult = await parser.getText();
    const text = String(textResult.text ?? "").trim();
    const numPages =
      typeof textResult.total === "number" && textResult.total > 0
        ? textResult.total
        : null;

    await parser.destroy();
    parser = null;

    return NextResponse.json({
      ok: true,
      text,
      numPages,
      textLength: text.length,
    });
  } catch (e) {
    if (parser) {
      try {
        await parser.destroy();
      } catch {
        /* ignore */
      }
    }
    const message =
      e instanceof Error ? e.message : "PDF parsing failed unexpectedly.";
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}
