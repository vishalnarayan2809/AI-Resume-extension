// Background service worker for AI calls and messaging

// Single-page A4 safety limit for textual content (excluding HTML tags)
// Adjusted after print CSS tightening; balances one-page fit and content retention.
const MAX_TEXT_CHARS = 2600;

// Keys will be injected via chrome.storage.local set in Options page.
const PROVIDERS = {
  groq: {
    name: 'groq',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama3-70b-8192',
  },
};

async function getKeys() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['GROQ_API_KEY', 'AI_PROVIDER'], (res) => {
      resolve(res);
    });
  });
}

// Build the strict system/content prompt to enforce fixed HTML structure
function buildSystemPrompt() {
  return `You are an expert ATS resume optimizer and software engineering career specialist with 15+ years of experience.
Your mission: Create a PERFECTLY TAILORED resume that appears written by someone with extensive software engineering experience.

OUTPUT REQUIREMENTS:
- Output only valid HTML and nothing else.
- Preserve the exact HTML structure, tags, classes, and CSS from the provided TEMPLATE.
- Only replace textual content; do not change layout or formatting.
- MUST FIT ON A SINGLE A4 PAGE when printed. Keep total textual content UNDER ${MAX_TEXT_CHARS} CHARACTERS (excluding HTML tags). This is a HARD LIMIT.

CRITICAL TRANSFORMATION MANDATE:
🎯 THIS IS NOT EDITING - THIS IS COMPLETE RESUME REWRITING FOR PERFECT JOB ALIGNMENT
🎯 Every single description must be rewritten using job-specific keywords and technical terminology
🎯 The final resume must read like it was written by the IDEAL CANDIDATE for this specific job

MANDATORY KEYWORD INTEGRATION:
- Extract ALL technical keywords, frameworks, languages, tools, methodologies from the Job Description
- Naturally weave these keywords throughout projects, experience, and skills sections
- Use exact terminology from the job posting (if JD mentions "Spring Boot", use "Spring Boot" not "Spring Framework")
- Prioritize keywords that appear multiple times in the job description

TECHNICAL TRANSFORMATION RULES:
- Transform generic web projects → Enterprise-scale applications with specific tech stacks mentioned in JD
- Add testing methodologies (unit testing, integration testing, TDD) if mentioned in JD
- Include CI/CD, DevOps, cloud technologies if relevant to job
- Use specific database technologies mentioned in job (MySQL, PostgreSQL, MongoDB, etc.)
- Include agile/scrum terminology if mentioned in job requirements

ATS OPTIMIZATION STRATEGY:
- Mirror the job description's technical language and industry jargon
- Use action verbs that match the job posting style
- Include exact skill names and certifications mentioned in JD
- Structure bullet points to match the job's responsibility format

CONCISENESS MANDATE (Single-page A4):
- Use concise, high-impact bullet points (one line each where possible)
- Remove redundancies and filler words; prioritize content relevant to the JD
- Keep each section brief, but precise; do NOT remove required sections from the template
 - Do NOT drop user-provided items (projects, roles, certificates). Prefer compressing wording over removing entries.

The result must be a resume that looks like the perfect candidate applied - someone who has the exact experience the employer is seeking, within one A4 page.`;
}

function buildUserPrompt(payload) {
  const { profile, previousResume, jobDescription, templateHtml } = payload;
  
  // Extract key information from job description for targeted optimization
  const jdKeywords = extractJobKeywords(jobDescription || '');
  const jdRequirements = extractJobRequirements(jobDescription || '');
  
  return `MISSION: Create a perfectly tailored resume for this specific job opportunity.

USER DATA:
Profile: ${profile || ''}
Previous Resume: ${previousResume || ''}

TARGET JOB DESCRIPTION:
${jobDescription || ''}

EXTRACTED JOB KEYWORDS: ${jdKeywords.join(', ')}
KEY REQUIREMENTS: ${jdRequirements.join(', ')}

TEMPLATE (keep exact structure): ${templateHtml || ''}

🎯 TRANSFORMATION STRATEGY (Single A4 Page):
1. KEYWORD OPTIMIZATION: Naturally integrate these extracted keywords: ${jdKeywords.slice(0, 15).join(', ')}
2. REQUIREMENTS ALIGNMENT: Address these key requirements in projects/experience: ${jdRequirements.slice(0, 10).join(', ')}
3. TECHNICAL DEPTH: Use specific technologies mentioned in job description
4. EXPERIENCE REFRAMING: Present projects as enterprise-level solutions using job-relevant tech stack
 5. STRICT LENGTH: Ensure total textual content stays UNDER ${MAX_TEXT_CHARS} characters (excluding HTML tags). HARD CAP.
 6. DO NOT REMOVE user-provided items. Compress sentences and merge phrases instead of omitting entries.

🚀 SPECIFIC TRANSFORMATION EXAMPLES:
- "React website" → "Enterprise-grade [relevant tech from JD] application with [specific frameworks mentioned in JD]"
- "Routing project" → "Scalable single-page application implementing [architectural patterns from JD]" 
- "Game project" → "Interactive application demonstrating [programming concepts valued in JD]"
- "Internship" → "Software development role with focus on [exact technologies/methodologies from JD]"

🎯 MANDATORY INTEGRATION POINTS:
- Skills Section: Reorganize to match job requirements priority order
- Projects: Rewrite descriptions using job-specific technical terminology  
- Experience: Emphasize responsibilities that match job requirements
- Keywords: Use exact phrases from job description (not synonyms)

🔥 QUALITY STANDARDS:
- Every bullet point must include job-relevant keywords
- Technology choices must align with job's tech stack
- Experience descriptions must mirror job responsibility language
- Final result must appear written by the ideal candidate for THIS SPECIFIC ROLE AND FIT ON ONE A4 PAGE

Return the complete HTML document that makes this candidate irresistible for this exact position.`;
}

