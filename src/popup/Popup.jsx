import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Atom } from 'react-loading-indicators';
import '../glass.css';
import { storage } from '../utils/storage';
import { exportHtmlToPdf } from '../utils/pdf';

function htmlStringToDocument(html) {
  // Sanitize minimal: ensure it starts with <html>
  if (!html || !html.trim().startsWith('<html')) return '';
  return html;
}

export default function Popup() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [html, setHtml] = useState('');
  const [provider, setProvider] = useState('groq');
  const [hasGroqKey, setHasGroqKey] = useState(false);
  const previewRef = useRef(null);
  const iframeRef = useRef(null);

  // Ensure provider fixed to groq
  useEffect(() => {
    (async () => {
      await storage.set({ AI_PROVIDER: 'groq' });
    })();
  }, []);

  useEffect(() => {
    (async () => {
  const data = await storage.get(['AI_PROVIDER', 'GROQ_API_KEY', 'POPUP_HTML_CACHE']);
  const hasGroq = !!data?.GROQ_API_KEY;
  setProvider('groq');
  setHasGroqKey(hasGroq);
      if (data?.POPUP_HTML_CACHE) {
        setHtml(data.POPUP_HTML_CACHE);
        if (iframeRef.current) iframeRef.current.srcdoc = data.POPUP_HTML_CACHE;
      }
    })();
  }, []);

  async function ensureContentInjected(tabId) {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    } catch (e) {
      // ignore injection errors; may be restricted page
    }
  }

  async function scrapeJDFromActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('No active tab');
    const url = tab.url || '';
    if (!/^https?:\/\//i.test(url)) {
      throw new Error('Unsupported page. Open a job listing on http(s) and try again.');
    }
    try {
      const res = await chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE_JOB_DESCRIPTION' });
      if (!res?.ok) throw new Error(res?.error || 'Failed to scrape');
      return res.jobDescription;
    } catch (err) {
      // Fallback: inject content script, then retry once
      await ensureContentInjected(tab.id);
      await new Promise(r => setTimeout(r, 100));
      const res2 = await chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE_JOB_DESCRIPTION' });
      if (!res2?.ok) throw new Error(res2?.error || 'Failed to scrape after injection');
      return res2.jobDescription;
    }
  }

  async function handleGenerate() {
    setError('');
    setLoading(true);
    try {
  // Guard: require Groq key
  if (!hasGroqKey) throw new Error('Add your Groq API key in Options.');
      const [profileData, jd, templateRes] = await Promise.all([
        storage.get(['userProfile', 'previousResumeText']),
        scrapeJDFromActiveTab(),
        fetch(chrome.runtime.getURL('raw_template.html')).then(r => r.text()).catch(() => ''),
      ]);

      console.log('[Popup] === DATA COLLECTION ===');
      console.log('[Popup] Profile data:', profileData);
      console.log('[Popup] Job description length:', jd?.length || 0);
      console.log('[Popup] Template loaded:', !!templateRes);
      console.log('[Popup] === SENDING TO AI ===');

      const payload = {
        profile: profileData?.userProfile || '',
        previousResume: profileData?.previousResumeText || '',
        jobDescription: jd || '',
        templateHtml: templateRes || '',
      };

      const bgRes = await chrome.runtime.sendMessage({ type: 'GENERATE_RESUME', payload });
      console.log('[Popup] AI response:', bgRes);
      if (!bgRes?.ok) throw new Error(bgRes?.error || 'AI generation failed');
  const doc = htmlStringToDocument(bgRes.html);
  setHtml(doc);
  await storage.set({ POPUP_HTML_CACHE: doc });
      // write into iframe
      if (iframeRef.current?.contentDocument) {
        iframeRef.current.srcdoc = doc;
      }
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleExportPdf() {
  // Use iframe's document for accurate layout
  const target = iframeRef.current?.contentDocument?.documentElement || previewRef.current;
  if (!target) return;
  try {
    await exportHtmlToPdf(target, 'ai-resume.pdf');
  } catch (e) {
    setError(e?.message || 'PDF export failed');
  }
  }

  return (
    <div style={{ width: 440, padding: 16, fontFamily: 'Inter, system-ui, Arial' }}>
      <motion.div className="glass-shell" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} style={{ padding: 16 }}>
        <motion.h3 layout style={{ marginTop: 0 }}>AI Presume</motion.h3>
        <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
          Provider: <strong className="accent">groq</strong> · Key: {hasGroqKey ? 'OK' : 'Missing'} · Export: A4
        </div>
        <div className="toolbar">
          <motion.button whileTap={{ scale: 0.98 }} className="btn" onClick={handleGenerate} disabled={loading || !hasGroqKey} title={!hasGroqKey ? 'Add Groq API key in Options' : ''}>
            Generate Resume
          </motion.button>
          <motion.button whileTap={{ scale: 0.98 }} className="btn" onClick={handleExportPdf} disabled={!html || loading}>
            Export PDF
          </motion.button>
          <motion.button whileTap={{ scale: 0.98 }} className="btn" onClick={() => chrome.runtime.openOptionsPage()}>
            Open Options
          </motion.button>
        </div>
        {error ? <div style={{ color: '#ff6b6b', marginTop: 8 }}>{error}</div> : null}
        <motion.div layout className="preview-container" style={{ marginTop: 12, height: 600, overflow: 'hidden', background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 10 }}>
          <iframe ref={iframeRef} title="resume" style={{ width: '100%', height: '100%', border: 'none', overflow: 'hidden' }} />
        </motion.div>
        
        {loading && (
          <div className="loading-overlay">
            <Atom color="#64b5f6" size="medium" text="" textColor="" />
            <div className="loading-text">Generating your tailored resume...</div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
