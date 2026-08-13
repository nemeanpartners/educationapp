import { geminiChat, geminiGenerateContent } from "./geminiProxy";
import { getOrCreateCachedAiResult } from "../lib/ai-result-cache";
import { getCachedMathSolverResult, saveMathSolverResult } from "../lib/math-solver-storage";

const FLASH_MODEL = "gemini-3-flash-preview";
const PRO_MODEL = "gemini-3.1-pro-preview";

export type MathSolverStep = {
  title: string;
  work: string;
  explanation: string;
  check: string;
};

export type MathSolverResponse = {
  problemType: string;
  normalizedProblem: string;
  exactAnswer: string;
  decimalAnswer?: string;
  assumptions: string[];
  steps: MathSolverStep[];
  verification: string;
  followUpQuestions: string[];
};

export type FormulaVariable = {
  symbol: string;
  meaning: string;
  units: string;
};

export type FormulaExplanation = {
  title: string;
  normalizedFormula: string;
  subject: string;
  topic: string;
  whatItIs: string;
  variables: FormulaVariable[];
  whyItIsUsed: string;
  questionClues: string[];
  howToUseIt: string[];
  workedExample: string;
  commonMistakes: string[];
};

export type PracticeQuizQuestion = {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
};

export type LectureLiftFlashcard = {
  term: string;
  definition: string;
};

export type LectureLiftExamFlag = {
  topic: string;
  whyItMatters: string;
  suggestedQuestion: string;
};

export type LectureLiftResponse = {
  title: string;
  enhancedNotes: string;
  summaryBullets: string[];
  flashcards: LectureLiftFlashcard[];
  keywords: string[];
  examFlags: LectureLiftExamFlag[];
  suggestedQuestions: string[];
};

export type MeetingNotesActionItem = {
  task: string;
  owner: string;
  deadline: string;
};

export type MeetingNotesEnhancement = {
  executiveSummary: string;
  structuredNotes: string;
  keyTakeaways: string[];
  decisions: string[];
  actionItems: MeetingNotesActionItem[];
  blockers: string[];
  followUpEmail: string;
};

function parseJsonText<T>(rawText: string, context: string): T {
  const text = rawText.trim();
  if (!text) {
    throw new Error(`${context} returned an empty response.`);
  }

  const normalized = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const candidates = [normalized];
  const objectStart = normalized.indexOf("{");
  const objectEnd = normalized.lastIndexOf("}");
  if (objectStart !== -1 && objectEnd !== -1 && objectEnd > objectStart) {
    candidates.push(normalized.slice(objectStart, objectEnd + 1));
  }

  const arrayStart = normalized.indexOf("[");
  const arrayEnd = normalized.lastIndexOf("]");
  if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
    candidates.push(normalized.slice(arrayStart, arrayEnd + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      continue;
    }
  }

  throw new Error(`${context} returned unreadable JSON.`);
}

function normalizeLectureLiftResponse(parsed: Partial<LectureLiftResponse>): LectureLiftResponse {
  return {
    title: String(parsed.title || "Enhanced Notes"),
    enhancedNotes: String(parsed.enhancedNotes || ""),
    summaryBullets: Array.isArray(parsed.summaryBullets) ? parsed.summaryBullets.map((item) => String(item)).filter(Boolean) : [],
    flashcards: Array.isArray(parsed.flashcards)
      ? parsed.flashcards
          .map((card) => ({
            term: String(card?.term || "").trim(),
            definition: String(card?.definition || "").trim(),
          }))
          .filter((card) => card.term && card.definition)
      : [],
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map((item) => String(item)).filter(Boolean) : [],
    examFlags: Array.isArray(parsed.examFlags)
      ? parsed.examFlags
          .map((flag) => ({
            topic: String(flag?.topic || "").trim(),
            whyItMatters: String(flag?.whyItMatters || "").trim(),
            suggestedQuestion: String(flag?.suggestedQuestion || "").trim(),
          }))
          .filter((flag) => flag.topic && flag.whyItMatters && flag.suggestedQuestion)
      : [],
    suggestedQuestions: Array.isArray(parsed.suggestedQuestions) ? parsed.suggestedQuestions.map((item) => String(item)).filter(Boolean) : [],
  };
}

