/**
 * Mock course content for ReviseFlow demos.
 *
 * TODO(PDF): Replace static blobs with extracted text from uploaded PDFs (e.g. server action
 *   calling pdf-parse / unpdf, or a document pipeline). Pass slices to the AI summarizer.
 * TODO(OpenAI): Generate summary + quiz from extracted text via structured output (zod/json schema)
 *   or tool calls; cache per document hash + user id.
 * TODO(DB): Persist Document, GeneratedSummary, QuizSet, Attempt, Mistake, StudyPlan rows;
 *   hydrate this module's shape from the API instead of importing constants.
 */

import type {
  CourseSummary,
  ErrorType,
  MistakeRecord,
  QuizContent,
} from "./types";
import {
  formatPlanDayLabel,
  parseLocalDateOnly,
  toLocalDateKey,
} from "@/lib/dates";

export const COURSE_TITLE =
  "Operations & Supply Chain Management (Undergraduate)";

export const MOCK_SUMMARY: CourseSummary = {
  courseTitle: COURSE_TITLE,
  chapterOverview:
    "This module connects forecasting error, order amplification, inventory policy, and process choices across a supply chain. Emphasis is on why local rational decisions create global instability (bullwhip), how lean and agile approaches trade off efficiency and responsiveness, and how safety stock and lead times buffer uncertainty.",
  keyConcepts: [
    "Bullwhip effect: small demand swings upstream become large order swings due to delays, batching, and forecasting updates.",
    "Lean vs agile: lean stresses waste removal and flow; agile stresses speed and flexibility to volatile demand—hybrids are common.",
    "Safety stock and service level: extra inventory offsets demand or lead time variability; higher service targets cost more inventory.",
    "Information distortion: lacking shared demand visibility encourages each echelon to over-react.",
    "Coordination mechanisms: CPFR-style collaboration, VMI, and transparent POS data dampen oscillations.",
  ],
  likelyExamTopics: [
    "Diagram or explain the bullwhip effect with at least three concrete causes.",
    "Compare lean and agile supply chains with examples; discuss when each fits.",
    "Calculate or reason about safety stock given lead time and demand variability (conceptual).",
    "Recommend coordination improvements after reading a short case narrative.",
  ],
  confusingPoints: [
    {
      title: "Bullwhip vs normal seasonality",
      note: "Seasonality is a real demand pattern; bullwhip is amplified ordering that exceeds true end-customer variability because of information delays and local policies.",
    },
    {
      title: "Agile does not mean chaotic",
      note: "Agile supply chains still rely on disciplined planning—they prioritize responsiveness and buffer strategic capacity rather than maximizing every local efficiency metric.",
    },
  ],
  simplifiedExplanations: [
    {
      term: "Bullwhip effect",
      explanation:
        "Picture cracking a whip: a small wrist motion creates a large snap at the tip. Downstream demand looks modest, but orders upstream swing wildly because each stage adds safety stock, batches orders, and mis-interprets signals.",
    },
    {
      term: "Lean vs agile",
      explanation:
        "Lean is about smooth, low-waste flow when demand is fairly predictable. Agile accepts extra cost (capacity, inventory, dual sourcing) to react quickly when demand is volatile or product life cycles are short.",
    },
    {
      term: "Safety stock",
      explanation:
        "Extra units held so you still meet customer demand when actual usage or supplier lead times overshoot what you planned—like leaving early for the airport when traffic is uncertain.",
    },
  ],
};

export const MOCK_QUIZ: QuizContent = {
  multipleChoice: [
    {
      id: "mcq-1",
      type: "mcq",
      question:
        "What is the bullwhip effect best described as?",
      options: [
        "A seasonal spike in retail demand every December",
        "Order variability increasing upstream along the supply chain beyond end-customer demand variability",
        "A pricing strategy that undercuts competitors",
        "A legal compliance issue in international trade",
      ],
      correctAnswer:
        "Order variability increasing upstream along the supply chain beyond end-customer demand variability",
      explanation:
        "The bullwhip effect is specifically about demand signal distortion and local policies causing shipments/orders to oscillate more than true consumer demand.",
      conceptTag: "Bullwhip effect",
    },
    {
      id: "mcq-2",
      type: "mcq",
      question:
        "Which pairing best contrasts lean and agile supply chain strategy?",
      options: [
        "Lean: responsiveness first; Agile: cost minimization first",
        "Lean: efficiency and flow; Agile: speed and flexibility to demand changes",
        "Lean: high safety stock everywhere; Agile: eliminate all inventory",
        "Lean and agile are identical in postgraduate textbooks",
      ],
      correctAnswer: "Lean: efficiency and flow; Agile: speed and flexibility to demand changes",
      explanation:
        "Lean emphasizes waste removal and smooth flow; agile emphasizes adaptability—often with higher buffers where volatility warrants it.",
      conceptTag: "Lean vs agile",
    },
    {
      id: "mcq-3",
      type: "mcq",
      question:
        "Increasing safety stock primarily addresses which problem?",
      options: [
        "Brand awareness",
        "Uncertainty in demand and/or lead time relative to a service target",
        "Corporate tax optimization",
        "Supplier union negotiations",
      ],
      correctAnswer:
        "Uncertainty in demand and/or lead time relative to a service target",
      explanation:
        "Safety stock buffers variability so you can still hit a desired service level despite unpredictable demand or late deliveries.",
      conceptTag: "Safety stock",
    },
    {
      id: "mcq-4",
      type: "mcq",
      question:
        "Which practice most directly reduces information distortion in a multi-echelon chain?",
      options: [
        "Each warehouse using only its own shipments to forecast, ignoring downstream POS",
        "Sharing point-of-sale or end-demand data across partners (visibility)",
        "Doubling promotional discounts every quarter",
        "Increasing minimum order quantities without coordination",
      ],
      correctAnswer:
        "Sharing point-of-sale or end-demand data across partners (visibility)",
      explanation:
        "End-demand visibility helps upstream stages react to true consumption rather than distorted order patterns.",
      conceptTag: "Coordination",
    },
  ],
  shortAnswer: [
    {
      id: "sa-1",
      type: "short",
      question:
        "Name two operational causes of the bullwhip effect and explain each in one sentence.",
      correctAnswer:
        "Examples: (1) Order batching—infrequent large orders create lumpiness upstream. (2) Forecast updating—each echelon over-corrects to local signals, amplifying noise. (Rationing panic or price promotions also acceptable.)",
      explanation:
        "Markers look for distinct mechanisms tied to delays, policies, or incentives—not just vague 'miscommunication.'",
      conceptTag: "Bullwhip effect",
    },
    {
      id: "sa-2",
      type: "short",
      question:
        "When would you lean toward an agile rather than a lean supply chain for a product family?",
      correctAnswer:
        "High demand volatility, short life cycles, fashion/tech risk, or critical time window where stockouts are very costly—agile accepts buffers or flexible capacity; lean fits steadier demand.",
      explanation:
        "The key is matching process choice to uncertainty and competitive priority, not labeling everything 'lean.'",
      conceptTag: "Lean vs agile",
    },
  ],
};