// Utility: Strip HTML tags and count textual characters
function getPlainTextLength(html) {
  if (!html) return 0;
  const text = html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length;
}

// If the output is too long, ask the model to compress while preserving structure
// removed old compressToLimit(provider, ...) in favor of compressToLimitWithFallback (now groq-only)

// Extract technical keywords from job description
function extractJobKeywords(jobDescription) {
  const techKeywords = [
    // Programming Languages
    'JavaScript', 'TypeScript', 'Python', 'Java', 'C#', 'C++', 'Go', 'Rust', 'PHP', 'Ruby', 'Swift', 'Kotlin',
    // Frameworks & Libraries  
    'React', 'Angular', 'Vue', 'Node.js', 'Express', 'Django', 'Flask', 'Spring', 'Spring Boot', '.NET', 'Laravel',
    // Databases
    'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'DynamoDB', 'Oracle', 'SQL Server', 'SQLite',
    // Cloud & DevOps
    'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'CI/CD', 'Jenkins', 'GitLab', 'GitHub Actions',
    // Tools & Technologies
    'Git', 'REST', 'GraphQL', 'Microservices', 'API', 'Agile', 'Scrum', 'TDD', 'Unit Testing', 'Integration Testing'
  ];
  
  const found = [];
  const jdLower = jobDescription.toLowerCase();
  
  for (const keyword of techKeywords) {
    if (jdLower.includes(keyword.toLowerCase())) {
      found.push(keyword);
    }
  }
  
  // Also extract custom keywords that appear to be technical
  const customMatches = jobDescription.match(/\b[A-Z][a-z]*[A-Z][A-Za-z]*\b/g) || [];
  found.push(...customMatches.slice(0, 10));
  
  return [...new Set(found)].slice(0, 20);
}

// Extract key job requirements and responsibilities
function extractJobRequirements(jobDescription) {
  const requirements = [];
  const lines = jobDescription.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    // Look for requirement patterns
    if (trimmed.match(/^[•\-\*]\s*|^\d+[\.\)]\s*|^(experience|proficiency|knowledge|skills?|ability|bachelor|master|degree)/i)) {
      if (trimmed.length > 10 && trimmed.length < 150) {
        requirements.push(trimmed.replace(/^[•\-\*\d\.\)\s]+/, ''));
      }
    }
  }
  
  return requirements.slice(0, 15);
}