function clampPromptText(value: string, maxChars: number) {
  const trimmed = value.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars)}\n\n[Truncated for processing]`;
}

function normalizeMeetingNotesEnhancement(parsed: Partial<MeetingNotesEnhancement>): MeetingNotesEnhancement {
  return {
    executiveSummary: String(parsed.executiveSummary || "").trim(),
    structuredNotes: String(parsed.structuredNotes || "").trim(),
    keyTakeaways: Array.isArray(parsed.keyTakeaways) ? parsed.keyTakeaways.map((item) => String(item).trim()).filter(Boolean) : [],
    decisions: Array.isArray(parsed.decisions) ? parsed.decisions.map((item) => String(item).trim()).filter(Boolean) : [],
    actionItems: Array.isArray(parsed.actionItems)
      ? parsed.actionItems
          .map((item) => ({
            task: String(item?.task || "").trim(),
            owner: String(item?.owner || "").trim(),
            deadline: String(item?.deadline || "").trim(),
          }))
          .filter((item) => item.task)
      : [],
    blockers: Array.isArray(parsed.blockers) ? parsed.blockers.map((item) => String(item).trim()).filter(Boolean) : [],
    followUpEmail: String(parsed.followUpEmail || "").trim(),
  };
}

const LECTURE_LIFT_STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "because", "by", "for", "from", "had", "has", "have",
  "he", "her", "his", "i", "in", "into", "is", "it", "its", "of", "on", "or", "our", "she", "that",
  "the", "their", "them", "there", "they", "this", "to", "was", "we", "were", "what", "when", "which",
  "who", "will", "with", "you", "your", "also", "than", "then", "about", "after", "before", "during",
  "over", "under", "between", "through", "real", "life"
]);

function tokenizeLectureLiftText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !LECTURE_LIFT_STOPWORDS.has(token));
}

function splitLectureLines(value: string) {
  return value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitLectureSentences(value: string) {
  return value
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 24);
}

function scoreSentenceForTokens(sentence: string, tokens: string[]) {
  if (!tokens.length) return 0;
  const lowered = sentence.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (lowered.includes(token)) score += token.length > 5 ? 2 : 1;
  }
  return score;
}

function extractTopKeywords(text: string, limit: number) {
  const counts = new Map<string, number>();
  for (const token of tokenizeLectureLiftText(text)) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([token]) => token);
}

function buildLocalLectureLift(params: {
  pageTitle: string;
  shorthandNotes: string;
  transcript: string;
}): LectureLiftResponse {
  const noteLines = splitLectureLines(params.shorthandNotes);
  const transcriptSentences = splitLectureSentences(params.transcript);
  const enhancedSections = noteLines.length
    ? noteLines.map((line) => {
        const tokens = tokenizeLectureLiftText(line);
        const supportingSentences = transcriptSentences
          .map((sentence) => ({ sentence, score: scoreSentenceForTokens(sentence, tokens) }))
          .filter((item) => item.score > 0)
          .sort((a, b) => b.score - a.score || a.sentence.length - b.sentence.length)
          .slice(0, 2)
          .map((item) => item.sentence);

        const uniqueSupport = [...new Set(supportingSentences)];
        return uniqueSupport.length
          ? `${line}\nContext: ${uniqueSupport.join(" ")}`
          : line;
      })
    : transcriptSentences.slice(0, 6);

  const summaryBullets = enhancedSections
    .slice(0, 5)
    .map((section) => section.split("\n")[0].replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);

  const flashcards = noteLines
    .flatMap((line) => {
      const match = line.match(/^([^:.-]{3,40})\s*[:.-]\s*(.+)$/);
      if (match) {
        return [{ term: match[1].trim(), definition: match[2].trim() }];
      }
      const tokens = tokenizeLectureLiftText(line).slice(0, 3);
      if (!tokens.length) return [];
      const support = transcriptSentences.find((sentence) => scoreSentenceForTokens(sentence, tokens) > 0);
      return support ? [{ term: tokens.join(" "), definition: support }] : [];
    })
    .filter((card, index, list) => list.findIndex((item) => item.term === card.term) === index)
    .slice(0, 8);

  const examSignals = /(exam|test|assessment|important|remember|essay|quote|revision|will be on)/i;
  const examFlags = transcriptSentences
    .filter((sentence) => examSignals.test(sentence))
    .slice(0, 4)
    .map((sentence) => {
      const topic = extractTopKeywords(sentence, 2).join(" ") || "Key point";
      return {
        topic,
        whyItMatters: sentence,
        suggestedQuestion: `Explain ${topic} using evidence or examples from the lecture.`,
      };
    });

  const keywords = extractTopKeywords(`${params.shorthandNotes}\n${params.transcript}`, 6);
  const suggestedQuestions = keywords.slice(0, 4).map((keyword) => `How does ${keyword} connect to the main lecture ideas?`);

  return {
    title: `${params.pageTitle || "Lecture Notes"} Enhanced`,
    enhancedNotes: enhancedSections.join("\n\n"),
    summaryBullets,
    flashcards,
    keywords,
    examFlags,
    suggestedQuestions,
  };
}

function dataUrlToInlineData(fileDataUrl: string) {
  const match = fileDataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid uploaded file format.");
  }

  return {
    mimeType: match[1],
    data: match[2],
  };
}

export const geminiService = {
  // General Chat
  async chat(message: string, history: any[] = []) {
    const response = await geminiChat({
      model: FLASH_MODEL,
      systemInstruction: "You are an expert educational assistant. Help students with assignments, exam prep, and complex topics.",
      message,
      history,
    });
    return response.text;
  },

  async tutorChat(message: string, history: Array<{ role: "user" | "assistant"; content: string }> = [], profile?: { displayName?: string; gradeLevel?: string }) {
    let hasUserMessage = false;
    const formattedHistory = history.slice(-16).flatMap((item) => {
      if (item.role === "user") hasUserMessage = true;
      if (item.role === "assistant" && !hasUserMessage) return [];
      return [{
        role: item.role === "assistant" ? "model" : "user",
        parts: [{ text: item.content }],
      }];
    });

    const response = await geminiChat({
      model: FLASH_MODEL,
      systemInstruction: `You are Study Buddy, a Gemini-powered tutor inside EducationRev.

