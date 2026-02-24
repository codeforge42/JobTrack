const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const axios = require("axios");
const OpenAI = require("openai");
const { chromium } = require("playwright");
require("dotenv").config();

const OUTPUT_DIR = path.join(__dirname, "..", "output");
const FETCH_TIMEOUT_MS = 15000;
const DELAY_BETWEEN_FETCHES_MS = 500;
const MAX_CONTENT_CHARS = 12000; // truncate page content to avoid token limits

const STACK_LIST = [
  "Frontend",
  "Backend",
  "Fullstack",
  "DevOps",
  "QA",
  "Mobile",
  "Data Science",
  "Data Engineer",
  "Data Analyst",
  "ML Engineer",
  "AI Engineer",
  "Software Engineer",
  "Cloud Engineer",
  "Database Administrator",
  "Network Engineer",
  "Site Reliability Engineer",
  "UX/UI Designer",
];

const SYSTEM_PROMPT = `You are a strict JSON-only classifier for software job descriptions.

**Rule:** If any estimated item cannot be clearly determined from the page content, output "N/A" for that field instead of empty values. Do not guess.

You must extract the following:

0. **Work arrangement**
   From the job title and description, determine if the role is:
   - "Remote" (fully remote, work from home, distributed)
   - "Hybrid" (mix of remote and on-site)
   - "On-site" (office-based, in-person)
   If work arrangement is not clearly stated or unclear, return "N/A" in "remote".

1. **Stack Classification**
   Determine which ONE stack from the following list best matches the role, based only on the job title and description:
   ${JSON.stringify(STACK_LIST)}
   - Also produce a list of ALL matching stacks (can be empty) in "allPossibleStacks".
   - If no stack clearly matches or you are unsure, return "N/A" in "bestStack" (and leave allPossibleStacks empty).

2. **Special Phrase Detection**
   Determine whether the job is associated with:
   - security clearance (Secret, Top Secret, TS/SCI, Public Trust, etc.)
   - federal / government / DoD / public sector contracting.
   - Set "hasSpecialPhrase" to true only if such a phrase clearly appears. List those phrases in "matchedSpecialPhrases".
   - If the page content does not clearly indicate this, leave hasSpecialPhrase false and matchedSpecialPhrases empty.

3. **Industry Classification**
   Determine whether the role clearly belongs to:
   - "finance" (banking, fintech, trading, investment, capital markets, payments, insurance, etc.)
   - "healthcare" (hospitals, clinical systems, EMR/EHR, HIPAA, medtech, patient data, etc.)
   - If neither is clearly indicated, return "N/A" in "industry". Do not guess.

4. **Annual Salary**
   Estimate the annual salary from the job description and put exactly ONE of these in "annualSalary":
   - "30K <"  → $30,000 to under $60,000
   - "60K <"  → $60,000 to under $100,000
   - "100K <" → $100,000 to under $160,000
   - "160K <" → $160,000 and under $200,000
    - "200K <" → $200,000 and above
   If salary is given as a range (e.g. $80k–$120k), use the middle value to pick the bucket.
   If annual salary is not given or cannot be clearly determined, return "N/A".

5. **Level**
   From the job title and description, determine the seniority/level and put exactly ONE of these in "level":
   - "Middle" (mid-level, mid-senior)
   - "Senior"
   - "Staff"
   - "Principal" (or "Principle" in some job postings)
   - "Lead"
   - "Architect"
   If level is not clearly stated or cannot be determined, return "N/A" in "level".

6. **JSON-ONLY Output**
Return ONLY valid JSON in this exact structure (no markdown, no code block):

{
  "remote": "",
  "bestStack": "",
  "allPossibleStacks": [],
  "hasSpecialPhrase": false,
  "matchedSpecialPhrases": [],
  "industry": "",
  "annualSalary": "",
  "level": ""
}

Where:
- remote → "Remote", "Hybrid", "On-site", or "N/A" (when not clearly known)
- bestStack → one stack from the list or "N/A" (when not clearly known)
- allPossibleStacks → list of stacks (can be empty)
- hasSpecialPhrase → true/false
- matchedSpecialPhrases → list of detected phrases
- industry → "finance", "healthcare", or "N/A" (when not clearly known)
- annualSalary → "30K <", "60K <", "100K <", "160K <", "200K <", or "N/A"
- level → "Middle", "Senior", "Staff", "Principal", "Lead", "Architect", or "N/A" (when not clearly known)`;

const SALARY_BUCKETS = ["30K <", "60K <", "100K <", "160K <", "200K <", "N/A"];
const LEVEL_VALUES = ["Middle", "Senior", "Staff", "Principal", "Principle", "Lead", "Architect", "N/A"];

