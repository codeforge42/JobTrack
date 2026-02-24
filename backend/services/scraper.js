const axios = require("axios");
const { chromium } = require("playwright");
const OpenAI = require("openai");
const fs = require("fs");
const { text } = require("stream/consumers");
require("dotenv").config();

const brightKey = "7fa136b5-9f99-4675-9da3-7d458de05eff"; // replace with your API key
const MAX_RETRIES = 200; // 200 x 5 seconds = 1000 seconds
const DELAY_MS = 10000; // 5 seconds

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Validate if a string is a valid URL
 * @param {string} urlString - The URL to validate
 * @returns {boolean} - True if valid URL, false otherwise
 */
function isValidUrl(urlString) {
  console.log("Validating URL:", urlString);
  if (!urlString || typeof urlString !== 'string' || urlString.toLocaleLowerCase().includes('google') || urlString.toLocaleLowerCase().includes('about:blank')) return false;
  try {
    new URL(urlString);
    return true;
  } catch (err) {
    return false;
  }
}

// External viewJobs function
// const viewJobs = (text) => {
//   const keywords = [
//     "position",
//     "open position",
//     "job",
//     "open job",
//     "opening",
//     "role",
//     "open role",
//   ];
//   const verbs = ["view", "explore", "see", "find", "search"];
//   const regex = new RegExp(`\\b\\d+\\s+(${keywords.join("|")})s?\\b`, "i");
//   return (
//     regex.test(text) ||
//     (verbs.some((v) => text.includes(v)) &&
//       keywords.some((k) => text.includes(k)))
//   );
// };

const isPageNumber = (text, i) => {
  const regex = /^\d+$/;
  if (regex.test(text)) {
    const num = parseFloat(text); // Convert the string to a number
    return !isNaN(num) && num == i; // Check if it's a valid number and equals the expected page number
  }
  return false;
};

async function convertToAttributeSelector(raw) {
  if (!raw || typeof raw !== "string") return raw;

  const len = raw.length;
  let inBracket = false;
  let buf = "";
  const tokens = [];

  const pushBuf = () => {
    if (buf !== "") {
      tokens.push(buf);
      buf = "";
    }
  };

  for (let i = 0; i < len; i++) {
    const ch = raw[i];

    if (ch === "[") {
      inBracket = true;
      buf += ch;
      continue;
    }

    if (ch === "]") {
      inBracket = false;
      buf += ch;
      continue;
    }

    // If we hit a dot that is NOT inside brackets, it's a class boundary.
    if (ch === "." && !inBracket) {
      // push existing buffer (could be combinator, tag, etc.)
      pushBuf();
      // start new class token with the dot
      buf = ".";
      continue;
    }

    // Handle combinators and separators when not inside brackets:
    if (!inBracket && (ch === ">" || ch === "+" || ch === "~" || ch === ",")) {
      // push current token and the combinator as separate tokens
      pushBuf();
      tokens.push(ch);
      continue;
    }

    // Normalize whitespace: treat runs of whitespace as a single space (descendant combinator)
    if (!inBracket && /\s/.test(ch)) {
      // push current token, then push a single space if last token isn't a space
      pushBuf();
      if (tokens.length === 0 || tokens[tokens.length - 1] !== " ") {
        tokens.push(" ");
      }
      // skip adding this whitespace to buffer
      // also skip accumulating multiple spaces
      // continue to next char
      // (do not add ch to buf)
      // note: this preserves a single ' ' as descendant combinator
      continue;
    }

    // default: append char to buffer
    buf += ch;
  }

  // push leftover
  pushBuf();

  // Convert tokens: class tokens that include [...] become attribute selectors
  const converted = tokens
    .map((tok) => {
      // class token (starts with a dot)
      if (tok.startsWith(".")) {
        const cls = tok.slice(1);
        if (cls.includes("[") && cls.includes("]")) {
          // keep the full class string inside the attribute selector
          return `[class*="${cls}"]`;
        }
        return `.${cls}`;
      }
      // otherwise return token as-is (combinator, space, tag, pseudo, etc.)
      return tok;
    })
    .join("");

  // cleanup: collapse multiple spaces to single, trim ends
  return converted.replace(/\s+/g, " ").trim();
}

function generalizeSelector(sel) {
  return sel
    .replace(/:nth-child\(\s*\d+\s*\)/g, "")
    .replace(/:nth-of-type\(\s*\d+\s*\)/g, "")
    .replace(/:(first|last)-child/g, "")
    .replace(/\s*>\s*/g, " > ") // normalize combinator spacing
    .replace(/\s+/g, " ") // collapse extra spaces
    .trim();
}

// const applyKeywords = [
//   "apply",
//   "more",
//   "view job",
//   "submit",
//   "view featured job",
// ];

// async function findNavigationFromParents(startHandle, text, page) {
//   let current = startHandle;
//   const urlBefore = page.url();
//   let keywords = [...applyKeywords, text.toLowerCase()];

//   while (current) {
//     let descendants = await current.$$(":scope a, :scope button");
//     descendants.push(current);