Student context:
- Name: ${profile?.displayName || "Student"}
- Grade level: ${profile?.gradeLevel || "Not specified"}

Tutor behaviour:
- Teach clearly, step by step, and adapt to the student's level.
- Ask one short clarifying question when the request is ambiguous.
- Give hints before full answers when the student asks for homework help.
- For maths and science, show working and check the answer.
- For writing, help plan, improve, and explain choices without doing all thinking for the student.
- Keep answers focused, friendly, and practical.
- Do not pretend to have read files or previous conversations unless they are in the chat history.`,
      message,
      history: formattedHistory,
    });
    return response.text;
  },

  // Complex Reasoning (Thinking Mode)
  async think(prompt: string) {
    const response = await geminiGenerateContent({
      model: PRO_MODEL,
      contents: prompt,
    });
    return response.text;
  },

  async solveMathProblem(problem: string, mode: string, level: string): Promise<MathSolverResponse> {
    const cacheInput = {
      problem,
      mode,
      level,
    };

    const cached = await getCachedMathSolverResult(cacheInput);
    if (cached) {
      return cached;
    }

    const response = await geminiGenerateContent({
      model: PRO_MODEL,
      contents: `Solve this math problem with rigorous, Wolfram Alpha-style precision.

Problem:
${problem}

Solver mode: ${mode}
Student level: ${level}