const DEFAULT_CLASSIFICATION = {
  remote: "N/A",
  bestStack: "N/A",
  allPossibleStacks: [],
  hasSpecialPhrase: false,
  matchedSpecialPhrases: [],
  industry: "N/A",
  annualSalary: "N/A",
  level: "N/A",
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const WRITE_RETRIES = 5;
const WRITE_RETRY_DELAY_MS = 1500;

/**
 * Write workbook to path with retries on EBUSY (file locked, e.g. open in Excel).
 */
async function writeWorkbookWithRetry(workbook, filePath) {
  let lastErr;
  for (let attempt = 1; attempt <= WRITE_RETRIES; attempt++) {
    try {
      XLSX.writeFile(workbook, filePath);
      return;
    } catch (err) {
      lastErr = err;
      if (err.code === "EBUSY" && attempt < WRITE_RETRIES) {
        await delay(WRITE_RETRY_DELAY_MS * attempt);
        continue;
      }
      if (err.code === "EBUSY") {
        const busyErr = new Error(
          "JobLinks.xlsx is busy or locked. Please close it in Excel (or any other program) and try again."
        );
        busyErr.code = "EBUSY";
        throw busyErr;
      }
      throw err;
    }
  }
  throw lastErr;
}

/**
 * Fetch page content as text (HTML). Strips script/style and normalizes whitespace.
 * @param {string} url
 * @returns {Promise<string>} page text
 */
async function fetchPageContent(url) {
  try {
    const browser = await chromium.launch({
      headless: false,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
      ],
    });

    const browsercontext = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
      locale: "en-US",
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
    });

    let page = await browsercontext.newPage();

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 300000 });

    await page.waitForTimeout(12000);

    for (let i = 0; i < 10; i++) {
      await page.mouse.wheel(0, 3000); // Simulate scrolling
      await page.waitForTimeout(2000); // Wait for the content to load (adjust time as needed)
    }
    // Extract visible text from main frame
    let textContent = await page.evaluate(() => document.body && document.body.innerText ? document.body.innerText : "");

    // Loop through all iframes and extract their visible text
    const frames = page.frames();
    for (const frame of frames) {
      if (frame === page.mainFrame()) continue;
      try {
        const frameText = await frame.evaluate(() => document.body && document.body.innerText ? document.body.innerText : "");
        if (frameText && frameText.trim().length > 0) {
          textContent += '\n\n' + frameText;
        }
      } catch (e) {
        console.warn(`⚠️ Could not extract text from iframe: ${e.message}`);
        continue;
      }
    }
    page.close();
    return textContent;
  } catch (err) {
    console.warn(`Failed to fetch ${url}:`, err.message);
    return "";
  }
}

/**
 * Call OpenAI to classify job (remote/hybrid/onsite + stack, special phrases, industry).
 * @param {string} jobTitle
 * @param {string} pageContent
 * @param {string} apiKey
 * @returns {Promise<Object>} classification object
 */
async function classifyWithOpenAI(jobTitle, pageContent, apiKey, maxRetries = 3) {
  if (!apiKey) {
    console.warn("OPENAI_API_KEY not set; using defaults");
    return { ...DEFAULT_CLASSIFICATION };
  }

  // Validate API key format
  if (!apiKey.startsWith('sk-')) {
    console.error("Invalid OpenAI API key format. Key should start with 'sk-'");
    return { ...DEFAULT_CLASSIFICATION };
  }

  const content = (pageContent || "").slice(0, MAX_CONTENT_CHARS);
  const userContent = `Job Title: ${jobTitle || "Unknown"}\n\nJob description / page content:\n${content || "(no content)"}`;

  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const openai = new OpenAI({ 
        apiKey,
        timeout: 30000, // 30 second timeout
        maxRetries: 2,  // Built-in retry attempts
      });
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        temperature: 0.2,
      });
      
      const raw = (completion.choices[0]?.message?.content || "").trim();
      const jsonStr = raw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      const parsed = JSON.parse(jsonStr);
      const validRemote = ["Remote", "Hybrid", "On-site", "N/A"];
      return {
        remote: validRemote.includes(parsed.remote) ? parsed.remote : "N/A",
        bestStack: typeof parsed.bestStack === "string" && parsed.bestStack.trim() !== "" ? parsed.bestStack.trim() : "N/A",
        allPossibleStacks: Array.isArray(parsed.allPossibleStacks)
          ? parsed.allPossibleStacks
          : [],
        hasSpecialPhrase: Boolean(parsed.hasSpecialPhrase),
        matchedSpecialPhrases: Array.isArray(parsed.matchedSpecialPhrases)
          ? parsed.matchedSpecialPhrases
          : [],
        industry: ["finance", "healthcare", "N/A", ""].includes(parsed.industry)
          ? (parsed.industry || "N/A")
          : "N/A",
        annualSalary: SALARY_BUCKETS.includes(parsed.annualSalary)
          ? parsed.annualSalary
          : "N/A",
        level: LEVEL_VALUES.includes(parsed.level)
          ? (parsed.level === "Principle" ? "Principal" : parsed.level)
          : "N/A",
      };
    } catch (err) {
      lastError = err;
      const isConnectionError = err.code === 'ECONNREFUSED' || 
                               err.code === 'ETIMEDOUT' || 
                               err.code === 'ENOTFOUND' ||
                               err.message?.includes('401') ||
                               err.message?.includes('Connection') ||
                               err.message?.includes('timeout');
      
      console.warn(`OpenAI classification error (attempt ${attempt}/${maxRetries}): ${err.message}`);
      
      if (isConnectionError && attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else if (attempt === maxRetries) {
        console.error(`Failed to classify after ${maxRetries} attempts. Last error:`, {
          status: err.status,
          code: err.code,
          message: err.message,
          type: err.type,
        });
      }
    }
  }

  return { ...DEFAULT_CLASSIFICATION };
}

