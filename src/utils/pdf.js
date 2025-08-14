// Export the currently displayed resume as a true text-based PDF with clickable links
// Strategy:
// - Prefer pdfmake: we convert the DOM into a pdfmake docDefinition preserving inline text/links
// - Fallback to html2pdf only if pdfmake fails (raster-based, non-selectable)

export async function exportHtmlToPdf(element, filename = 'resume.pdf') {
  // Preferred path: pdfmake
  try {
    // Load pdfmake and its embedded fonts (vfs)
    const pdfMakeMod = await import('pdfmake/build/pdfmake');
    const vfsMod = await import('pdfmake/build/vfs_fonts');

    const pdfMake = pdfMakeMod?.default || pdfMakeMod?.pdfMake || (typeof window !== 'undefined' ? window.pdfMake : undefined);
    const vfs = vfsMod?.default?.pdfMake?.vfs || vfsMod?.pdfMake?.vfs || (typeof window !== 'undefined' ? window.pdfMake?.vfs : undefined);
    if (!pdfMake) throw new Error('pdfmake not available');
    if (vfs) pdfMake.vfs = vfs;

    // Ensure fonts mapping is available (Roboto is bundled with vfs_fonts)
    if (!pdfMake.fonts) {
      pdfMake.fonts = {
        Roboto: {
          normal: 'Roboto-Regular.ttf',
          bold: 'Roboto-Medium.ttf',
          italics: 'Roboto-Italic.ttf',
          bolditalics: 'Roboto-MediumItalic.ttf',
        },
      };
    }

    // Determine the root of resume content (prefer iframe body > .container)
    const rootEl = (() => {
      try {
        // If element is a Document
        if (element?.nodeType === 9 && element.documentElement) return element.body || element.documentElement;
        // If element is an HTMLElement
        if (element?.nodeType === 1) return element;
      } catch {}
      return document.body;
    })();

  const resumeRoot = rootEl.querySelector?.('.container') || rootEl;

    // Helpers
  const BLOCK_TAGS = new Set(['div','p','section','article','header','footer','main','ul','ol','li','h1','h2','h3','h4','h5','h6','table','thead','tbody','tr','td','th','hr']);
    const INLINE_TAGS = new Set(['span','a','b','strong','i','em','u','small','sup','sub','code','br']);

    const normalizeSpace = (s) => s.replace(/[\t\r\n]+/g, ' ').replace(/\s{2,}/g, ' ');
    const stripIcons = (s) => {
      if (!s) return s;
      // Remove specific icons and any remaining emoji symbols
      try {
        return s
          .replace(/[📞📧🔗]/g, '')
          .replace(/\p{Extended_Pictographic}/gu, '');
      } catch {
        // Fallback if Unicode property escapes unsupported
        return s.replace(/[📞��🔗]/g, '');
      }
    };

  function collectInlineRuns(node) {
      // Returns an array of pdfmake text runs for inline content within a block
      const runs = [];
      function walk(n, inherited = {}) {
        if (!n) return;
        if (n.nodeType === Node.TEXT_NODE) {
          const text = stripIcons(normalizeSpace(n.nodeValue || ''));
          if (text) runs.push({ text, ...inherited });
          return;
        }
        if (n.nodeType === Node.ELEMENT_NODE) {
          const tag = n.tagName.toLowerCase();
          const next = { ...inherited };
          if (tag === 'b' || tag === 'strong') next.bold = true;
          if (tag === 'i' || tag === 'em') next.italics = true;
          if (tag === 'u') next.decoration = 'underline';
          if (tag === 'small') next.fontSize = Math.max((inherited.fontSize || 10) - 1, 7);
          if (tag === 'sup') next.sup = true; // We'll emulate via baseline later if needed
          if (tag === 'sub') next.sub = true;

      if (tag === 'a') {
            const href = n.getAttribute('href') || '';
            const link = href && href.trim();
            // Flatten anchor text into a single run if possible
            const anchorText = stripIcons(normalizeSpace(n.textContent || ''));
            if (anchorText) {
        runs.push({ text: anchorText, link, color: '#0073e6', decoration: 'underline', ...inherited });
            }
            return;
          }

          if (tag === 'br') {
            runs.push({ text: '\n', ...inherited });
            return;
          }

          // Default: walk children
          Array.from(n.childNodes).forEach((c) => walk(c, next));
        }
      }
      Array.from(node.childNodes).forEach((c) => walk(c));
      // Collapse adjacent newlines
      for (let i = runs.length - 2; i >= 0; i--) {
        if (runs[i].text === '\n' && runs[i + 1].text === '\n') runs.splice(i + 1, 1);
      }
      return runs.length ? runs : [{ text: '' }];
    }

    function parseBlock(node) {
      if (node.nodeType !== Node.ELEMENT_NODE) return null;
      const tag = node.tagName.toLowerCase();

      // Headings
      if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') {
        const text = stripIcons(normalizeSpace(node.textContent || ''));
        if (tag === 'h1') {
      return { text, fontSize: 19, bold: true, margin: [0, 0, 0, 2] };
        }
        if (tag === 'h2') {
          // Simulate border-bottom using a line below the heading
          return {
            stack: [
        { text, fontSize: 14, bold: true, margin: [0, 6, 0, 1] },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#dddddd' }] },
            ],
      margin: [0, 0, 0, 2],
          };
        }
    if (tag === 'h3') return { text, fontSize: 12, bold: true, margin: [0, 4, 0, 2] };
    return { text, fontSize: 11.5, bold: true, margin: [0, 3, 0, 1] };
      }

      // Paragraph-like blocks
      if (tag === 'p' || tag === 'div' || tag === 'section' || tag === 'article' || tag === 'header' || tag === 'footer' || tag === 'main') {
        // Sections: control vertical spacing similar to template
        if (node.classList?.contains('section')) {
          const stack = [];
          Array.from(node.children).forEach((c) => {
            const b = parseBlock(c);
            if (b) stack.push(b);
          });
          if (!stack.length) return null;
          return { stack, margin: [0, 0, 0, 5] };
        }

        // Contact block
        if (node.classList?.contains('contact')) {
          const runs = collectInlineRuns(node);
          if (runs.length === 1 && !runs[0].text) return null;
          return { text: runs, fontSize: 11, margin: [0, 0, 0, 5] };
        }

        // Project title styling
        if (node.classList?.contains('project-title')) {
          const runs = collectInlineRuns(node);
          if (runs.length === 1 && !runs[0].text) return null;
          return { text: runs, bold: true, fontSize: 12, margin: [0, 2, 0, 1] };
        }

        const hasBlockChildren = Array.from(node.children).some((c) => BLOCK_TAGS.has(c.tagName?.toLowerCase()));
        if (hasBlockChildren) {
          const stack = [];
          Array.from(node.children).forEach((c) => {
            const b = parseBlock(c);
            if (b) stack.push(b);
          });
          if (!stack.length) return null;
          return { stack, margin: [0, 1, 0, 3] };
        }
        const runs = collectInlineRuns(node);
        if (runs.length === 1 && !runs[0].text) return null;
  return { text: runs, margin: [0, 0.5, 0, 2] };
      }

      // Lists
      if (tag === 'ul' || tag === 'ol') {
        const items = Array.from(node.children)
          .filter((c) => c.tagName && c.tagName.toLowerCase() === 'li')
          .map((li) => {
            const hasBlockChildren = Array.from(li.children).some((c) => BLOCK_TAGS.has(c.tagName?.toLowerCase()));
            if (hasBlockChildren) {
              // Flatten nested blocks within li into a simple text run to keep structure simple
              const runs = collectInlineRuns(li);
              return { text: runs };
            }
            const runs = collectInlineRuns(li);
            return { text: runs };
          });
  return tag === 'ol' ? { ol: items, margin: [0, 0.5, 0, 2] } : { ul: items, margin: [0, 0.5, 0, 2] };
      }

      if (tag === 'li') {
        const runs = collectInlineRuns(node);
        return { text: runs };
      }

      if (tag === 'hr') {
        return { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#cccccc' }], margin: [0, 4, 0, 6] };
      }

      // Fallback: treat as paragraph
      const runs = collectInlineRuns(node);
      if (runs.length === 1 && !runs[0].text) return null;
  return { text: runs, margin: [0, 0.5, 0, 2] };
    }

    const content = [];
    // Only traverse top-level children to keep structure tidy
    const topLevel = resumeRoot?.children?.length ? Array.from(resumeRoot.children) : [resumeRoot];
    topLevel.forEach((child) => {
      const block = parseBlock(child);
      if (block) content.push(block);
    });

    const docDefinition = {
      pageSize: 'A4',
      pageOrientation: 'portrait',
  pageMargins: [14, 14, 14, 14],
      content,
  defaultStyle: { font: 'Roboto', fontSize: 11, lineHeight: 1.12 },
    };

    if (!content.length) throw new Error('Empty content for PDF');

    // Create blob and download
    const blob = await new Promise((resolve, reject) => {
      try {
        pdfMake.createPdf(docDefinition).getBlob(resolve);
      } catch (err) {
        reject(err);
      }
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    console.log('[PDF] Exported with pdfmake (selectable text + clickable links)');
    return;
  } catch (err) {
    console.warn('[PDF] pdfmake path failed, falling back to html2pdf (non-selectable):', err?.message || err);
  }

  // Fallback removed: html2pdf generates raster PDFs (non-selectable).
  // If pdfmake failed, surface the error to the user instead of producing a low-quality PDF.
  throw new Error('PDF export failed. Please try again.');
}