Requirements:
- Return only valid JSON matching the provided schema.
- Normalize the problem before solving.
- If variables, domains, units, or constraints are ambiguous, state reasonable assumptions.
- Show concise step-by-step work that a student can follow.
- Verify the final answer with substitution, differentiation, simplification, or an independent arithmetic check when applicable.
- Do not invent facts or skip algebraic transformations.
- Use plain text math or LaTeX-friendly expressions. Do not use markdown tables.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            problemType: { type: "string" },
            normalizedProblem: { type: "string" },
            exactAnswer: { type: "string" },
            decimalAnswer: { type: "string" },
            assumptions: { type: "array", items: { type: "string" } },
            steps: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  work: { type: "string" },
                  explanation: { type: "string" },
                  check: { type: "string" }
                },
                required: ["title", "work", "explanation", "check"]
              }
            },
            verification: { type: "string" },
            followUpQuestions: { type: "array", items: { type: "string" } }
          },
          required: ["problemType", "normalizedProblem", "exactAnswer", "assumptions", "steps", "verification", "followUpQuestions"]
        }
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    await saveMathSolverResult(cacheInput, parsed);
    return parsed;
  },

  async explainMathStep(problem: string, step: MathSolverStep, question: string) {
    const response = await geminiGenerateContent({
      model: FLASH_MODEL,
      contents: `You are a careful math tutor. Answer the student's question about one selected step.

Original problem:
${problem}

Selected step title:
${step.title}

Selected step work:
${step.work}

Selected step explanation:
${step.explanation}

Student question:
${question}

Answer directly, check the math, and keep it clear. If the selected step contains an error, say so and correct it.`,
    });
    return response.text;
  },

  async explainFormula(formula: string, subject: string, topic: string): Promise<FormulaExplanation> {
    return getOrCreateCachedAiResult(
      {
        scope: "formula-explanation",
        input: {
          formula,
          subject,
          topic,
        },
      },
      async () => {
        const response = await geminiGenerateContent({
          model: PRO_MODEL,
          contents: `Explain this formula for a student in a clear, practical way.

Formula:
${formula}

Subject: ${subject || "General"}
Topic: ${topic || "Not specified"}

Return only valid JSON matching the schema.

Explain:
1. What it is and what each variable means, including units where relevant.
2. Why it is used and what clues to look for in questions.
3. How to use it step by step, with a short worked example.

Rules:
- Use the selected subject and topic to avoid a generic explanation.
- Keep wording easy to understand.
- If the formula could mean different things in different subjects, state the most likely interpretation and note ambiguity.
- Do not use markdown tables.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            title: { type: "string" },
            normalizedFormula: { type: "string" },
            subject: { type: "string" },
            topic: { type: "string" },
            whatItIs: { type: "string" },
            variables: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  symbol: { type: "string" },
                  meaning: { type: "string" },
                  units: { type: "string" }
                },
                required: ["symbol", "meaning", "units"]
              }
            },
            whyItIsUsed: { type: "string" },
            questionClues: { type: "array", items: { type: "string" } },
            howToUseIt: { type: "array", items: { type: "string" } },
            workedExample: { type: "string" },
            commonMistakes: { type: "array", items: { type: "string" } }
          },
          required: ["title", "normalizedFormula", "subject", "topic", "whatItIs", "variables", "whyItIsUsed", "questionClues", "howToUseIt", "workedExample", "commonMistakes"]
        }
          },
        });

        return JSON.parse(response.text || "{}");
      },
    );
  },

  async generatePracticeQuiz(params: {
    subject: string;
    topic: string;
    instructions?: string;
    sourceText?: string;
    fileDataUrl?: string;
  }): Promise<PracticeQuizQuestion[]> {
    const prompt = `Create an online practice quiz for a student.

Subject: ${params.subject || "General"}
Topic: ${params.topic}
Extra instructions: ${params.instructions || "None"}
${params.sourceText ? `\nStudent-provided notes:\n${params.sourceText}` : ""}

Requirements:
- Generate exactly 10 multiple-choice questions.
- Each question must have exactly 4 answer options.
- The correctAnswer must exactly match one of the options.
- Include a short explanation that teaches why the answer is correct.
- Use the uploaded file as source material if one is included.
- Keep the questions clear, school-appropriate, and topic-focused.
- Return only valid JSON matching the schema.`;

    const contents = params.fileDataUrl
      ? [
          {
            role: "user",
            parts: [
              { text: prompt },
              { inlineData: dataUrlToInlineData(params.fileDataUrl) }
            ]
          }
        ]
      : prompt;

    return getOrCreateCachedAiResult(
      {
        scope: "practice-quiz",
        input: {
          subject: params.subject,
          topic: params.topic,
          instructions: params.instructions || "",
          sourceText: params.sourceText || "",
          fileDataUrl: params.fileDataUrl || "",
        },
      },
      async () => {
        const response = await geminiGenerateContent({
          model: FLASH_MODEL,
          contents,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  options: { type: "array", items: { type: "string" } },
                  correctAnswer: { type: "string" },
                  explanation: { type: "string" }
                },
                required: ["question", "options", "correctAnswer", "explanation"]
              }
            }
          },
        });

        return JSON.parse(response.text || "[]");
      },
    );
  },

  async lectureLift(params: {
    pageTitle: string;
    shorthandNotes: string;
    transcript: string;
  }): Promise<LectureLiftResponse> {
    const shorthandNotes = clampPromptText(params.shorthandNotes, 9000);
    const transcript = clampPromptText(params.transcript, 30000);
    const prompt = `You are Lecture Lift inside EducationRev.

Your job is to merge a student's rough shorthand class notes with the fuller lecture transcript.

Page title:
${params.pageTitle || "Untitled lecture note"}

Student shorthand notes:
${shorthandNotes}

Lecture transcript:
${transcript}

Return only valid JSON matching the schema.

Rules:
- Preserve what the student clearly chose to write down.
- Use the transcript to fill in missing context, examples, definitions, and explanations.
- Keep the enhanced notes useful for later revision, not like a verbatim transcript.
- If the lecture contains examples, include the specific examples the teacher used.
- If the lecture suggests exam importance, capture that in examFlags.
- Flashcards must be concise and revision-ready.
- Keywords should be short search phrases suitable for EducationRev resources or library search.
- Suggested questions should sound like realistic study or exam practice prompts.
- Do not use markdown tables.`;
    const config = {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          enhancedNotes: { type: "string" },
          summaryBullets: { type: "array", items: { type: "string" } },
          flashcards: {
            type: "array",
            items: {
              type: "object",
              properties: {
                term: { type: "string" },
                definition: { type: "string" },
              },
              required: ["term", "definition"],
            },
          },
          keywords: { type: "array", items: { type: "string" } },
          examFlags: {
            type: "array",
            items: {
              type: "object",
              properties: {
                topic: { type: "string" },
                whyItMatters: { type: "string" },
                suggestedQuestion: { type: "string" },
              },
              required: ["topic", "whyItMatters", "suggestedQuestion"],
            },
          },
          suggestedQuestions: { type: "array", items: { type: "string" } },
        },
        required: [
          "title",
          "enhancedNotes",
          "summaryBullets",
          "flashcards",
          "keywords",
          "examFlags",
          "suggestedQuestions",
        ],
      },
    };
    return getOrCreateCachedAiResult(
      {
        scope: "lecture-lift",
        input: {
          pageTitle: params.pageTitle,
          shorthandNotes,
          transcript,
        },
      },
      async () => {
        const models = [FLASH_MODEL];
        let lastError: unknown = null;

        for (const model of models) {
          try {
            const response = await geminiGenerateContent({
              model,
              contents: prompt,
              config,
            });
            const parsed = parseJsonText<Partial<LectureLiftResponse>>(response.text || "", "Lecture Lift");
            const normalized = normalizeLectureLiftResponse(parsed);
            if (!normalized.enhancedNotes.trim()) {
              throw new Error("Lecture Lift returned empty notes.");
            }
            return normalized;
          } catch (error) {
            lastError = error;
          }
        }

        if (lastError instanceof Error) {
          const message = lastError.message || "";
          if (/PERMISSION_DENIED|RESOURCE_EXHAUSTED|quota|429|403/i.test(message)) {
            return buildLocalLectureLift({
              pageTitle: params.pageTitle,
              shorthandNotes,
              transcript,
            });
          }
          throw lastError;
        }
        return buildLocalLectureLift({
          pageTitle: params.pageTitle,
          shorthandNotes,
          transcript,
        });
      },
    );
  },

  async enhanceMeetingNotes(params: {
    meetingTitle: string;
    course?: string;
    projectTitle?: string;
    agenda?: string;
    rawNotes: string;
    participantEmails?: string[];
  }): Promise<MeetingNotesEnhancement> {
    const rawNotes = clampPromptText(params.rawNotes, 18000);
    const agenda = clampPromptText(params.agenda || "", 5000);
    const participantEmails = (params.participantEmails || []).filter(Boolean);

    return getOrCreateCachedAiResult(
      {
        scope: "meeting-notes-enhancement",
        input: {
          meetingTitle: params.meetingTitle,
          course: params.course || "",
          projectTitle: params.projectTitle || "",
          agenda,
          rawNotes,
          participantEmails,
        },
      },
      async () => {
        const response = await geminiGenerateContent({
          model: FLASH_MODEL,
          contents: `You are EducationRev University's AI meeting assistant.

Transform rough live meeting notes into polished, useful university project notes.

Meeting title:
${params.meetingTitle || "Untitled meeting"}

Project:
${params.projectTitle || "Not specified"}

Course:
${params.course || "Not specified"}

Participants:
${participantEmails.length ? participantEmails.join(", ") : "Not provided"}

Agenda:
${agenda || "Not provided"}

Raw notes:
${rawNotes}

Return only valid JSON matching the schema.

Rules:
- Write like a sharp academic meeting assistant, not a chatbot.
- Keep the executive summary concise and useful.
- Turn the raw notes into polished structured notes with sections and bullets in plain text.
- Infer decisions and action items only when reasonably supported by the notes.
- If an owner or deadline is unclear, use "Unassigned" or "Not set" rather than inventing details.
- Action items should be practical and meeting-ready.
- Follow-up email should read like a concise university project recap email.
- Do not use markdown tables.`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "object",
              properties: {
                executiveSummary: { type: "string" },
                structuredNotes: { type: "string" },
                keyTakeaways: { type: "array", items: { type: "string" } },
                decisions: { type: "array", items: { type: "string" } },
                actionItems: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      task: { type: "string" },
                      owner: { type: "string" },
                      deadline: { type: "string" },
                    },
                    required: ["task", "owner", "deadline"],
                  },
                },
                blockers: { type: "array", items: { type: "string" } },
                followUpEmail: { type: "string" },
              },
              required: [
                "executiveSummary",
                "structuredNotes",
                "keyTakeaways",
                "decisions",
                "actionItems",
                "blockers",
                "followUpEmail",
              ],
            },
          },
        });

        return normalizeMeetingNotesEnhancement(parseJsonText<Partial<MeetingNotesEnhancement>>(response.text || "", "Meeting notes AI"));
      },
    );
  },

  async formulaImageToText(imageDataUrl: string) {
    const match = imageDataUrl.match(/^data:(.+);base64,(.+)$/);
    if (!match) {
      throw new Error("Invalid formula image format.");
    }

    const mimeType = match[1];
    const data = match[2];
    const response = await geminiGenerateContent({
      model: FLASH_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: "Extract the formula or equation from this image. Return plain text only. Preserve symbols, exponents, subscripts, fractions, equals signs, and line breaks where useful. If there is no formula, return an empty string."
            },
            {
              inlineData: {
                mimeType,
                data
              }
            }
          ]
        }
      ]
    });
    return (response.text || "").trim();
  },

  // Generate Flashcards
  async generateFlashcards(topic: string) {
    return getOrCreateCachedAiResult(
      {
        scope: "flashcards-topic",
        input: {
          topic,
        },
      },
      async () => {
        const response = await geminiGenerateContent({
          model: FLASH_MODEL,
          contents: `Generate a set of 10 flashcards for the topic: ${topic}. Return as JSON.`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  term: { type: "string" },
                  definition: { type: "string" }
                },
                required: ["term", "definition"]
              }
            }
          }
        });
        return JSON.parse(response.text || '[]');
      },
    );
  },

  // Generate Quiz
  async generateQuiz(topic: string) {
    return getOrCreateCachedAiResult(
      {
        scope: "quiz-topic",
        input: {
          topic,
        },
      },
      async () => {
        const response = await geminiGenerateContent({
          model: FLASH_MODEL,
          contents: `Generate a quiz with 5 multiple choice questions for the topic: ${topic}. Return as JSON.`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  options: { type: "array", items: { type: "string" } },
                  correctAnswer: { type: "string" },
                  explanation: { type: "string" }
                },
                required: ["question", "options", "correctAnswer"]
              }
            }
          }
        });
        return JSON.parse(response.text || '[]');
      },
    );
  },

  // Text to Speech
  async textToSpeech(text: string) {
    const response = await geminiGenerateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  },

  // Search Grounding
  async search(query: string) {
    const response = await geminiGenerateContent({
      model: FLASH_MODEL,
      contents: query,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });
    return {
      text: response.text,
      sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  },

  // Image Generation
  async generateImage(prompt: string, size: "1K" | "2K" | "4K" = "1K") {
    const response = await geminiGenerateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: { parts: [{ text: prompt }] },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: size
        }
      },
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  },

  // Handwriting to text (OCR-style transcription)
  async handwritingToText(imageDataUrl: string) {
    const match = imageDataUrl.match(/^data:(.+);base64,(.+)$/);
    if (!match) {
      throw new Error("Invalid handwriting image format.");
    }

    const mimeType = match[1];
    const data = match[2];
    const response = await geminiGenerateContent({
      model: FLASH_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: "Transcribe this handwriting into plain text only. Preserve line breaks where possible. If unreadable, return an empty string."
            },
            {
              inlineData: {
                mimeType,
                data
              }
            }
          ]
        }
      ]
    });
    return (response.text || "").trim();
  }
};
