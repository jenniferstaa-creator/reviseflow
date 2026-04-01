import OpenAI from "openai";
import { NextResponse, type NextRequest } from "next/server";
import type { SubjectAggregateAnalysis } from "@/data/types";
import {
  buildDocumentDigests,
  formatSubjectContextBlock,
  mistakesDigestForPlanning,
} from "@/lib/planning-payload";

export const runtime = "nodejs";
export const maxDuration = 120;

const STAGE = "aggregate_subject" as const;

function logError(context: string, err: unknown, extra?: object) {
  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : "error";
  console.error("[reviseflow:aggregate-subject]", context, {
    stage: STAGE,
    ...extra,
    message,
    stack: err instanceof Error ? err.stack : undefined,
  });
}

function json(data: Record<string, unknown>, status = 200) {
  return NextResponse.json({ ...data, stage: STAGE }, { status });
}

type AiAggregateJson = {
  courseOverview: string;
  topConcepts: string[];
  repeatedThemes: string[];
  weakestAreas: string[];
  recommendedRevisionOrder: Array<{
    documentId: string;
    fileName: string;
    rationale: string;
  }>;
};

function isAiAggregateJson(
  data: unknown,
  validIds: Set<string>
): data is AiAggregateJson {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  if (typeof o.courseOverview !== "string") return false;
  if (
    !Array.isArray(o.topConcepts) ||
    !o.topConcepts.every((x) => typeof x === "string")
  ) {
    return false;
  }
  if (
    !Array.isArray(o.repeatedThemes) ||
    !o.repeatedThemes.every((x) => typeof x === "string")
  ) {
    return false;
  }
  if (
    !Array.isArray(o.weakestAreas) ||
    !o.weakestAreas.every((x) => typeof x === "string")
  ) {
    return false;
  }
  if (!Array.isArray(o.recommendedRevisionOrder)) return false;
  for (const row of o.recommendedRevisionOrder) {
    if (!row || typeof row !== "object") return false;
    const r = row as Record<string, unknown>;
    if (typeof r.documentId !== "string" || !validIds.has(r.documentId)) {
      return false;
    }
    if (typeof r.fileName !== "string" || typeof r.rationale !== "string") {
      return false;
    }
  }
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey?.trim()) {
      logError("config", "OPENAI_API_KEY missing");
      return json(
        {
          ok: false,
          error:
            "OPENAI_API_KEY is missing. Add it to .env.local and restart the dev server.",
        },
        503
      );
    }

    let body: {
      subjectName?: string;
      documents?: Parameters<typeof buildDocumentDigests>[0];
      mistakes?: Parameters<typeof mistakesDigestForPlanning>[0];
    };
    try {
      body = await req.json();
    } catch (e) {
      logError("request_json", e);
      return json({ ok: false, error: "Invalid JSON body." }, 400);
    }

    const subjectName =
      typeof body.subjectName === "string" && body.subjectName.trim()
        ? body.subjectName.trim()
        : "Subject";

    const docsIn = Array.isArray(body.documents) ? body.documents : [];
    const digests = buildDocumentDigests(docsIn);
    if (digests.length === 0) {
      return json(
        {
          ok: false,
          error:
            "No documents with summaries to aggregate. Finish analysis on at least one PDF first.",
        },
        400
      );
    }

    const mistakes = Array.isArray(body.mistakes) ? body.mistakes : [];
    const mistakeDigest = mistakesDigestForPlanning(mistakes);

    const validIds = new Set(digests.map((d) => d.documentId));
    const context = formatSubjectContextBlock({
      subjectName,
      documents: digests,
      mistakes: mistakeDigest,
      subjectAnalysis: null,
    });

    const system = `You are an expert study coach. You synthesise MULTIPLE course documents for ONE subject.
You receive ONLY structured JSON: per-document summaries (overview, key concepts, likely exam topics, confusing points), quiz concept tags, and logged mistakes.
You do NOT receive full PDF text. Never invent facts not supported by the supplied JSON—if something is thin, say so briefly.
Return ONLY one JSON object with keys:
- courseOverview: string (4–8 short paragraphs: unified narrative across documents for this subject)
- topConcepts: string[] (8–15 distinct, important ideas across all docs; prioritise cross-cutting ideas)
- repeatedThemes: string[] (4–10 themes or exam angles that show up in more than one document OR are clearly central)
- weakestAreas: string[] (6–12 areas to prioritise: align with mistakes and confusingPoints; deduplicate)
- recommendedRevisionOrder: array of { "documentId": string, "fileName": string, "rationale": string }
  Must include EVERY documentId from the input exactly once. Order from highest revision priority to lowest.

Document ids available: ${[...validIds].join(", ")}`;

    const userMessage = `SUBJECT: ${subjectName}\n\nDATA (JSON):\n${context}`;

    try {
      const client = new OpenAI({ apiKey });
      const completion = await client.chat.completions.create({
        model: process.env.OPENAI_PLAN_MODEL?.trim() || "gpt-4o-mini",
        temperature: 0.35,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMessage },
        ],
      });

      const raw = completion.choices[0]?.message?.content?.trim();
      if (!raw) {
        logError("model", "empty completion");
        return json({ ok: false, error: "Empty response from model." }, 502);
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw) as unknown;
      } catch (e) {
        logError("model", e, { snippet: raw.slice(0, 200) });
        return json({ ok: false, error: "Model did not return valid JSON." }, 502);
      }

      if (!isAiAggregateJson(parsed, validIds)) {
        logError("validation", "schema or documentId mismatch", {
          keys:
            parsed && typeof parsed === "object"
              ? Object.keys(parsed as object)
              : [],
        });
        return json(
          {
            ok: false,
            error: "Model JSON did not match the expected schema or document ids.",
          },
          502
        );
      }

      if (parsed.recommendedRevisionOrder.length !== validIds.size) {
        logError("validation", "revision order length", {
          expected: validIds.size,
          got: parsed.recommendedRevisionOrder.length,
        });
        return json(
          {
            ok: false,
            error: "recommendedRevisionOrder must list every document exactly once.",
          },
          502
        );
      }
      const coverage = new Set(
        parsed.recommendedRevisionOrder.map((r) => r.documentId)
      );
      if (coverage.size !== validIds.size) {
        logError("validation", "revision order duplicate or missing id", {
          expected: validIds.size,
          got: coverage.size,
        });
        return json(
          {
            ok: false,
            error: "recommendedRevisionOrder must list every document exactly once.",
          },
          502
        );
      }

      const analysis: SubjectAggregateAnalysis = {
        courseOverview: parsed.courseOverview.trim(),
        topConcepts: parsed.topConcepts.map((s) => s.trim()).filter(Boolean),
        repeatedThemes: parsed.repeatedThemes.map((s) => s.trim()).filter(Boolean),
        weakestAreas: parsed.weakestAreas.map((s) => s.trim()).filter(Boolean),
        recommendedRevisionOrder: parsed.recommendedRevisionOrder.map((r) => ({
          documentId: r.documentId,
          fileName: r.fileName.trim(),
          rationale: r.rationale.trim(),
        })),
        generatedAt: new Date().toISOString(),
      };

      if (!analysis.courseOverview || analysis.topConcepts.length === 0) {
        return json(
          { ok: false, error: "Model returned an unusable aggregate." },
          502
        );
      }

      return json({ ok: true, analysis });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "OpenAI request failed unexpectedly.";
      logError("openai", e);
      return json({ ok: false, error: message }, 502);
    }
  } catch (e) {
    const message =
      e instanceof Error ? e.message : String(e ?? "unknown error");
    logError("fatal", e);
    return json({ ok: false, error: `Aggregate route failed: ${message}` }, 500);
  }
}
