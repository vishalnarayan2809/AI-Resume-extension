// Content script: scrape job description from active page
console.log('[AI-Resume] content script loaded');

function extractJobDescription() {
  // Heuristics: look for common selectors; fallback to full text with limits
  const selectors = [
    '[data-test="jobDescriptionText"]',
    '#jobDescriptionText',
    '.jobsearch-JobComponent-description',
    '.jobs-description',
    '.job-description',
    '.description',
    '[class*="description"]',
    '[class*="job-detail"]',
    '[class*="posting"]',
    'article',
    'main',
    '.content'
  ];
  
  // Try each selector and get the longest meaningful content
  let bestContent = '';
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && el.innerText) {
      const text = el.innerText.trim();
      if (text.length > bestContent.length && text.length > 300) {
        bestContent = text;
      }
    }
  }
  
  // If we found good content via selectors, use it
  if (bestContent.length > 1000) {
    return bestContent.substring(0, 25000).trim(); // Increased limit
  }
  
  // Fallback: try to extract from body but filter out navigation/footer noise
  const bodyText = document.body?.innerText || '';
  const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 10);
  
  // Look for job description markers
  let startIdx = -1;
  let endIdx = lines.length;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    if (line.includes('job description') || 
        line.includes('about this role') || 
        line.includes('responsibilities') ||
        line.includes('what you') ||
        line.includes('requirements')) {
      startIdx = Math.max(0, i - 2); // Include some context
      break;
    }
  }
  
  // Find likely end markers
  for (let i = Math.max(0, startIdx); i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    if (line.includes('apply now') || 
        line.includes('similar jobs') ||
        line.includes('related jobs') ||
        line.includes('footer') ||
        line.includes('copyright')) {
      endIdx = i;
      break;
    }
  }
  
  if (startIdx >= 0) {
    const extracted = lines.slice(startIdx, endIdx).join('\n');
    return extracted.substring(0, 25000).trim(); // Increased limit
  }
  
  // Final fallback: just take body text with increased limit
  return bodyText.substring(0, 25000).trim();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'SCRAPE_JOB_DESCRIPTION') {
    try {
      const jd = extractJobDescription();
      console.log('[AI-Resume] Scraped job description:', jd.substring(0, 500) + '...');
      console.log('[AI-Resume] Full scraped length:', jd.length, 'characters');
      sendResponse({ ok: true, jobDescription: jd });
    } catch (e) {
      console.error('[AI-Resume] Scraping failed:', e);
      sendResponse({ ok: false, error: e?.message || String(e) });
    }
    return true;
  }
});