/**
 * Read JobLinks.xlsx, analyze each link with OpenAI, update rows in place, and write back to JobLinks.xlsx after each link.
 * @returns {Promise<{ filePath: string, fileName: string }>}
 */
async function analyzeJobLinks() {
  const inputPath = path.join(OUTPUT_DIR, "JobLinks.xlsx");
  if (!fs.existsSync(inputPath)) {
    throw new Error(`JobLinks.xlsx not found at ${inputPath}`);
  }

  const apiKey = process.env.OPENAI_API_KEY || "";
  const workbook = XLSX.readFile(inputPath);
  const sheetName = workbook.SheetNames[0];
  let sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  const linkKey = "Link";
  const titleKey = "Title";
  const hasLinkColumn = rows.length === 0 || linkKey in rows[0];
  if (!hasLinkColumn) {
    throw new Error(
      `JobLinks.xlsx must have a "Link" column. Found: ${Object.keys(rows[0] || {}).join(", ")}`,
    );
  }

  const results = [];
  const today = new Date().toLocaleDateString("en-US");

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const link = row[linkKey] ? String(row[linkKey]).trim() : "";
    const title = row[titleKey] != null ? String(row[titleKey]).trim() : "";
    let classification = { ...DEFAULT_CLASSIFICATION };
    let refinedLink = "";

    if (link) {
      try {
        const u = new URL(link);
        const pathname = u.pathname;
        const origin = u.origin;
        if (u.hostname.includes("applytojob.com")) {
          refinedLink = origin + pathname;
        } else if (pathname.includes("/apply")) {
          const idx = pathname.indexOf("/apply");
          refinedLink = origin + pathname.substring(0, idx);
        } else {
          refinedLink = origin + pathname;
        }
      } catch {
        refinedLink = link;
      }
      const pageText = await fetchPageContent(refinedLink);
      classification = await classifyWithOpenAI(title, pageText, apiKey);
    }

    results.push({
      ...row,
      Date: today,
      Status: "Not Applied",
      Link: refinedLink || link,
      Remote: classification.remote,
      BestStack: classification.bestStack,
      AllPossibleStacks: classification.allPossibleStacks.join(", "),
      SecretRequired: classification.hasSpecialPhrase ? "Yes" : "No",
      GovernanceAndSecurityPhrases: classification.matchedSpecialPhrases.join("; "),
      Industry: classification.industry,
      AnnualSalary: classification.annualSalary,
      Level: classification.level,
    });

    // Write back to JobLinks.xlsx after each link (synchronous update)
    const headers = Object.keys(results[0]);
    const unprocessed = rows.slice(i + 1).map((r) => {
      const out = {};
      headers.forEach((h) => (out[h] = r[h] != null && r[h] !== "" ? r[h] : ""));
      return out;
    });
    const fullRows = [...results, ...unprocessed];
    const worksheet = XLSX.utils.json_to_sheet(fullRows, { header: headers });
    workbook.Sheets[sheetName] = worksheet;
    await writeWorkbookWithRetry(workbook, inputPath);

    if (i < rows.length - 1) await delay(DELAY_BETWEEN_FETCHES_MS);
  }

  return { filePath: inputPath, fileName: "JobLinks.xlsx" };
}

module.exports = { analyzeJobLinks, classifyWithOpenAI, fetchPageContent };
