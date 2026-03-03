import { useState, useRef, useEffect } from 'react';
import Head from 'next/head';

const COLORS = ['#c8f135','#ff6b35','#35b5ff','#ff35a8','#35ffd4','#ffcc35','#a835ff','#ff3535'];

function parseItems(data) {
  const result = [];
  const charges = { tax: 0, service: 0, others: [] };
  
  try {
    const fields = data?.fields || [];
    
    // 메뉴 아이템: type이 "group"인 것들
    const groups = fields.filter(f => f.type === 'group');
    for (const group of groups) {
      const props = group.properties || [];
      const nameProp = props.find(p => p.key.includes('product_name'));
      const priceProp = props.find(p => p.key.includes('unit_product_total_price_before_discount')) 
                     || props.find(p => p.key.includes('unit_product_price'));
      
      const name = nameProp?.refinedValue?.trim();
      const price = parseFloat(String(priceProp?.refinedValue || '').replace(/[^0-9.]/g, ''));
      
      if (name && price > 0) {
        // 이름에서 "1x", "2x" 같은 prefix 정리
        const cleanName = name.replace(/^\d+x/, '').replace(/CHF$/, '').trim();
        result.push({ name: cleanName, price });
      }
    }
    
    // 세금
    const taxField = fields.find(f => f.key === 'total.tax_price' && f.type === 'content');
    if (taxField) {
      const tax = parseFloat(String(taxField.refinedValue).replace(/[^0-9.]/g, ''));
      if (tax > 0) charges.tax = tax;
    }
    
    // 총액 (참고용)
    const totalField = fields.find(f => f.key === 'total.charged_price' && f.type === 'content');
    if (totalField) {
      // 필요시 사용
    }
    
  } catch(e) {}
  
  if (result.length === 0) {
    return { items: [{name:'Demo Burger',price:12},{name:'Demo Pasta',price:15},{name:'Demo Juice',price:6}], charges };
  }
  
  return { items: result, charges };
}

function fc(n) {
  if (isNaN(n)) return '—';
  return `$${parseFloat(n).toFixed(2)}`;
}