//     for (const el of descendants) {
//       if (current != startHandle) {
//         if (el == current) keywords = [...applyKeywords, text.toLowerCase()];
//         else keywords = applyKeywords;
//       }
//       try {
//         const tag = await el.evaluate((el) => el.tagName.toLowerCase());
//         const textContent = await el.evaluate((el) =>
//           el.textContent.toLowerCase(),
//         );

//         if (tag === "a" && keywords.some((kw) => textContent.includes(kw))) {
//           const href = await el.getAttribute("href");
//           if (href) {
//             return href;
//           }
//         }

//         if (
//           tag === "button" &&
//           keywords.some((kw) => textContent.includes(kw))
//         ) {
//           try {
//             if (await el.isVisible()) {
//               await el.scrollIntoViewIfNeeded();
//               const [response] = await Promise.all([
//                 page
//                   .waitForNavigation({
//                     waitUntil: "domcontentloaded",
//                     timeout: 5000,
//                   })
//                   .catch(() => null),
//                 el.click().catch(() => null),
//               ]);

//               const newUrl = page.url();
//               if (newUrl !== urlBefore) {
//                 // Navigation succeeded
//                 await page.waitForLoadState("domcontentloaded"); // ✅ wait for full load
//                 await page.goBack({ waitUntil: "domcontentloaded" });
//                 await page.waitForTimeout(10000);
//                 return newUrl;
//               }
//             }
//           } catch (e) {
//             console.warn("Click failed or no navigation:", e.message);
//           }
//         }
//       } catch (error) {
//         console.warn("Skipping descendant due to error:", error.message);
//       }
//     }

//     // Go up one level in the DOM
//     current = await current.evaluateHandle((el) => el.parentElement);
//     current = current.asElement(); // convert from JSHandle to ElementHandle

//     if (!current) break; // Exit if no more parent elements
//   }

//   return null;
// }

async function findItem(page, selector) {
  const jobAnchor = [];
  let i = 0;

  while (true) {
    let candidates;
    try {
      try {
        console.log(selector);
        candidates = await page.$$(selector);
      } catch (err) {
        if (err.message.includes("Execution context was destroyed")) {
          console.warn("⏳ Retrying after context destruction...");
          await page.waitForLoadState("domcontentloaded"); // give time to settle
          candidates = await page.$$(selector); // retry once
        } else {
          throw err;
        }
      }
    } catch (err) {
      console.warn(
        "⚠️ Failed to query candidates after navigation:",
        err.message,
      );
      break; // Prevent infinite loop on persistent failure
    }

    let restarted = false;

    console.log("candidates", candidates.length);

    for (; i < candidates.length; i++) {
      let a = candidates[i];

      try {
        if (!a) continue;

        // const { text, attrs, show } = await a.evaluate((el) => {
        //   const attrs = {};
        //   let show = true;

        //   for (const attr of el.attributes) {
        //     if (
        //       ["display", "opacity", "visibility"].includes(attr.name) &&
        //       attr.value === "none"
        //     )
        //       show = false;
        //     if (!["href", "class"].includes(attr.name)) {
        //       attrs[attr.name] = attr.value;
        //     }
        //   }

        //   return {
        //     text: el.textContent.trim(),
        //     attrs,
        //     show,
        //   };
        // });

        // if (!show || !text) continue;

        let href = await a.getAttribute("href");
        // if (!href) {
        //   // ⚠️ May cause navigation — restart loop
        //   href = await findNavigationFromParents(a, text, page);
        //   if (href && text !== href) {
        //     jobAnchor.push({ text, href, attrs });
        //   } else if (href == null) {
        //     jobAnchor.push({ text: text, href: text + i, attrs: attrs });
        //   }
        //   restarted = true;
        //   i++;
        //   break; // Exit inner loop; restart everything
        // } else if (text !== href) {
        //   jobAnchor.push({ text, href, attrs });
        // }
        jobAnchor.push(href);
      } catch (err) {
        console.warn(`⚠️ Skipped candidate due to:`, err.message);
      }
    }

    if (!restarted) break; // Exit outer loop if no nav happened
  }

  return jobAnchor;
}

