import Anthropic from '@anthropic-ai/sdk';

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 6): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isRateLimit = err instanceof Anthropic.RateLimitError;
      const isServerError = err instanceof Anthropic.APIError && (err.status ?? 0) >= 500;
      const isNetworkError = err instanceof Anthropic.APIConnectionError;
      if (!isRateLimit && !isServerError && !isNetworkError) throw err;
      const delaySecs = Math.min(2 ** attempt, 60);
      const errCode = err instanceof Anthropic.APIError ? err.status : 'network';
      console.warn(`[evaluate] attempt ${attempt + 1} failed (${errCode}), retrying in ${delaySecs}s…`);
      await new Promise(r => setTimeout(r, delaySecs * 1000));
    }
  }
  throw lastErr;
}

// Scan character-by-character so we only touch content inside strings,
// not structural JSON tokens.
function repairJson(raw: string): string {
  let out = '';
  let inString = false;
  let escaped = false;

  for (const ch of raw) {
    if (escaped) { out += ch; escaped = false; continue; }
    if (ch === '\\' && inString) { out += ch; escaped = true; continue; }
    if (ch === '"') { inString = !inString; out += ch; continue; }

    if (inString) {
      // Bare control characters are illegal inside JSON strings.
      if (ch === '\n') { out += '\\n'; continue; }
      if (ch === '\r') { out += '\\r'; continue; }
      if (ch === '\t') { out += '\\t'; continue; }
    }
    out += ch;
  }

  // Trailing commas before } or ]
  out = out.replace(/,(\s*[}\]])/g, '$1');
  // undefined isn't valid JSON
  out = out.replace(/:\s*undefined\b/g, ': null');

  return out;
}

function tryParse(text: string): EvaluationResult | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;

  // Attempt 1: raw
  try { return JSON.parse(match[0]); } catch { /* fall through */ }

  // Attempt 2: after repair
  try { return JSON.parse(repairJson(match[0])); } catch { /* fall through */ }

  return null;
}

export interface EvaluationResult {
  name: string | null;
  email: string | null;
  pros: string[];
  cons: string[];
  analysis: string;
  score: number;
  interviewQuestions: string[];
  rejectionEmail: string;
  acceptanceMessage: string;
}

export async function evaluateCandidate(
  resumeText: string,
  jobDescription: string,
  jobTitle: string,
  customCriteria?: string | null
): Promise<EvaluationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set. Add it to .env or .env.local and restart the server.');
  const client = new Anthropic({ apiKey });

  const customCriteriaSection = customCriteria
    ? `\nAdditional Hiring Criteria (prioritize these in your evaluation):\n${customCriteria}\n`
    : '';

  const prompt = `You are an expert hiring assistant. Your job is to evaluate a candidate's resume against a job description.

IMPORTANT BIAS PREVENTION RULE: You must ONLY evaluate job-relevant qualifications, experience, skills, and role fit. You must NEVER consider, mention, or let influence your evaluation: race, gender, age, religion, national origin, disability, pregnancy, marital status, sexual orientation, or any other protected personal characteristic. If such information appears in the resume, ignore it completely.

Job Title: ${jobTitle}

Job Description:
${jobDescription}
${customCriteriaSection}
Candidate Resume:
${resumeText}

Please evaluate this candidate and respond with ONLY a valid JSON object in this exact format (no markdown, no explanation, just the JSON):
{
  "name": "candidate full name if found in resume, or null",
  "email": "candidate email if found in resume, or null",
  "pros": ["strength 1", "strength 2", "strength 3"],
  "cons": ["gap or concern 1", "gap or concern 2"],
  "analysis": "A concise analysis of fit — 3 short paragraphs maximum. Each paragraph must be 2-3 sentences. If the evaluation requires more detail, use bullet points instead of long prose. A hiring manager should be able to read the full analysis in under 30 seconds. Be specific and base everything only on the resume and job description. No assumptions, no padding.",
  "score": 75,
  "interviewQuestions": [
    "Targeted question 1 based on their specific background and the role",
    "Targeted question 2 probing a gap or area of concern",
    "Targeted question 3 exploring a key strength",
    "Targeted question 4 about a specific experience on their resume",
    "Targeted question 5 relevant to the role requirements"
  ],
  "rejectionEmail": "Dear [Candidate Name],\\n\\nThank you for your interest in the ${jobTitle} position and for taking the time to apply...\\n\\n[Complete professional rejection email]",
  "acceptanceMessage": "Dear [Candidate Name],\\n\\nThank you for applying for the ${jobTitle} position. We were impressed with your background and would love to invite you to interview...\\n\\n[Complete professional acceptance message with placeholder for interview details]"
}

Score guide: 0 = completely unqualified, 50 = partial fit, 70 = good match, 85 = strong match, 100 = perfect fit.
The score must be a whole number between 0 and 100.
Interview questions must be specific to THIS candidate and THIS role — not generic questions that could apply to anyone.`;

  const message = await withRetry(() => client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  }));

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  let result = tryParse(text);

  if (!result) {
    // The first response had unfixable JSON. Retry once with a minimal prompt
    // that gives the model less room to produce malformed output.
    console.warn('[evaluate] JSON repair failed, retrying with simplified prompt…');
    const fallbackPrompt = `Evaluate the resume below for the job and return ONLY a minified JSON object.
Rules: no markdown, no trailing commas, escape all special characters in strings with \\n \\t etc, all strings must be valid JSON.

Job: ${jobTitle}
Description: ${jobDescription.slice(0, 800)}${customCriteria ? `\nCriteria: ${customCriteria}` : ''}
Resume: ${resumeText.slice(0, 2500)}

Return exactly this shape (nothing else):
{"name":null,"email":null,"pros":["..."],"cons":["..."],"analysis":"...","score":0,"interviewQuestions":["...","...","...","...","..."],"rejectionEmail":"...","acceptanceMessage":"..."}`;

    const retry = await withRetry(() => client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: fallbackPrompt }],
    }));

    const retryText = retry.content[0].type === 'text' ? retry.content[0].text : '';
    result = tryParse(retryText);
  }

  if (!result) throw new Error('Could not parse evaluation response after repair and retry');

  if (!Array.isArray(result.interviewQuestions)) result.interviewQuestions = [];
  return result as EvaluationResult;
}

