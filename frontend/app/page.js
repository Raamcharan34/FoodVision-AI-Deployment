'use client';
import { useEffect, useMemo, useRef, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const categories = 'Bread · Dairy product · Dessert · Egg · Fried food · Meat · Noodles-Pasta · Rice · Seafood · Soup · Vegetable-Fruit';

export default function Home() {
  const [files, setFiles] = useState([]);
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const previews = useMemo(() => files.map(file => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => previews.forEach(item => URL.revokeObjectURL(item.url)), [previews]);

  function addFiles(list) {
    const accepted = Array.from(list || []).filter(f => ['image/jpeg','image/png'].includes(f.type));
    setFiles(prev => [...prev, ...accepted].slice(0, 12)); setResults([]); setError('');
  }
  function reset() { setFiles([]); setResults([]); setError(''); if (inputRef.current) inputRef.current.value = ''; }
  async function analyze() {
    if (!files.length) return;
    setBusy(true); setError(''); setResults([]);
    try {
      const form = new FormData(); files.forEach(file => form.append('files', file));
      const response = await fetch(`${API_URL}/predict`, { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Prediction request failed.');
      setResults(data.results || []);
    } catch (e) { setError(`${e.message} Check that the prediction API is running and NEXT_PUBLIC_API_URL is configured.`); }
    finally { setBusy(false); }
  }
  const cols = results.length === 1 ? 'one' : results.length <= 4 ? 'two' : 'three';

  return <main className="shell">
    <header className="hero">
      <div className="eyebrow"><span className="dot"/> AI-POWERED FOOD RECOGNITION</div>
      <h1>FoodVision AI<span>.</span></h1>
      <p className="hero-description">A smarter way to identify what&apos;s on your plate. Upload a food photo and let a trained EfficientNetB0 model predict its most likely category.</p>
      <div className="tags"><span>✦ 11 Food Categories</span><span>◈ EfficientNetB0</span><span>◎ Image Classification</span></div>
    </header>

    <section>
      <h2>01 / Upload food images</h2>
      <p className="subtitle">Select one or more clear food photos. Each image will be analyzed separately.</p>
      <div className="upload-zone" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files); }} onClick={() => inputRef.current?.click()} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}>
        <div className="upload-icon">⇧</div><strong>Choose food images</strong><span>Drag and drop JPG, JPEG or PNG files here, or browse</span><small>Multiple images supported · Up to 12 images</small>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png" multiple hidden onChange={e => addFiles(e.target.files)} />
      </div>
      {files.length > 0 ? <>
        <p className="selected-count">{files.length} image{files.length !== 1 ? 's' : ''} selected</p>
        <div className="preview-grid">{previews.map(({file,url},i) => <div className="preview" key={`${file.name}-${i}`}><button className="remove" onClick={() => {setFiles(old => old.filter((_,j)=>j!==i));setResults([]);}} aria-label="Remove image">×</button><img src={url} alt={file.name}/><div className="filename">{file.name}<br/><span>{(file.size/1024).toFixed(1)} KB</span></div></div>)}</div>
      </> : <div className="empty-preview"><div className="empty-symbol">🍽️</div><strong>Your next food discovery starts here</strong><p>Upload one or more clear food images using the box above.<br/>Previews and predictions will appear here.</p></div>}
      <div className="actions"><button className="primary" disabled={!files.length || busy} onClick={analyze}>{busy ? 'Analyzing images…' : `✦  Analyze Food Image${files.length === 1 ? '' : 's'}`}</button><button className="secondary" onClick={reset}>↻ Start Over</button></div>
      <p className="subtitle tip">Best results come from well-lit images where the food is clearly visible. Predictions are limited to the 11 trained Food-11 categories.</p>
      {error && <div className="alert warning">{error}</div>}
    </section>

    <section className="results-section">
      <h2>02 / Prediction results</h2><p className="subtitle">Results automatically arrange into compact cards based on how many images you analyze.</p>
      {busy && <div className="loading">Checking your images and generating predictions…</div>}
      {results.length > 0 ? <><div className={`results-grid ${cols}`}>{results.map((item,i)=><ResultCard item={item} key={`${item.filename}-${i}`}/>)}</div><div className="stats"><div><strong>11</strong><span>Supported categories</span></div><div><strong>224 × 224</strong><span>Model input resolution</span></div><div><strong>{results.length}</strong><span>Images analyzed</span></div></div><p className="disclaimer">The food-screening model is a first-pass filter and can make mistakes. Model probabilities are not guarantees of correctness.</p></> : !busy && <div className="empty-results"><div className="empty-symbol">✧</div><strong>Ready when you are</strong><p>Upload one or more images and click Analyze Food Images.<br/>Each image gets its own predicted category, confidence score and top-three alternatives.</p></div>}
    </section>
    <footer><details><summary>Explore the 11 supported food categories</summary><p>{categories}</p></details><div className="footer"><strong>FoodVision AI</strong><br/>Built with Next.js, FastAPI, TensorFlow and EfficientNetB0<br/>Food-11 image classification project</div></footer>
  </main>;
}

function ResultCard({item}) {
  if (!item.is_food_candidate) return <article className="result-card"><div className="filename-label">{item.filename}</div><h3>Food image not verified</h3><p>This image does not show clear food evidence. No food category was assigned.</p><div className="alert warning">This may be a non-food image, or the food may not be recognizable. Please upload a clear food photograph.</div></article>;
  const top = item.predictions || []; const first = top[0]; const confidence = first ? first.probability * 100 : 0;
  if (confidence < 50) return <article className="result-card"><div className="filename-label">{item.filename}</div><h3>Unable to make a reliable prediction</h3><p>Food may be present, but the category prediction is too uncertain.</p><div className="alert warning">Very low confidence ({confidence.toFixed(2)}%). Try a brighter, sharper image with the food clearly visible.</div></article>;
  return <article className="result-card"><div className="filename-label">{item.filename}</div><h3>{first.label}</h3><div className="confidence"><div className="small-label">MODEL CONFIDENCE</div><strong>{confidence.toFixed(2)}%</strong><div className="track"><span style={{width:`${confidence}%`}}/></div></div>{confidence < 70 ? <div className="alert warning">Low confidence: treat this category as a tentative result and verify it manually.</div> : <div className="alert success">The model produced a stronger category prediction.</div>}<h4>Top 3 predictions</h4>{top.map((p,index)=><div className="prediction" key={p.label}><div><b>{index+1}. {p.label}</b><strong>{(p.probability*100).toFixed(2)}%</strong></div><div className="track"><span style={{width:`${p.probability*100}%`}}/></div></div>)}</article>;
}