const Scraper = async (name, url, apiKey, step, links, selector) => {
  console.log("url", url);
  if (!isValidUrl(url)) {
    console.warn("⚠️ Invalid or missing URL provided:", url);
    return { found: 1, jobs: "[]" };
  }
  // const openai = new OpenAI({ apiKey: apiKey });

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

  let urlcontext = [],
    prompt = "";
  if (url.includes("linkedin")) {
    // const linkedinurlforAll = fs.readFileSync("linkedinurlforAll.txt", "utf8");
    // let companyName = "";
    // const parsedUrl = new URL(url);
    // const segments = parsedUrl.pathname.split("/").filter(Boolean); // remove empty
    // // Look for the segment following 'company'
    // const idx = segments.indexOf("company");
    // if (idx !== -1 && segments.length > idx + 1) {
    //   companyName = segments[idx + 1];
    // }
    // // Normalize LinkedIn company URL to the company profile page
    // // e.g. convert https://www.linkedin.com/company/moonee/jobs/ -> https://www.linkedin.com/company/moonee/
    // let companyProfileUrl = null;
    // if (companyName) {
    //   companyProfileUrl = `${parsedUrl.protocol}//${parsedUrl.host}/company/${companyName}/`;
    //   // use the profile URL for subsequent API calls that expect the company page
    //   url = companyProfileUrl;
    // }
    // const jobPageUrl = JSON.parse(linkedinurlforAll);
    // let snapshot_id;
    // if (!jobPageUrl[companyName]) {
    //   await axios
    //     .post(
    //       `https://api.brightdata.com/datasets/v3/trigger?dataset_id=gd_l1vikfnt1wgvvqz95w&include_errors=true`,
    //       { url: url },
    //       {
    //         headers: {
    //           Authorization: `Bearer ${brightKey}`,
    //           "Content-Type": "application/json",
    //         },
    //       },
    //     )
    //     .then((response) => {
    //       snapshot_id = response.data.snapshot_id;
    //       console.log(response.data);
    //     })
    //     .catch((error) => console.error(error));
    //   for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    //     try {
    //       console.log(`⏳ Attempt ${attempt}: Fetching snapshot data...`);
    //       const response = await axios.get(
    //         `https://api.brightdata.com/datasets/v3/snapshot/${snapshot_id}?format=json`,
    //         {
    //           headers: {
    //             Authorization: `Bearer ${brightKey}`,
    //           },
    //           timeout: 15000, // 15s timeout to avoid hanging
    //         },
    //       );
    //       if (response.status === 200) {
    //         console.log("✅ Snapshot is ready! Data:");
    //         companyData = response.data;
    //         console.log("Data:", companyData);
    //         jobPageUrl[companyName] =
    //           `https://www.linkedin.com/jobs/${companyData[0].name.replace(/\s+/g, "")}-jobs-worldwide?f_C=${companyData[0].company_id}`;
    //         fs.writeFileSync(
    //           "linkedinurlforAll.txt",
    //           JSON.stringify(jobPageUrl, null, 2),
    //           "utf8",
    //         );
    //         break;
    //       } else {
    //         console.log(
    //           "⚠️ Snapshot not ready yet (empty response), retrying...",
    //         );
    //       }
    //     } catch (err) {
    //       console.log(`⚠️ Error on attempt ${attempt}: ${err.message}`);
    //       break;
    //     }
    //     // Wait before next try
    //     await delay(DELAY_MS);
    //   }
    // }
    // if (!jobPageUrl[companyName]) return { found: 1, jobs: "[]" };
    // await axios
    //   .post(
    //     "https://api.brightdata.com/datasets/v3/trigger?dataset_id=gd_lpfll7v5hcqtkxl6l&include_errors=true&type=discover_new&discover_by=url",
    //     { url: jobPageUrl[companyName] },
    //     {
    //       headers: {
    //         Authorization:
    //           "Bearer 00af2aac5429b88e7c595f0090606d12abae32445f73502e3503ea37b724c9ad",
    //         "Content-Type": "application/json",
    //       },
    //     },
    //   )
    //   .then((response) => {
    //     console.log(response.data);
    //     snapshot_id = response.data.snapshot_id;
    //   })
    //   .catch((error) => console.error(error));
    // let jobAnchors = [];
    // for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    //   try {
    //     console.log(`⏳ Attempt ${attempt}: Fetching snapshot data...`);
    //     const response = await axios.get(
    //       `https://api.brightdata.com/datasets/v3/snapshot/${snapshot_id}?format=json`,
    //       {
    //         headers: {
    //           Authorization: `Bearer ${brightKey}`,
    //         },
    //         timeout: 15000, // 15s timeout to avoid hanging
    //       },
    //     );
    //     if (response.status === 200) {
    //       console.log("✅ Snapshot is ready! Data:");
    //       jobAnchors = response.data.filter(
    //         (item, index, arr) =>
    //           index === arr.findIndex((x) => x.url === item.url),
    //       );
    //       console.log("Data:", jobAnchors);
    //       break;
    //     } else {
    //       console.log(
    //         "⚠️ Snapshot not ready yet (empty response), retrying...",
    //       );
    //     }
    //   } catch (err) {
    //     console.log(`⚠️ Error on attempt ${attempt}: ${err.message}`);
    //     break;
    //   }
    //   // Wait before next try
    //   await delay(DELAY_MS);
    // }
    // console.log("jobAnchors", jobAnchors.length);
    // let json = jobAnchors
    //   .filter(
    //     (a) =>
    //       !(Array.isArray(links) ? links : []).some(
    //         (l) => l && l.includes(a.url),
    //       ),
    //   )
    //   .map((a) => {
    //     return { title: a.job_title, company: a.company_name, link: a.url };
    //   });
    // const removed = (Array.isArray(links) ? links : []).filter(
    //   (l) =>
    //     l &&
    //     !(Array.isArray(jobAnchors) ? jobAnchors : []).some((j) =>
    //       l.includes(j.url),
    //     ),
    // );
    // console.log("Parsed JSON:", json.length);
    // page.close();
    // return {
    //   found: 1,
    //   jobs: JSON.stringify(json),
    //   removed: JSON.stringify(removed),
    // };
  } else {
    // if (
    //   step == 1 &&
    //   !url.includes("apply.workable.com") &&
    //   !url.includes("comeet.com")
    // ) {
    let domain = new URL(url).hostname;
    if (!domain.startsWith("http")) {
      domain = "https://" + domain;
    }
    //   const urlforAll = fs.readFileSync("urlforAll.txt", "utf8");
    //   const parsedUrl = JSON.parse(urlforAll);
    //   console.log("parsedUrl", parsedUrl[domain]);
    //   if (parsedUrl[domain]) url = parsedUrl[domain];
    //   else {
    //     const query = `site:${domain} careers jobs apply`;
    //     console.log("Using SERPAPI_KEY:", process.env.SERPAPI_KEY);

    //     const serpRes = await axios.get("https://serpapi.com/search", {
    //       params: {
    //         api_key: process.env.SERPAPI_KEY,
    //         engine: "google",
    //         q: query,
    //         num: 10,
    //       },
    //     });
    //     const serpLinks = serpRes.data.organic_results || [];
    //     let prompt = `
    //       A user is looking for the most direct job listings page on this company's website (${domain}).
    //       Here are candidate URLs from a Google search:

    //       ${serpLinks.map((l) => `- ${l.title}: ${l.link}`).join("\n")}

    //       Return only the single best URL that:
    //       - Lists all current job openings
    //       - Links each job to a detail/apply page
    //       - Do not explain or add text, only return the URL.
    //       - Please attach https:// to the URL if it is not already included
    //       `;
    //     let chatResponse = await openai.chat.completions.create({
    //       model: "gpt-4-turbo",
    //       messages: [{ role: "user", content: prompt }],
    //       temperature: 0.2,
    //     });
    //     url = chatResponse.choices[0].message.content.trim();
    //     parsedUrl[domain] = url;
    //     fs.writeFileSync(
    //       "urlforAll.txt",
    //       JSON.stringify(parsedUrl, null, 2),
    //       "utf8",
    //     );
    //   }
    // }
    console.log("refined url : ", url);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 300000 });

    await page.waitForTimeout(12000);

    // await page.evaluate(() => {
    //   const button = Array.from(document.querySelectorAll("button")).find(
    //     (btn) => btn.textContent.trim().toLowerCase() === "accept all",
    //   );
    //   if (button) button.click();
    // });

    // Scroll to the bottom multiple times to trigger lazy loading
    for (let i = 0; i < 10; i++) {
      await page.mouse.wheel(0, 3000); // Simulate scrolling
      await page.waitForTimeout(2000); // Wait for the content to load (adjust time as needed)
    }

    // Loop through all iframes
    const frames = page.frames();
    // let result = {}
    // newpageList = [];
    // let clickable = [];
    // for (const frame of frames) {
    //   let frameAnchors = {};
    //   try {
    //     if (
    //       step == 1 &&
    //       !url.includes("kelloggcareers") &&
    //       !url.includes("fixify") &&
    //       !url.includes("spikerz")
    //     ) {
    //       const navigatingElements = await frame.$$("a");
    //       for (const handle of navigatingElements) {
    //         const text = await handle.evaluate((el) =>
    //           el.textContent.toLowerCase().trim(),
    //         );
    //         const target = await handle.getAttribute("target");
    //         const href = await handle.getAttribute("href");
    //         // if (viewJobs(text) && target == '_blank' && await handle.isVisible()) console.log(text, href, viewJobs(text));

    //         if (
    //           viewJobs(text) &&
    //           target == "_blank" &&
    //           (await handle.isVisible())
    //         ) {
    //           if (!newpageList.includes(href)) newpageList.push(href);
    //         }
    //       }
    //     }

    //     let clickableElements = await frame.$$("a, button");
    //     for (const handle of clickableElements) {
    //       if (!(await handle.isVisible())) continue;
    //       const text = await handle.evaluate((el) =>
    //         el.textContent.toLowerCase().trim(),
    //       );
    //       const target = await handle.getAttribute("target");

    //       if (viewJobs(text) && target != "_blank") {
    //         clickable.push(handle);
    //         console.log("clicked texts --> ", text);
    //       }
    //     }

    //     if (
    //       clickable.length > 0 &&
    //       frame == page.mainFrame() &&
    //       !page.url().includes("tellent")
    //     ) {
    //       for (let i = 0; i < clickable.length; i++) {
    //         try {
    //           clickable = [];
    //           const clickableElements = await frame.$$("a, button");
    //           for (const handle of clickableElements) {
    //             if (!(await handle.isVisible())) continue;
    //             const text = await handle.evaluate((el) =>
    //               el.textContent.toLowerCase().trim(),
    //             );
    //             const target = await handle.getAttribute("target");

    //             if (viewJobs(text) && target != "_blank")
    //               clickable.push(handle);
    //           }
    //           if (
    //             (await clickable[i].isVisible()) &&
    //             (await clickable[i].evaluate((el) =>
    //               document.body.contains(el),
    //             ))
    //           ) {
    //             // Scroll to the link and click it
    //             await clickable[i].scrollIntoViewIfNeeded();
    //             let beforeUrl = page.url();
    //             await clickable[i].click();
    //             await page.waitForTimeout(7000); // Wait for the new frame to load

    //             // Extract all anchor elements from the new frame
    //             let clickResult = await page.evaluate(() => {
    //               const candidates = Array.from(
    //                 document.body.querySelectorAll(
    //                   "h1, h2, h3, h4, h5, p, a, span, div, td",
    //                 ),
    //               );

    //               const classMap = {};
    //               const getClassName = (el) => {
    //                 let eclassName = el.className?.trim() || el.tagName?.trim();
    //                 if (eclassName[0] == '"')
    //                   eclassName = eclassName.slice(1, -1);
    //                 if (el.className)
    //                   return "." + eclassName.split(/\s+/).join(".");
    //                 else if (el.tagName) return eclassName;
    //                 else return "";
    //               };

    //               for (const el of candidates) {
    //                 let pel = el.parentElement;
    //                 let pclassName = getClassName(pel),
    //                   eclassName = getClassName(el);
    //                 const className = pclassName
    //                   ? pclassName + " > " + eclassName
    //                   : eclassName;

    //                 // Get all attributes as a key-value object
    //                 const attrs = {};
    //                 let text = "";
    //                 for (const node of el.childNodes) {
    //                   if (node.nodeType === Node.TEXT_NODE) {
    //                     text += node.textContent.trim();
    //                   }
    //                 }
    //                 for (const attr of el.attributes) {
    //                   attrs[attr.name] = attr.value;
    //                 }

    //                 if (text != "") {
    //                   // Normalize: only group elements with class (or use placeholder for none)
    //                   if (!classMap[className]) {
    //                     classMap[className] = [];
    //                   }
    //                   classMap[className].push({
    //                     textContent: text.trim(),
    //                     attributes: attrs,
    //                   });
    //                 }
    //               }
    //               // Convert to desired array of objects
    //               return Object.entries(classMap).map(
    //                 ([className, elements]) => ({
    //                   className,
    //                   elements,
    //                 }),
    //               );
    //             });

    //             // Add the extracted anchors to the jobAnchors array
    //             clickResult.map((a) => {
    //               if (!frameAnchors[a.className]) {
    //                 frameAnchors[a.className] = [];
    //               }
    //               a.elements?.map((a_el) => {
    //                 if (!frameAnchors[a.className].includes(a_el))
    //                   frameAnchors[a.className].push(a_el);
    //               });
    //             });
    //             // Go back to the previous page
    //             console.log(page.url(), " --- ", beforeUrl);
    //             if (page.url() != beforeUrl) {
    //               await page.goBack({ waitUntil: "domcontentloaded" }); // Ensure the page is fully loaded before continuing
    //               await page.waitForTimeout(8000);
    //             }
    //           }
    //         } catch (error) {
    //           console.log(`Error processing clickable[${i}]:`, error.message);
    //         }
    //       }
    //       // Add the extracted anchors to the jobAnchors array
    //       frameAnchors = Object.entries(frameAnchors).map(
    //         ([className, elements]) => ({
    //           className,
    //           elements,
    //         }),
    //       );
    //       // Add the extracted anchors to the jobAnchors array
    //       frameAnchors.map((a) => {
    //         if (!result[a.className]) result[a.className] = [];
    //         a.elements?.map((a_el) => {
    //           if (!result[a.className].includes(a_el))
    //             result[a.className].push(a_el);
    //         });
    //       });
    //     }
    //     // Try to get visible text from iframe body
    //     frameAnchors = await frame.evaluate(() => {
    //       // Extract all anchor elements from the new frame
    //       const candidates = Array.from(
    //         document.body.querySelectorAll(
    //           "h1, h2, h3, h4, h5, p, a, span, div, td",
    //         ),
    //       );

    //       const classMap = {};

    //       const getClassName = (el) => {
    //         let eclassName = el.className?.trim() || el.tagName?.trim();
    //         if (eclassName[0] == '"') eclassName = eclassName.slice(1, -1);
    //         if (el.className) return "." + eclassName.split(/\s+/).join(".");
    //         else if (el.tagName) return eclassName;
    //         else return "";
    //       };

    //       for (const el of candidates) {
    //         let pel = el.parentElement;
    //         let pclassName = getClassName(pel),
    //           eclassName = getClassName(el);
    //         const className = pclassName
    //           ? pclassName + " > " + eclassName
    //           : eclassName;

    //         // Get all attributes as a key-value object
    //         const attrs = {};
    //         let text = "";
    //         for (const node of el.childNodes) {
    //           if (node.nodeType === Node.TEXT_NODE) {
    //             text += node.textContent.trim();
    //           }
    //         }
    //         for (const attr of el.attributes) {
    //           attrs[attr.name] = attr.value;
    //         }
    //         if (text != "") {
    //           // Normalize: only group elements with class (or use placeholder for none)
    //           if (!classMap[className]) {
    //             classMap[className] = [];
    //           }
    //           classMap[className].push({
    //             textContent: text.trim(),
    //             attributes: attrs,
    //           });
    //         }
    //       }
    //       // Convert to desired array of objects
    //       return classMap;
    //     });
    //   } catch (e) {
    //     // Some iframes may block access (e.g., cross-origin) — ignore safely
    //     console.warn(`⚠️ Could not read iframe from ${frame.url()}`);
    //   }
    //   // Add the extracted anchors to the jobAnchors array
    //   frameAnchors = Object.entries(frameAnchors).map(
    //     ([className, elements]) => ({
    //       className,
    //       elements,
    //     }),
    //   );
    //   console.log("initial-frameAnchors", frameAnchors.length);
    //   // Add the extracted anchors to the jobAnchors array
    //   frameAnchors.map((a) => {
    //     if (!result[a.className]) result[a.className] = [];
    //     a.elements?.map((a_el) => {
    //       if (!result[a.className].includes(a_el))
    //         result[a.className].push(a_el);
    //     });
    //   });
    // }

    // if (step == 1) {
    //   console.log("newpage", newpageList);
    //   if (newpageList.length > 0)
    //     return { found: 0, matches: JSON.stringify(newpageList) };
    // }

    // result = Object.entries(result).map(([className, elements]) => ({
    //   className,
    //   elements,
    // }));

    // let groups = result
    //   .map((item, idx) => {
    //     const lines = item.elements
    //       .slice(0, 2)
    //       .map((el) => `   - "${el.textContent.trim()}"`)
    //       .join("\n");
    //     return `${idx + 1}. Class: "${item.className}"\n${lines}`;
    //   })
    //   .join("\n\n");

    // groups = groups.slice(0, 40000);
    // fs.writeFileSync("groups.txt", groups);

    // const fullPrompt = `
    // You are given multiple groups of text content from a job listing page, grouped by the HTML class name or tag name they come from.

    // Each group looks like this:

    // ${groups}

    // Among these, which class name or tag name contains the group of texts that are mostly like job titles? Only respond with the class name or tag name as string array.
    // If there is no one similar with job only please ouput empty array.`;

    // const response = await openai.chat.completions.create({
    //   model: "gpt-4",
    //   messages: [{ role: "user", content: fullPrompt }],
    //   temperature: 0.2,
    // });
    // const selectorResponse = response.choices[0].message.content.trim();

    // Optional: parse the string array to real JS array
    // let selectorArray;
    // try {
    //   selectorArray = JSON.parse(selectorResponse);
    // } catch (e) {
    //   console.error("Could not parse result:", selectorResponse);
    //   selectorArray = [];
    // }

    // console.log("selectorArray", selectorArray);

    // let selector = "";

    // Handling no href case
    // if (page.url().includes("pomvom")) {
    //   selector = "div.target-job-title.text-xl.font-semibold";
    //   let candidates = [],
    //     jobs = [];
    //   try {
    //     try {
    //       console.log("Querying selector:", selector);
    //       // First try main frame
    //       candidates = await page.$$(selector);
    //       console.log("Main frame found:", candidates.length);

    //       // If main frame returns nothing, try all frames
    //       if (candidates.length === 0) {
    //         console.log("Trying frames...");
    //         const allFrames = page.frames();
    //         for (const frame of allFrames) {
    //           try {
    //             const frameCandidates = await frame.$$(selector);
    //             if (frameCandidates.length > 0) {
    //               console.log(
    //                 `Found ${frameCandidates.length} in frame: ${frame.url()}`,
    //               );
    //               candidates = frameCandidates;
    //               break;
    //             }
    //           } catch (e) {
    //             // Frame might be cross-origin, skip
    //             continue;
    //           }
    //         }
    //       }
    //     } catch (err) {
    //       if (err.message.includes("Execution context was destroyed")) {
    //         console.warn("⏳ Retrying after context destruction...");
    //         await page.waitForLoadState("domcontentloaded"); // give time to settle
    //         candidates = await page.$$(selector); // retry once
    //       } else {
    //         throw err;
    //       }
    //     }
    //   } catch (err) {
    //     console.warn(
    //       "⚠️ Failed to query candidates after navigation:",
    //       err.message,
    //     );
    //   }

    //   console.log("candidates found:", candidates.length);

    //   for (let i = 0; i < candidates.length; i++) {
    //     let a = candidates[i];
    //     try {
    //       if (!a) continue;
    //       const { title, company, link } = await a.evaluate((el, url) => {
    //         const attrs = {};

    //         for (const attr of el.attributes) {
    //           attrs[attr.name] = attr.value;
    //         }

    //         return {
    //           title: el.textContent.trim(),
    //           company: "",
    //           link: attrs["href"] || url,
    //         };
    //       }, url);
    //       jobs.push({ title, company, link });
    //     } catch (err) {
    //       console.warn(`⚠️ Skipped candidate due to:`, err.message);
    //     }
    //   }
    //   const removed = (Array.isArray(links) ? links : []).filter(
    //     (l) =>
    //       l &&
    //       !(Array.isArray(jobs) ? jobs : []).some((j) => l.includes(j.link)),
    //   );
    //   jobs = jobs.filter(
    //     (a) =>
    //       !(Array.isArray(links) ? links : []).some(
    //         (l) => l && l.includes(a.link),
    //       ),
    //   );
    //   return {
    //     found: 1,
    //     jobs: JSON.stringify(jobs),
    //     removed: JSON.stringify(removed),
    //   };
    // } else {
    //   if (selectorArray.length == 0) return { found: 1, jobs: "[]" };
    //   for (predictedClassName of selectorArray) {
    //     selector += predictedClassName + ",";
    //   }
    //   if (selector.at(-1) == ",") selector = selector.slice(0, -1);

    //   if (page.url().includes("radiflow")) selector = "a";
    //   else if (page.url().includes("atakama"))
    //     selector =
    //       ".wp-block-group.wow.fadeIn.is-layout-constrained.wp-container-core-group-is-layout-c9f28598.wp-block-group-is-layout-constrained > h3";
    //   // else if (page.url().includes("appcharge")) selector = `[class*="text-[1.8rem]"][class*="leading-[1.1]"][class*="tracking-[-.056rem]"].font-semibold`;
    // }
    // console.log("Final selector:", selector);

    selector = await convertToAttributeSelector(selector);
    console.log("Converted selector:", selector);
    selector = await generalizeSelector(selector);
    console.log("Generalized selector:", selector);
    let jobAnchors = await findItem(page, selector);

    console.log("Initial jobAnchors", jobAnchors);
    const beforeUrl = page.url();
    for (let i = 0; ; i++) {
      try {
        clickableElements = await page.$$("a, button");
        let readNextPage = false;
        for (const handle of clickableElements) {
          if (!(await handle.isVisible())) continue;
          const text = await handle.evaluate((el) =>
            el.textContent.toLowerCase().trim(),
          );
          const target = await handle.getAttribute("target");

          if (isPageNumber(text, i + 1) && target != "_blank") {
            const el = handle;

            console.log(i, "...", await el.isVisible());

            if (
              (await el.isVisible()) &&
              (await el.evaluate((el) => document.body.contains(el)))
            ) {
              console.log(
                "Attempting to click element:",
                await el.evaluate((el) => el.outerHTML),
              );
              await el.scrollIntoViewIfNeeded();
              await page.waitForTimeout(500); // Give time to settle

              // Wait for clickable state
              await el.waitForElementState("stable");

              // await page.evaluate(el => el.dispatchEvent(new MouseEvent('click', { bubbles: true })), el);
              // console.log("Clicking element...", el);

              // Try force click first, fallback to JavaScript evaluation
              try {
                await page.evaluate((element) => element.click(), el);
              } catch (clickErr) {
                console.log(
                  "Regular click failed, trying JavaScript evaluation...",
                );
                await page.evaluate((element) => element.click(), el);
              }

              await page.waitForLoadState("domcontentloaded"); // Extra safety
              await page.waitForTimeout(8000);

              // Process the new page content
              const itemAnchors = await findItem(page, selector);
              for (const a of itemAnchors) {
                if (!jobAnchors.some((j) => j === a)) {
                  jobAnchors.push(a);
                }
              }
            }
            readNextPage = true; // Only click one pagination link at a time
          }
        }
        if (!readNextPage) break; // Exit loop if no pagination link was found/clicked
      } catch (error) {
        console.log(`❌ Error processing clickable[${i}]:`, error.message);
      }
    }
    if (beforeUrl != page.url()) {
      // Try going back only if there was navigation
      await page.goto(beforeUrl, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(4000);
    }
    for (const frame of frames) {
      if (frame === page.mainFrame()) continue;
      const frameUrl = frame.url();
      console.log("frameUrl", frameUrl);
      if (!isValidUrl(frameUrl)) continue;
      console.log("Valid frame URL:", !isValidUrl(frameUrl));

      let frameAnchors = [];

      try {
        // Open iframe in a new page to bypass cross-origin issues
        const iframePage = await page.context().newPage();
        await iframePage.goto(frameUrl, {
          waitUntil: "domcontentloaded",
          timeout: 10000,
        });
        await iframePage.waitForTimeout(7000);

        const elements = await (await iframePage.$("body")).$$(selector);

        frameAnchors = await findItem(iframePage, selector);
        console.log(`🧲 Extracted ${frameAnchors.length} items`);

        await iframePage.close();
      } catch (e) {
        console.warn(`⚠️ Could not read iframe: ${e.message}`);
        continue;
      }

      // Add the extracted anchors to the jobAnchors array
      frameAnchors.forEach((a) => jobAnchors.push(a));
    }

    console.log("Extracted jobAnchors before URL normalization:", jobAnchors);
    console.log('domain', domain);
    jobAnchors = jobAnchors.map((a) => {
      return a.includes("http") ? a : new URL(a, domain).href;
    });
    console.log("links -> ", links);
    urlcontext = (Array.isArray(jobAnchors) ? jobAnchors : [])
      .filter(
        (a) =>
          a &&
          !(Array.isArray(links) ? links : []).some((l) => l && l.includes(a)),
      )
      .map((a) => {
        return !a
          ? { title: "", company: "", link: url }
          : { title: "", company: "", link: a };
      });

    const removed = (Array.isArray(links) ? links : []).filter(
      (l) =>
        l &&
        !(Array.isArray(jobAnchors) ? jobAnchors : []).some((j) =>
          l.includes(j),
        ),
    );
    fs.writeFileSync("job_links_for_llm.txt", urlcontext.join("\n"), "utf8");

    //     const index = url.lastIndexOf("#");
    //     index != -1 ? url.slice(0, index) : url;

    //     // here href might not be full url like "/jobs/senior-antenna-array-design-engineer-1", in this case it should be combined with base url
    //     let prefixNeeded =
    //       Array.isArray(jobAnchors) &&
    //       jobAnchors.length > 0 &&
    //       typeof jobAnchors[0].href === "string" &&
    //       !jobAnchors[0].href.includes("http");
    //     prefixNeeded
    //       ? (prompt = `Below is data related to job postings with the format (content — href — parent_href).
    //   "${urlcontext}"
    //   if ${urlcontext} is empty or contains no columns related to job, return an empty array [].
    //   Extract all job postings in JSON format with the following fields:
    //   - title: Extracted from the content
    //   - company: Extracted from the href (if available)
    //   - link: A valid, full URL of the company relating to href and parent_href.

    //   Output in the following JSON format:
    //   [
    //     {
    //       "title": "Job Title",
    //       "company": "Company Name",
    //       "link": "Full Job Posting URL"
    //     },
    //     ...
    //   ]`)
    //       : (prompt = `Below is data related to job postings with the format (content — href).
    // "${urlcontext}"

    // If ${urlcontext} is empty or contains no job-related rows, return an empty array [].

    // Extract all job postings in JSON format with the following fields:

    // - title: Extracted from the content
    // - company: Extracted from the href text if it contains the company name; otherwise leave as an empty string.
    // - link: **Use the href EXACTLY as provided in the input. DO NOT modify it, DO NOT prepend ${new URL(url).hostname}, and DO NOT transform it.**

    // Important rules:
    // - Do NOT combine href with ${new URL(url).hostname}.
    // - Do NOT generate or guess URLs.
    // - Do NOT rewrite or complete the href. Use it exactly as-is.
    // - Only output JSON.

    // Output format:
    // [
    //   {
    //     "title": "Job Title",
    //     "company": "Company Name",
    //     "link": "Exact href provided"
    //   }
    // ]
    // `);
    // const res = await openai.chat.completions.create({
    //   model: "gpt-4o",
    //   messages: [{ role: "user", content: prompt }],
    //   temperature: 0,
    // });

    // let json = [];
    // try {
    //   const rawContent = res.choices[0].message.content || "";

    //   // First, try to extract JSON from markdown code blocks
    //   let jsonStr = null;

    //   // Try to match ```json ... ``` or ``` ... ```
    //   const codeBlockMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    //   if (codeBlockMatch && codeBlockMatch[1]) {
    //     jsonStr = codeBlockMatch[1].trim();
    //   } else {
    //     // If no code block, try to find a JSON array by matching balanced brackets
    //     // Find the first [ and then find the matching ]
    //     let bracketCount = 0;
    //     let startIndex = rawContent.indexOf("[");
    //     if (startIndex !== -1) {
    //       for (let i = startIndex; i < rawContent.length; i++) {
    //         if (rawContent[i] === "[") bracketCount++;
    //         if (rawContent[i] === "]") bracketCount--;
    //         if (bracketCount === 0) {
    //           jsonStr = rawContent.substring(startIndex, i + 1).trim();
    //           break;
    //         }
    //       }
    //     }
    //   }

    //   if (jsonStr) {
    //     // Clean up the JSON string - remove any trailing text after the closing bracket
    //     // Find the last valid closing bracket
    //     let lastBracketIndex = jsonStr.lastIndexOf("]");
    //     if (lastBracketIndex !== -1) {
    //       jsonStr = jsonStr.substring(0, lastBracketIndex + 1);
    //     }
    //     json = JSON.parse(jsonStr);
    //   } else {
    //     console.log("No JSON array found in response");
    //   }
    // } catch (error) {
    //   page.close();
    //   console.log("Error parsing JSON:", error.message);
    //   return { found: 1, jobs: "[]" };
    // }
    // console.log("Parsed JSON:", json.length);

    // page.close();

    return {
      found: 1,
      jobs: JSON.stringify(urlcontext),
      removed: JSON.stringify(removed),
    };
  }
};

module.exports = Scraper;
