import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Atom } from 'react-loading-indicators';
import '../glass.css';
import { storage } from '../utils/storage';

export default function Options() {
  const [userProfile, setUserProfile] = useState('');
  const [previousResumeText, setPreviousResumeText] = useState('');
  const [provider, setProvider] = useState('groq');
  const [groqKey, setGroqKey] = useState('');
  const [saved, setSaved] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    (async () => {
  const data = await storage.get(['userProfile', 'previousResumeText', 'AI_PROVIDER', 'GROQ_API_KEY']);
      setUserProfile(data.userProfile || '');
      setPreviousResumeText(data.previousResumeText || '');
  const gk = data.GROQ_API_KEY || '';
  setGroqKey(gk);
  setProvider('groq');
    })();
  }, []);

  // Provider fixed to groq

  async function onSave() {
  // Provider fixed to groq
  const selected = 'groq';
    await storage.set({
      userProfile,
      previousResumeText,
      AI_PROVIDER: selected,
      GROQ_API_KEY: groqKey,
    });
    setSaved('Saved!');
    setTimeout(() => setSaved(''), 1500);
  }

  async function onUploadFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const ext = file.name.toLowerCase().split('.').pop();
      if (ext === 'pdf') {
        const { getDocument } = await import('pdfjs-dist/build/pdf');
        // worker config
        const workerUrl = chrome.runtime.getURL('pdf.worker.min.js');
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
        const buf = await file.arrayBuffer();
        const pdf = await getDocument({ data: buf }).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map(it => it.str).join(' ') + '\n';
        }
        setPreviousResumeText((prev) => (prev ? prev + '\n' : '') + text.trim());
      } else if (ext === 'docx') {
        const mammoth = await import('mammoth');
        const buf = await file.arrayBuffer();
        const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
        setPreviousResumeText((prev) => (prev ? prev + '\n' : '') + (value || '').trim());
      } else if (ext === 'txt') {
        const text = await file.text();
        setPreviousResumeText((prev) => (prev ? prev + '\n' : '') + text.trim());
      } else {
        alert('Unsupported file type. Please upload PDF, DOCX, or TXT.');
      }
    } catch (error) {
      console.error('File upload error:', error);
      alert('Error processing file. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ padding: 20, fontFamily: 'Inter, system-ui, Arial', maxWidth: 900 }}>
      <motion.div className="glass-shell" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} style={{ padding: 16 }}>
  <motion.h2 layout>AI Presume - Options</motion.h2>
        <div className="muted" style={{ fontSize: 12 }}>
          Provider: <strong className="accent">groq</strong> · Groq key: {groqKey ? 'OK' : 'Missing'}
        </div>

        <section style={{ marginTop: 12 }}>
          <h3>AI Provider & Key</h3>
          <div style={{ marginTop: 8 }}>
            <input 
              type="password" 
              placeholder="Groq API Key" 
              value={groqKey} 
              onChange={e => setGroqKey(e.target.value)} 
              style={{
                width: '100%',
                maxWidth: '400px',
                padding: '10px 12px',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '6px',
                background: 'rgba(255,255,255,0.1)',
                color: '#333',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>
          {/* Gemini key removed */}
        </section>

        <section style={{ marginTop: 16 }}>
          <h3>User Profile</h3>
          <textarea 
            value={userProfile} 
            onChange={(e) => setUserProfile(e.target.value)} 
            rows={6} 
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '6px',
              background: 'rgba(255,255,255,0.1)',
              color: '#333',
              fontSize: '14px',
              resize: 'vertical',
              boxSizing: 'border-box',
              fontFamily: 'inherit'
            }}
            placeholder="About you, contact info, role, etc." 
          />
        </section>

        <section style={{ marginTop: 16 }}>
          <h3>Upload Resume or CV</h3>
          <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input 
              type="file" 
              accept=".pdf,.docx,.txt" 
              onChange={onUploadFile}
              disabled={uploading}
              placeholder='upload resume'
              style={{
                padding: '8px 12px',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '6px',
                background: 'rgba(255,255,255,0.1)',
                color: '#333',
                fontSize: '14px'
              }}
            />
            {uploading && <Atom color="#64b5f6" size="small" text="" textColor="" />}
          </div>
          <textarea 
            value={previousResumeText} 
            onChange={(e) => setPreviousResumeText(e.target.value)} 
            rows={10} 
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '6px',
              background: 'rgba(255,255,255,0.1)',
              color: '#333',
              fontSize: '14px',
              resize: 'vertical',
              boxSizing: 'border-box',
              fontFamily: 'inherit'
            }}
            placeholder="Paste or upload your previous resume text" 
            disabled={uploading}
          />
        </section>

        <div style={{ marginTop: 16 }}>
          <motion.button whileTap={{ scale: 0.98 }} className="btn" onClick={onSave}>Save</motion.button>
          {saved && <span style={{ marginLeft: 8, color: 'lightgreen' }}>{saved}</span>}
        </div>
      </motion.div>
    </div>
  );
}