/** Sample mistakes for optional demo seeding (partial notebook state). */
export const SAMPLE_MISTAKES: MistakeRecord[] = [
  {
    id: "mist-sample-1",
    documentId: "sample-doc",
    questionId: "mcq-1",
    question: "What is the bullwhip effect best described as?",
    userAnswer: "A seasonal spike in retail demand every December",
    correctAnswer:
      "Order variability increasing upstream along the supply chain beyond end-customer demand variability",
    explanation: MOCK_QUIZ.multipleChoice[0].explanation,
    conceptTag: "Bullwhip effect",
    errorType: "Concept misunderstanding",
    createdAt: "2026-03-29T12:00:00.000Z",
  },
  {
    id: "mist-sample-2",
    documentId: "sample-doc",
    questionId: "mcq-3",
    question: "Increasing safety stock primarily addresses which problem?",
    userAnswer: "Brand awareness",
    correctAnswer:
      "Uncertainty in demand and/or lead time relative to a service target",
    explanation: MOCK_QUIZ.multipleChoice[2].explanation,
    conceptTag: "Safety stock",
    errorType: "Careless mistake",
    createdAt: "2026-03-30T12:00:00.000Z",
  },
];

export const MOCK_MASTERED_TOPICS = [
  "Order batching vs lot sizing",
  "Basic EOQ intuition",
  "Process mapping",
];

export const MOCK_WEAK_TOPICS = [
  "Bullwhip effect",
  "Lean vs agile",
  "Safety stock",
];

const PLAN_TASK_ROTATIONS = [
  [
    "Skim summary cards for bullwhip + lean/agile",
    "Work 8 mixed MCQs under timed conditions",
    "Write a 5-bullet answer comparing lean vs agile for two product examples",
  ],
  [
    "Redo missed quiz items without peeking",
    "Draw a simple three-echelon chain; label where distortion grows",
    "Read confusing points section aloud; paraphrase in your own words",
  ],
  [
    "Short-answer drills: two causes of bullwhip",
    "Map exam topics to your lecture slide numbers",
    "10-minute mistake notebook review",
  ],
];

export function buildMockDailyPlan(
  examDateIso: string,
  hoursPerDay: number
): import("./types").DailyPlanDay[] {
  const endDay = parseLocalDateOnly(examDateIso);
  endDay.setHours(0, 0, 0, 0);
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  const days: import("./types").DailyPlanDay[] = [];
  let i = 0;
  while (cursor.getTime() <= endDay.getTime() && days.length < 28) {
    const iso = toLocalDateKey(cursor);
    const label = formatPlanDayLabel(cursor);
    const tasks = PLAN_TASK_ROTATIONS[i % PLAN_TASK_ROTATIONS.length];
    const focusConcepts =
      i % 3 === 0
        ? ["Bullwhip effect", "Coordination"]
        : i % 3 === 1
          ? ["Lean vs agile", "Safety stock"]
          : ["Exam topics synthesis"];
    days.push({
      date: iso,
      label,
      tasks,
      focusConcepts,
      minutesBudget: Math.round(hoursPerDay * 60),
      completed: false,
    });
    cursor.setDate(cursor.getDate() + 1);
    i += 1;
  }
  return days;
}

/** Map wrong MCQ index vs correct to a static error type for the demo (replace with model output later). */
export function guessErrorType(
  userAnswer: string,
  correctAnswer: string,
  conceptTag: string
): ErrorType {
  if (userAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase()) {
    return "Careless mistake";
  }
  if (userAnswer.length < 4) return "Memory weakness";
  if (conceptTag.includes("Bullwhip") || conceptTag.includes("Safety")) {
    return "Concept misunderstanding";
  }
  return "Application issue";
}