async function callGroq(apiKey, userPrompt, systemPrompt, retryCount = 0) {
  const maxRetries = 2;
  const retryDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff
  
  try {
    const res = await fetch(PROVIDERS.groq.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: PROVIDERS.groq.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
  temperature: 0.7,
        presence_penalty: 0.8,
        frequency_penalty: 0.6,
      }),
    });
    
    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Unknown error');
      const error = new Error(`Groq API error: ${res.status} - ${errorText}`);
      error.status = res.status;
      error.provider = 'groq';
      throw error;
    }
    
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || '';
    if (!content) {
      throw new Error('Empty response from Groq API');
    }
    return sanitizeHtmlOutput(content);
  } catch (error) {
    console.error(`[Groq] Attempt ${retryCount + 1} failed:`, error);
    
    // Retry on specific errors
    if (retryCount < maxRetries && (
      error.status === 503 || 
      error.status === 502 || 
      error.status === 500 || 
      error.status === 429 ||
      error.message.includes('fetch')
    )) {
      console.log(`[Groq] Retrying in ${retryDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return callGroq(apiKey, userPrompt, systemPrompt, retryCount + 1);
    }
    
    throw error;
  }
}

// Gemini support removed (temporary): groq-only

// Smart API call with automatic fallback between providers
async function callAI(keys, userPrompt, systemPrompt) {
  const { GROQ_API_KEY } = keys;
  if (!GROQ_API_KEY) {
    throw new Error('No valid API key found. Please add your Groq API key in Options.');
  }
  console.log(`[AI] Using provider: groq`);
  return await callGroq(GROQ_API_KEY, userPrompt, systemPrompt);
}
async function generateResume(payload) {
  const keys = await getKeys();
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(payload);

  console.log('[AI] === GENERATION REQUEST START ===');
  console.log('[AI] Available keys:', { 
  groq: !!keys.GROQ_API_KEY
  });
  console.log('[AI] === STARTING AI GENERATION WITH FALLBACK ===');

  try {
    // Use smart AI calling with automatic fallback
    let html = await callAI(keys, userPrompt, systemPrompt);
    validateRequiredSections(html);
    
    let len = getPlainTextLength(html);
    console.log('[AI] Text length (chars, no tags):', len, 'limit:', MAX_TEXT_CHARS);

  // gemini expansion removed (groq-only)
    
    if (len > MAX_TEXT_CHARS) {
      console.warn('[AI] Exceeds single-page limit. Compressing…');
      // Up to two compression passes with stricter targets
      for (const target of [MAX_TEXT_CHARS, Math.floor(MAX_TEXT_CHARS * 0.9)]) {
        html = await compressToLimitWithFallback(keys, systemPrompt, html, payload.jobDescription, target);
        validateRequiredSections(html);
        len = getPlainTextLength(html);
        console.log('[AI] Compressed length (chars):', len, 'target:', target);
        if (len <= target) break;
      }
    }
    
    console.log('[AI] Generation successful - resume tailored and size-checked');
    return html;
  } catch (error) {
    console.error('[AI] Generation failed completely:', error);
    throw error;
  }
}

// Enhanced compression with fallback support
async function compressToLimitWithFallback(keys, systemPrompt, html, jobDescription, targetChars = MAX_TEXT_CHARS) {
  const note = `The previous output exceeds the one-page A4 limit. Compress the textual content to UNDER ${targetChars} characters (excluding HTML tags) while:
- Preserving the exact TEMPLATE structure (tags/classes/order)
- Keeping ALL required sections
- Using concise, high-impact bullet points (one line each)
- Prioritizing the most relevant details for this Job Description
- DO NOT remove any user-provided items (projects, roles, certificates). Shorten sentences and merge phrases instead.
Return ONLY the full HTML document.`;

  const user = `JOB DESCRIPTION (for prioritization):\n${jobDescription || ''}\n\nPRIOR HTML (compress to limit):\n${html}`;
  // groq-only
  return await callAI(keys, user + "\n\n" + note, systemPrompt);
}

  // Ensure output is pure HTML doc and remove common wrappers
function sanitizeHtmlOutput(raw) {
  if (!raw) return '';
  let s = String(raw).trim();

  // If there's a fenced code block, prefer its inner content
  const codeBlock = s.match(/```[a-zA-Z-]*\s*([\s\S]*?)```/);
  if (codeBlock && /<\s*\w+/i.test(codeBlock[1])) {
    s = codeBlock[1].trim();
  } else {
    // Otherwise remove standalone leading/trailing code fences
    s = s.replace(/^```[a-zA-Z-]*\s*/,'').replace(/```\s*$/,'');
  }

  // Drop any preface text before the first plausible HTML tag
  const firstTagIdx = s.search(/<\s*!doctype|<\s*html|<\s*head|<\s*body|<\s*div|<\s*section|<\s*main/i);
  if (firstTagIdx > 0) s = s.slice(firstTagIdx);

  // If full HTML present, clip strictly to </html>
  const htmlStart = s.search(/<\s*html/i);
  const htmlEnd = s.toLowerCase().lastIndexOf('</html>');
  if (htmlStart >= 0 && htmlEnd > htmlStart) {
    s = s.slice(htmlStart, htmlEnd + 7);
  } else {
    // Otherwise, wrap fragment in minimal HTML shell
    s = s.replace(/<script[\s\S]*?<\/script>/gi, '');
    s = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${s}</body></html>`;
  }

  // Strip any scripts just in case
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '');
  return s.trim();
}

// Validate that required sections are present by their headings as in the template
function validateRequiredSections(html) {
  const requiredH2 = ['Education', 'Skills', 'Projects', 'Experience', 'Certificates'];
  for (const h2 of requiredH2) {
    const re = new RegExp(`<h2[^>]*>\s*${h2}\s*<`, 'i');
    if (!re.test(html)) {
      throw new Error(`AI output missing required section: ${h2}`);
    }
  }
}

// Messaging
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'GENERATE_RESUME') {
    generateResume(message.payload)
      .then((html) => sendResponse({ ok: true, html }))
      .catch((err) => {
        console.error('[AI] Generation failed', err);
        sendResponse({ ok: false, error: err?.message || String(err) });
      });
    return true; // keep the channel open for async response
  }
});