export default function Home() {
  const [panel, setPanel] = useState(1);
  const [people, setPeople] = useState([]);
  const [items, setItems] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [charges, setCharges] = useState({ tax: 0, service: 0, others: [] });
  const [personInput, setPersonInput] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [apiStatus, setApiStatus] = useState('online');
  const fileInputRef = useRef();
  const canvasRef = useRef();

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    if (f.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = e => setPreview(e.target.result);
      reader.readAsDataURL(f);
    }
  };

  const handleScan = async () => {
    if (!file) return;
    setLoading(true); setError('');
    try {
      const fd = new FormData();
      fd.append('document', file);
      const res = await fetch('/api/scan', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      const parsed = parseItems(data);
      setItems(parsed.items);
      setCharges(parsed.charges);
      const a = {};
      parsed.items.forEach((_, i) => { a[i] = []; });
      setAssignments(a);
      setPanel(2);
    } catch(e) {
      setError(e.message);
      setApiStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const addPerson = () => {
    const name = personInput.trim();
    if (!name) return;
    // IME 입력(예: 정현) 시 마지막 한 글자가 중복으로 추가되는 현상 방지
    if (name.length === 1 && people.some(p => p.endsWith(name))) return;
    if (people.includes(name) || people.length >= 8) return;
    setPeople([...people, name]);
    setPersonInput('');
  };

  const removePerson = (i) => {
    const next = [...people];
    next.splice(i, 1);
    setPeople(next);
  };

  const toggleAssign = (itemIdx, name) => {
    const cur = assignments[itemIdx] || [];
    setAssignments({
      ...assignments,
      [itemIdx]: cur.includes(name) ? cur.filter(n => n !== name) : [...cur, name]
    });
  };

  const itemsSubtotal = items.reduce((a, item) => a + item.price, 0);
  const extraTotal = (charges.tax||0) + (charges.service||0) + (charges.others||[]).reduce((a,c)=>a+(c.amount||0),0);
  const grandTotal = itemsSubtotal + extraTotal;
  const hasUnassigned = items.some((_, i) => (assignments[i]||[]).length === 0);

  const calcResults = () => {
    const totals = {}, breakdown = {};
    people.forEach(p => { totals[p] = 0; breakdown[p] = []; });
    items.forEach((item, i) => {
      const assigned = assignments[i] || [];
      if (!assigned.length) return;
      const share = item.price / assigned.length;
      assigned.forEach(name => {
        totals[name] += share;
        breakdown[name].push({ name: item.name, share, count: assigned.length });
      });
    });
    const n = people.length || 1;
    const perTax = (charges.tax||0)/n, perSvc = (charges.service||0)/n;
    const perOther = (charges.others||[]).reduce((a,c)=>a+(c.amount||0),0)/n;
    people.forEach(name => {
      if (perTax) { totals[name]+=perTax; breakdown[name].push({name:'Tax',share:perTax,count:n}); }
      if (perSvc) { totals[name]+=perSvc; breakdown[name].push({name:'Service',share:perSvc,count:n}); }
      if (perOther) { totals[name]+=perOther; breakdown[name].push({name:'Other',share:perOther,count:n}); }
    });
    return { totals, breakdown };
  };

  useEffect(() => {
    if (panel !== 4 || !canvasRef.current) return;
    const { totals } = calcResults();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const total = Object.values(totals).reduce((a,b)=>a+b,0);
    if (total === 0) return;
    let angle = -Math.PI/2;
    ctx.clearRect(0,0,200,200);
    people.forEach((name,i) => {
      const slice = (totals[name]/total)*Math.PI*2;
      ctx.beginPath(); ctx.moveTo(100,100);
      ctx.arc(100,100,90,angle,angle+slice);
      ctx.closePath();
      ctx.fillStyle = COLORS[i%COLORS.length];
      ctx.fill();
      angle += slice;
    });
  }, [panel]);

  const { totals, breakdown } = panel === 4 ? calcResults() : { totals: {}, breakdown: {} };
  const maxTotal = panel === 4 ? Math.max(...Object.values(totals), 0) : 0;

  const reset = () => {
    setPeople([]); setItems([]); setAssignments({}); setFile(null);
    setPreview(null); setCharges({tax:0,service:0,others:[]}); 
    setPersonInput(''); setError(''); setApiStatus('online'); setPanel(1);
  };

  const pulse = apiStatus === 'online' ? `
    @keyframes pulse {
      0%,100% { box-shadow: 0 0 0 2px rgba(74,222,128,0.3); }
      50% { box-shadow: 0 0 0 6px rgba(74,222,128,0); }
    }` : '';

  return (
    <>
      <Head>
        <title>SplitReceipt</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="AI powered bill splitter by Yoonjae" />
        <meta property="og:title" content="SplitReceipt by Yoonjae" />
        <meta property="og:description" content="AI powered bill splitter by Yoonjae" />
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap" rel="stylesheet" />
      </Head>
      <style>{`
        ${pulse}
        header{padding:28px 40px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:var(--bg);z-index:100;}
        .logo{font-family:'Syne',sans-serif;font-weight:800;font-size:22px;letter-spacing:-0.5px;}
        .logo span{color:var(--accent);}
        .status{display:flex;align-items:center;gap:8px;}
        .dot{width:8px;height:8px;border-radius:50%;background:${apiStatus==='online'?'#4ade80':'#ff6b35'};${apiStatus==='online'?'animation:pulse 2s infinite;':''}}
        .status-label{font-size:11px;color:${apiStatus==='online'?'#4ade80':'var(--accent2)'};text-transform:uppercase;letter-spacing:1px;}
        .container{max-width:900px;margin:0 auto;padding:40px 24px;}
        .steps{display:flex;gap:4px;margin-bottom:48px;}
        .step{flex:1;height:3px;background:var(--border);border-radius:2px;transition:background 0.4s;}
        .step.active{background:var(--accent);}
        .step.done{background:var(--accent2);}
        .section-title{font-family:'Syne',sans-serif;font-size:28px;font-weight:800;margin-bottom:8px;letter-spacing:-0.5px;}
        .section-sub{color:var(--muted);font-size:12px;margin-bottom:32px;}
        .upload-zone{border:2px dashed var(--border);border-radius:var(--radius);padding:64px 32px;text-align:center;cursor:pointer;transition:all 0.2s;}
        .upload-zone:hover{border-color:var(--accent);background:rgba(200,241,53,0.03);}
        .upload-icon{font-size:48px;margin-bottom:16px;}
        .upload-title{font-family:'Syne',sans-serif;font-weight:700;font-size:18px;margin-bottom:8px;}
        .upload-sub{color:var(--muted);font-size:12px;}
        .btn{font-family:'Syne',sans-serif;font-weight:700;font-size:13px;padding:12px 24px;border-radius:8px;border:none;cursor:pointer;transition:all 0.15s;}
        .btn-primary{background:var(--accent);color:#0e0e0e;}
        .btn-primary:hover{background:#d4f54a;transform:translateY(-1px);}
        .btn-primary:disabled{background:var(--border);color:var(--muted);cursor:not-allowed;transform:none;}
        .btn-ghost{background:transparent;color:var(--muted);border:1px solid var(--border);}
        .btn-ghost:hover{color:var(--text);border-color:var(--text);}
        .people-row{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;}
        .person-tag{display:flex;align-items:center;gap:8px;background:var(--surface);border:1px solid var(--border);border-radius:100px;padding:6px 14px;font-size:13px;}
        .remove-btn{cursor:pointer;color:var(--muted);font-size:16px;background:none;border:none;color:var(--muted);}
        .remove-btn:hover{color:var(--accent2);}
        .add-row{display:flex;gap:8px;align-items:center;}
        .text-input{background:var(--surface);border:1px solid var(--border);color:var(--text);font-family:'DM Mono',monospace;font-size:13px;padding:10px 14px;border-radius:8px;outline:none;}
        .text-input:focus{border-color:var(--accent);}
        .items-table{width:100%;border-collapse:collapse;margin-bottom:24px;}
        .items-table th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);padding:0 12px 12px;border-bottom:1px solid var(--border);}
        .items-table td{padding:14px 12px;border-bottom:1px solid var(--border);font-size:13px;vertical-align:middle;}
        .item-price{color:var(--accent);font-weight:500;}
        .person-checks{display:flex;gap:6px;flex-wrap:wrap;}
        .pcheck{display:flex;align-items:center;gap:5px;background:var(--surface2);border:1px solid var(--border);border-radius:100px;padding:4px 10px;cursor:pointer;font-size:11px;transition:all 0.15s;user-select:none;}
        .pcheck.checked{background:rgba(200,241,53,0.12);border-color:var(--accent);}
        .split-badge{font-size:10px;color:var(--muted);background:var(--surface2);border-radius:4px;padding:2px 6px;margin-left:8px;}
        .total-row{display:flex;justify-content:space-between;align-items:center;padding:16px 12px;background:var(--surface2);border-radius:8px;margin-top:8px;}
        .total-label{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;}
        .total-value{font-family:'Syne',sans-serif;font-size:20px;font-weight:800;color:var(--accent);}
        .warn{background:rgba(255,107,53,0.1);border:1px solid rgba(255,107,53,0.3);color:var(--accent2);border-radius:8px;padding:10px 14px;font-size:12px;margin-bottom:16px;}
        .summary-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:40px;}
        .scard{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px;transition:border-color 0.2s;}
        .scard:hover{border-color:var(--accent);}
        .sname{font-family:'Syne',sans-serif;font-weight:700;font-size:16px;margin-bottom:4px;}
        .samount{font-size:28px;font-weight:500;color:var(--accent);margin-bottom:12px;letter-spacing:-1px;}
        .sitems{font-size:11px;color:var(--muted);line-height:1.8;}
        .chart-section{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:28px;margin-bottom:24px;}
        .chart-title{font-family:'Syne',sans-serif;font-weight:700;font-size:14px;margin-bottom:24px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);}
        .bar-row{display:flex;align-items:center;gap:12px;margin-bottom:14px;}
        .bar-label{width:80px;font-size:12px;text-align:right;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .bar-track{flex:1;height:28px;background:var(--surface2);border-radius:4px;overflow:hidden;}
        .bar-fill{height:100%;border-radius:4px;display:flex;align-items:center;padding:0 10px;font-size:11px;font-weight:500;color:#0e0e0e;white-space:nowrap;}
        .pie-container{display:flex;align-items:center;gap:32px;flex-wrap:wrap;}
        .pie-legend{display:flex;flex-direction:column;gap:8px;}
        .legend-item{display:flex;align-items:center;gap:8px;font-size:12px;}
        .legend-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;}
        .loading{display:flex;align-items:center;gap:12px;padding:24px;color:var(--muted);font-size:13px;}
        .spinner{width:20px;height:20px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin 0.8s linear infinite;}
        @keyframes spin{to{transform:rotate(360deg);}}
        .preview-img{max-width:200px;max-height:200px;border-radius:8px;border:1px solid var(--border);object-fit:cover;margin-top:16px;display:block;}
        .row-actions{display:flex;gap:10px;margin-top:24px;}
        .error-msg{color:var(--accent2);font-size:12px;margin-top:8px;}
        .charges-info{margin-top:8px;font-size:11px;color:var(--muted);}
        .signature{margin-top:32px;text-align:center;font-size:11px;color:var(--muted);opacity:0.55;}
      `}</style>

      <header>
        <div className="logo">Split<span>Receipt</span></div>
        <div className="status">
          <div className="dot"></div>
          <span className="status-label">Upstage API {apiStatus === 'online' ? 'Online' : 'Error'}</span>
        </div>
      </header>

      <div className="container">
        <div className="steps">
          {[1,2,3,4].map(n => (
            <div key={n} className={`step${panel===n?' active':panel>n?' done':''}`}></div>
          ))}
        </div>

        {panel === 1 && (
          <div>
            <div className="section-title">Upload Receipt</div>
            <div className="section-sub">Snap a photo or upload an image of your receipt</div>
            <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
              <div className="upload-icon">🧾</div>
              <div className="upload-title">{file ? file.name : 'Drop receipt here'}</div>
              <div className="upload-sub">JPEG, PNG, PDF · up to 50MB</div>
              <input ref={fileInputRef} type="file" accept="image/*,.pdf"
                style={{display:'none'}} onChange={e => handleFile(e.target.files[0])} />
            </div>
            {preview && <img src={preview} className="preview-img" alt="preview" />}
            {error && <div className="error-msg">⚠ {error}</div>}
            <div className="row-actions">
              <button className="btn btn-primary" disabled={!file||loading} onClick={handleScan}>
                {loading ? 'Scanning...' : 'Scan Receipt →'}
              </button>
            </div>
            {loading && <div className="loading"><div className="spinner"></div>Extracting via Upstage API...</div>}
          </div>
        )}

        {panel === 2 && (
          <div>
            <div className="section-title">Who's splitting?</div>
            <div className="section-sub">Add everyone at the table</div>
            <div className="people-row">
              {people.map((name,i) => (
                <div key={name} className="person-tag" style={{borderColor:COLORS[i%COLORS.length]+'44'}}>
                  <span style={{color:COLORS[i%COLORS.length],fontSize:'8px'}}>●</span>
                  {name}
                  <button className="remove-btn" onClick={() => removePerson(i)}>×</button>
                </div>
              ))}
            </div>
            <div className="add-row">
              <input className="text-input" value={personInput} placeholder="Enter name..."
                onChange={e => setPersonInput(e.target.value)}
                onKeyDown={e => { if(e.key==='Enter'&&!e.isComposing){e.preventDefault();addPerson();}}} />
              <button className="btn btn-primary" onClick={addPerson}>+ Add</button>
            </div>
            <div className="row-actions">
              <button className="btn btn-primary" disabled={people.length<2} onClick={() => setPanel(3)}>Assign Items →</button>
              <button className="btn btn-ghost" onClick={() => setPanel(1)}>← Back</button>
            </div>
          </div>
        )}

        {panel === 3 && (
          <div>
            <div className="section-title">Who ate what?</div>
            <div className="section-sub">Select everyone who shared each item — split equally</div>
            {hasUnassigned && <div className="warn">⚠ Some items have no one assigned yet</div>}
            <table className="items-table">
              <thead><tr><th>Item</th><th>Price</th><th>Split between</th><th>Per person</th></tr></thead>
              <tbody>
                {items.map((item,i) => {
                  const assigned = assignments[i]||[];
                  const per = assigned.length > 0 ? item.price/assigned.length : null;
                  return (
                    <tr key={i}>
                      <td>{item.name}</td>
                      <td className="item-price">{fc(item.price)}</td>
                      <td>
                        <div className="person-checks">
                          {people.map((name,pi) => (
                            <div key={name} className={`pcheck${assigned.includes(name)?' checked':''}`}
                              onClick={() => toggleAssign(i,name)}>
                              <span style={{color:COLORS[pi%COLORS.length]}}>{name}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span style={{color:'var(--muted)',fontSize:'12px'}}>{per?fc(per):'—'}</span>
                        {assigned.length>1 && <span className="split-badge">÷{assigned.length}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="total-row">
              <span className="total-label">Total (incl. tax/fees)</span>
              <span className="total-value">{fc(grandTotal)}</span>
            </div>
            {(charges.tax>0||charges.service>0) && (
              <div className="charges-info">
                {charges.tax>0 && `Tax: ${fc(charges.tax)}`}
                {charges.service>0 && ` · Service: ${fc(charges.service)}`}
              </div>
            )}
            <div className="row-actions">
              <button className="btn btn-primary" disabled={hasUnassigned} onClick={() => setPanel(4)}>Calculate Split →</button>
              <button className="btn btn-ghost" onClick={() => setPanel(2)}>← Back</button>
            </div>
          </div>
        )}

        {panel === 4 && (
          <div>
            <div className="section-title">Here's the split 💸</div>
            <div className="section-sub">Who owes what</div>
            <div className="summary-grid">
              {people.map((name,i) => (
                <div key={name} className="scard" style={{borderColor:COLORS[i%COLORS.length]+'44'}}>
                  <div className="sname" style={{color:COLORS[i%COLORS.length]}}>{name}</div>
                  <div className="samount">{fc(totals[name])}</div>
                  <div className="sitems">
                    {(breakdown[name]||[]).map((b,j) => (
                      <div key={j}>{b.name}{b.count>1?` ÷${b.count}`:''} = {fc(b.share)}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="chart-section">
              <div className="chart-title">Amount per person</div>
              {people.map((name,i) => (
                <div key={name} className="bar-row">
                  <div className="bar-label">{name}</div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{width:`${maxTotal>0?(totals[name]/maxTotal*100):0}%`,background:COLORS[i%COLORS.length]}}>
                      {fc(totals[name])}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="chart-section">
              <div className="chart-title">Share breakdown</div>
              <div className="pie-container">
                <canvas ref={canvasRef} width={200} height={200}></canvas>
                <div className="pie-legend">
                  {people.map((name,i) => {
                    const tot = Object.values(totals).reduce((a,b)=>a+b,0);
                    return (
                      <div key={name} className="legend-item">
                        <div className="legend-dot" style={{background:COLORS[i%COLORS.length]}}></div>
                        <span>{name} — {tot>0?((totals[name]/tot)*100).toFixed(1):0}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="row-actions">
              <button className="btn btn-primary" onClick={reset}>Start Over</button>
            </div>
          </div>
        )}
        <div className="signature">SplitReceipt by Yoonjae</div>
      </div>
    </>
  );
}