export async function splitResumes(text: string): Promise<string[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return [text];
  const client = new Anthropic({ apiKey });

  const lines = text.split('\n');
  // Send up to 300 numbered lines so Claude can return line numbers (not full text).
  // Line-number splitting is robust to whitespace differences that break anchor matching.
  const numberedSample = lines.slice(0, 300).map((l, i) => `${i + 1}: ${l}`).join('\n');

  console.log(`[splitResumes] input: ${lines.length} lines, ${text.length} chars`);

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [{
      role: 'user',
      content: `The numbered document below may contain multiple resumes merged into one file.

Return a JSON array of the 1-based line numbers where each distinct resume begins.
If there is only one resume, return: [1]

No explanations — only the JSON array of integers.

DOCUMENT:
${numberedSample}`,
    }],
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
  console.log('[splitResumes] Claude raw response:', responseText);

  // Match the first JSON array of numbers in the response
  const match = responseText.match(/\[\s*\d[\d\s,]*\]/);
  if (!match) {
    console.log('[splitResumes] no integer array found, returning single resume');
    return [text];
  }

  try {
    const lineNums: unknown[] = JSON.parse(match[0]);
    console.log('[splitResumes] parsed line numbers:', lineNums);

    if (!Array.isArray(lineNums) || lineNums.length <= 1) {
      console.log('[splitResumes] single resume detected');
      return [text];
    }

    const validNums = (lineNums as number[])
      .filter((n) => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= lines.length)
      .sort((a, b) => a - b);

    console.log('[splitResumes] valid sorted starts:', validNums);

    if (validNums.length <= 1) return [text];

    const resumes: string[] = [];
    for (let i = 0; i < validNums.length; i++) {
      const startLine = validNums[i] - 1; // convert to 0-indexed
      const endLine = i + 1 < validNums.length ? validNums[i + 1] - 1 : lines.length;
      const slice = lines.slice(startLine, endLine).join('\n').trim();
      console.log(`[splitResumes] resume ${i + 1}: lines ${validNums[i]}–${endLine}, ${slice.length} chars`);
      if (slice.length > 50) resumes.push(slice);
    }

    console.log(`[splitResumes] final count: ${resumes.length}`);
    if (resumes.length >= 2) return resumes;
  } catch (err) {
    console.error('[splitResumes] parse error:', err);
  }

  return [text];
}
