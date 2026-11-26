// BlogNeo v2 — frontend wired to the real backend API.
// API: https://blogneo-api.nayeemahmed33000.workers.dev (Cloudflare Worker:
// Workers AI article + image, D1 storage, Blogger/Pinterest OAuth, cron).
// Identity: one random device UUID per browser (X-BlogNeo-Device header).
// No secrets or API keys in this file.
const API = 'https://blogneo-api.nayeemahmed33000.workers.dev';
const KEY = 'blogneo_v2';
const DEVICE_KEY = 'blogneo_device';
const $ = id => document.getElementById(id);
const now = () => new Date().toLocaleString('en-GB', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
function deviceId(){
  let d = localStorage.getItem(DEVICE_KEY);
  if(!d){ d = (crypto.randomUUID ? crypto.randomUUID() : 'dev-' + Date.now() + '-' + Math.random().toString(36).slice(2)); localStorage.setItem(DEVICE_KEY, d); }
  return d;
}
async function api(path, opts){
  const headers = { 'Content-Type': 'application/json', 'X-BlogNeo-Device': deviceId(), ...((opts && opts.headers) || {}) };
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(API + path, { ...(opts || {}), headers });
  const data = await res.json().catch(() => ({}));
  if(!res.ok) throw new Error(data.error || ('Request failed (' + res.status + ')'));
  return data;
}
// ---------- Fast login: session token (localStorage when Remember Me, else sessionStorage) ----------
const TOKEN_KEY = 'blogneo_token', EMAIL_KEY = 'blogneo_email', GUEST_KEY = 'blogneo_guest';
function getToken(){ return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || ''; }
function getEmail(){ return localStorage.getItem(EMAIL_KEY) || sessionStorage.getItem(EMAIL_KEY) || ''; }
function setSession(token, email, remember){
  clearSession();
  const store = remember ? localStorage : sessionStorage;
  if (token) store.setItem(TOKEN_KEY, token);
  if (email) store.setItem(EMAIL_KEY, email);
}
function clearSession(){
  localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EMAIL_KEY); sessionStorage.removeItem(EMAIL_KEY);
  localStorage.removeItem(GUEST_KEY);
}
function isGuest(){ return localStorage.getItem(GUEST_KEY) === '1'; }
function isAuthed(){ return !!getToken(); }
function renderAuthUI(){
  const email = getEmail();
  const authed = isAuthed();
  $('authEmail').style.display = authed && email ? '' : 'none';
  $('authEmail').textContent = authed ? email : '';
  $('btnLoginNav').style.display = authed ? 'none' : '';
  $('btnLogoutNav').style.display = authed ? '' : 'none';
  const gb = $('guestBanner');
  if (gb) gb.style.display = (!authed && isGuest()) ? '' : 'none';
}
let state = {blogger:false, bloggerBlogId:'', bloggerBlogName:'', bloggerLocked:false, pinterest:false, pinterestName:'', pinterestUrl:'', plan:'free', autoOn:false, autoTime:'08:00', autoNiche:'Cozy home decor', articles:0, pins:0, log:[], latest:''};
try { const s = JSON.parse(localStorage.getItem(KEY) || '{}'); state = {...state, ...s}; } catch(e) {}
function save(){ localStorage.setItem(KEY, JSON.stringify(state)); }
function toast(msg){ const t=$('toast'); t.textContent=msg; t.style.display='block'; clearTimeout(t._h); t._h=setTimeout(()=>t.style.display='none', 5000); }
function log(msg){ state.log.unshift(now()+' — '+msg); state.log=state.log.slice(0,50); save(); renderLog(); }
function renderLog(){
  const html = state.log.length ? state.log.map(x=>'<div>'+esc(x)+'</div>').join('') : '<div>No activity yet.</div>';
  if($('dashLog')) $('dashLog').innerHTML=html;
  if($('runLog')) $('runLog').innerHTML=html;
}
function clearLog(){ state.log=[]; save(); renderLog(); toast('Log cleared.'); }
function esc(s){ return String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function slugify(s){ return s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70) || 'blogneo-article'; }

// ---------- Navigation ----------
// Login is the first screen when logged out. Dashboard, Writer, Pins,
// Connections and Auto Flow need a login or guest mode.
const PROTECTED_PAGES = ['dashboard','writer','pins','connections','autoflow'];
function go(page){
  if(PROTECTED_PAGES.includes(page) && !isAuthed() && !isGuest()){
    page = 'login';
    toast('Please log in first — it takes 10 seconds. Or continue as guest (demo).');
  }
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const el=$('page-'+page); if(el) el.classList.add('active');
  document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active', b.dataset.page===page));
  if(page==='dashboard') renderDashboard();
  if(page==='autoflow') loadAutoFlow();
  if(page==='connections' && state.blogger) loadBlogPicker();
  renderAuthUI();
  window.scrollTo({top:0, behavior:'smooth'});
}

// ---------- Fast login ----------
let authMode = 'login'; // 'login' | 'signup'
let pendingVerifyEmail = '';
function toggleAuthMode(){
  authMode = authMode === 'login' ? 'signup' : 'login';
  $('authTitle').textContent = authMode === 'login' ? 'Log in to BlogNeo' : 'Create your BlogNeo account';
  $('authSub').textContent = authMode === 'login' ? 'Fast login — email + password, no waiting.' : 'Free to start — verify your email, then log in.';
  $('authSubmit').textContent = authMode === 'login' ? 'Login' : 'Create Account';
  $('authToggleLink').textContent = authMode === 'login' ? "No account yet? Create one — it's free" : 'Already have an account? Log in';
  const show = authMode === 'signup';
  $('authName').style.display = show ? '' : 'none';
  $('authNameLabel').style.display = show ? '' : 'none';
  $('authPassword').autocomplete = show ? 'new-password' : 'current-password';
  $('authError').style.display = 'none';
}
function showAuthError(msg){ const e=$('authError'); e.textContent=msg; e.style.display=''; }
async function submitAuth(){
  const email = $('authEmailInput').value.trim().toLowerCase();
  const password = $('authPassword').value;
  const remember = $('rememberMe').checked;
  if(!email || !password){ showAuthError('Enter your email and password.'); return; }
  const btn = $('authSubmit'); btn.disabled = true; btn.textContent = 'Please wait…';
  try{
    if(authMode === 'signup'){
      const r = await api('/api/auth/signup', {method:'POST', body: JSON.stringify({email, password, name: $('authName').value.trim() || undefined})});
      pendingVerifyEmail = r.email || email;
      go('verify');
      $('verifyText').textContent = 'We sent a 6-digit code to ' + pendingVerifyEmail + '. Enter it below — it expires in 10 minutes.' + (r.email_sent ? '' : ' (Warning: ' + (r.email_error || 'the email may not have sent') + ')');
      toast('Account created — check your email for the 6-digit code.');
      log('Signed up: ' + pendingVerifyEmail + ' (verification pending)');
    } else {
      const r = await api('/api/auth/login', {method:'POST', body: JSON.stringify({email, password})});
      setSession(r.token, r.email, remember);
      localStorage.removeItem(GUEST_KEY);
      renderAuthUI(); refreshStatus();
      toast('Welcome back, ' + r.email + '!');
      log('Logged in: ' + r.email);
      go('dashboard');
    }
  }catch(e){
    const msg = e.message || 'Login failed.';
    if(msg.toLowerCase().includes('verify your email')){
      pendingVerifyEmail = email;
      go('verify');
      $('verifyText').textContent = 'Your account is not verified yet. Enter the 6-digit code from your email (check inbox and spam), or tap Resend Code below — it expires in 10 minutes.';
      toast('Please verify your email first.');
    } else {
      showAuthError(msg);
    }
  }finally{ btn.disabled = false; btn.textContent = authMode === 'login' ? 'Login' : 'Create Account'; }
}
async function loginWithGoogle(){
  try{
    const s = await api('/api/auth/google/status');
    if(!s.configured){
      toast('Google sign-in is not configured yet. The owner still has to add the Google Client ID and Secret on the BlogNeo server. Please log in with email instead.');
      $('googleNote').textContent = 'Google sign-in is not configured yet — use email login below.';
      return;
    }
    location.href = s.auth_url;
  }catch(e){ toast('Google sign-in check failed: ' + e.message); }
}
function continueAsGuest(){
  localStorage.setItem(GUEST_KEY, '1');
  renderAuthUI();
  toast('Guest demo — your work is saved only in this browser.');
  log('Continued as guest (demo).');
  go('dashboard');
}
async function logout(){
  try{ await api('/api/auth/logout', {method:'POST', body: '{}'}); }catch(e){ /* session already gone */ }
  clearSession();
  renderAuthUI();
  toast('Logged out.');
  go('login');
}
// ---------- Email verification ----------
function showVerifyError(msg){ const e=$('verifyError'); e.textContent=msg; e.style.display=''; }
async function submitVerify(){
  const code = $('verifyCode').value.trim();
  if(!/^\d{6}$/.test(code)){ showVerifyError('Enter the 6-digit code from your email.'); return; }
  try{
    const r = await api('/api/auth/verify', {method:'POST', body: JSON.stringify({email: pendingVerifyEmail, code})});
    setSession(r.token, r.email, true);
    localStorage.removeItem(GUEST_KEY);
    renderAuthUI(); refreshStatus();
    toast('Email verified — welcome to BlogNeo, ' + r.email + '!');
    log('Email verified: ' + r.email);
    go('dashboard');
  }catch(e){ showVerifyError(e.message || 'Verification failed.'); }
}
async function resendCode(){
  if(!pendingVerifyEmail){ toast('Sign up or log in first so we know which email to send to.'); go('login'); return; }
  const btn = $('resendBtn'); btn.disabled = true; btn.textContent = 'Sending…';
  try{
    const r = await api('/api/auth/send-code', {method:'POST', body: JSON.stringify({email: pendingVerifyEmail})});
    if(r.email_sent){ toast('New code sent to ' + pendingVerifyEmail + '. Check your inbox (and spam).'); $('verifyNote').textContent = 'New code sent — it expires in 10 minutes. 3 attempts max per code.'; }
    else { toast('Could not send the email: ' + (r.error || 'sending failed') + '. Try again in a minute.'); }
  }catch(e){ toast('Resend failed: ' + e.message); }
  finally{ btn.disabled = false; btn.textContent = 'Resend Code'; }
}
document.querySelectorAll('#nav button').forEach(b=>b.addEventListener('click', ()=>go(b.dataset.page)));

// ---------- Backend status (source of truth) ----------
async function refreshStatus(){
  try{
    const s = await api('/api/status');
    state.plan = s.plan || 'free';
    state.blogger = !!(s.blogger && s.blogger.status === 'connected');
    state.bloggerBlogId = (s.blogger && s.blogger.blog_id) || '';
    state.bloggerBlogName = (s.blogger && s.blogger.blog_name) || '';
    state.pinterest = !!(s.pinterest && s.pinterest.status === 'connected');
    state.pinterestName = (s.pinterest && s.pinterest.blog_name) || '';
    state.pinterestUrl = (s.pinterest && s.pinterest.blog_url) || '';
    state.articles = (s.counts && s.counts.articles) || 0;
    if(s.auto){ state.autoOn = !!s.auto.auto_on; state.autoTime = s.auto.run_time || '08:00'; state.autoNiche = s.auto.niche || state.autoNiche; }
    if(s.runs && s.runs.length){
      state.log = s.runs.slice(0,10).map(r => (r.created_at||'').slice(0,16).replace('T',' ') + ' — Auto run: ' + r.niche + ' → ' + r.status + (r.blogger_url ? ' — ' + r.blogger_url : '') + (r.error ? ' — ' + r.error : ''));
    }
    save(); renderBadges(); renderDashboard(); renderAuto();
    if(state.blogger) loadBlogPicker();
  }catch(e){ /* backend unreachable — keep local state, UI still works with template fallback */ }
}
function renderDashboard(){
  $('statArticles').textContent = state.articles;
  $('statPins').textContent = state.pins;
  $('statBlogger').textContent = state.blogger ? (state.bloggerBlogName ? 'Connected — ' + state.bloggerBlogName : 'Connected — no blog selected') : 'Not connected';
  $('statPinterest').textContent = state.pinterest ? (state.pinterestName ? 'Connected — ' + state.pinterestName : 'Connected') : 'Not connected';
  $('dashAuto').textContent = state.autoOn ? 'ON — runs daily at '+state.autoTime+' for niche "'+state.autoNiche+'".' : 'Off — turn it on in Daily Auto Flow.';
  $('dashPlan').textContent = state.plan==='pro' ? 'Pro plan — daily auto flow unlocked.' : state.plan==='pro-pending' ? 'Pro — payment pending (activation within 24h after confirmation).' : 'Free plan — 1 blog, 3 articles/month, manual pins.';
  $('dashLatest').textContent = state.latest || 'No article yet. Generate one in Article Writer.';
  renderLog(); renderBadges();
}
function renderBadges(){
  const bB=$('badgeBlogger'), bP=$('badgePinterest');
  if(bB){ bB.textContent = state.blogger?'Connected':'Not connected'; bB.className='badge '+(state.blogger?'on':'off'); }
  if(bP){ bP.textContent = state.pinterest?'Connected':'Not connected'; bP.className='badge '+(state.pinterest?'on':'off'); }
  const pa=$('pinterestAccountLine'), pan=$('pinterestAccountName');
  if(pa){ if(state.pinterest && state.pinterestName){ pa.style.display=''; pan.textContent = state.pinterestName; } else pa.style.display='none'; }
  const pb=$('planBadge');
  if(pb){ pb.textContent = state.plan==='pro'?'Pro':state.plan==='pro-pending'?'Pro — Pending':'Free'; pb.className='badge '+(state.plan==='pro'?'on':'off'); }
  if($('planNote')) $('planNote').textContent = state.plan==='pro-pending' ? 'Payment sent — Pro activates within 24h after confirmation.' : '';
}

// ---------- Canvas images (fallback when the AI image is unavailable) ----------
function wrapText(ctx, text, x, y, maxW, lh){
  const words=text.split(' '); let line='', yy=y;
  for(const w of words){ const t=line?line+' '+w:w; if(ctx.measureText(t).width>maxW && line){ ctx.fillText(line,x,yy); line=w; yy+=lh; } else line=t; }
  ctx.fillText(line,x,yy); return yy;
}
function drawImage(canvas, title, sub, idx){
  const W=canvas.width, H=canvas.height, ctx=canvas.getContext('2d');
  const pals=[['#0b3d2a','#d4af37'],['#123528','#f0cd5a'],['#0b2f24','#1fae6b'],['#3a2f10','#f0cd5a']];
  const [bg,acc]=pals[idx%pals.length];
  const g=ctx.createLinearGradient(0,0,W,H); g.addColorStop(0,bg); g.addColorStop(1,'#07120e');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  ctx.fillStyle=acc; ctx.globalAlpha=.18; ctx.beginPath(); ctx.arc(W*.8,H*.2,W*.45,0,7); ctx.fill(); ctx.beginPath(); ctx.arc(W*.15,H*.85,W*.35,0,7); ctx.fill(); ctx.globalAlpha=1;
  ctx.fillStyle=acc; ctx.fillRect(28,H-92,W-56,4);
  ctx.fillStyle='#fff'; ctx.font='bold '+Math.round(W*.055)+'px Arial'; ctx.textAlign='left';
  wrapText(ctx, title, 28, H*.42, W-56, Math.round(W*.07));
  ctx.fillStyle='#cfe3d4'; ctx.font=Math.round(W*.035)+'px Arial';
  wrapText(ctx, sub, 28, H-58, W-56, Math.round(W*.05));
  ctx.fillStyle=acc; ctx.font='bold '+Math.round(W*.03)+'px Arial'; ctx.fillText('BLOGNEO  •  GENERATED IMAGE', 28, 44);
}
function makeCanvas(w,h){ const c=document.createElement('canvas'); c.width=w; c.height=h; c.className='art-canvas'; return c; }

// ---------- Article Writer (REAL AI first, template fallback) ----------
let currentArticle='';
let currentArticleMeta = null; // {title, slug, meta_description, image}
function articleTextFor(topic){
  const t=topic.trim()||'Cozy home decor';
  const slug=slugify(t);
  const meta='Discover '+t.toLowerCase()+' — simple, practical ideas you can try today, with tips, mistakes to avoid and answers to the most common questions.';
  const sec=(n,title,body)=>'\n## '+n+'. '+title+'\n\n'+body+'\n';
  const body =
'# '+t+'\n\n'+
'If you have been searching for '+t.toLowerCase()+', you are in the right place. This guide keeps it simple: what works, what to avoid, and how to start today — even if you are a complete beginner and you have a small budget.\n\n'+
'In this article you will learn the basics of '+t.toLowerCase()+', the easiest way to get started, the mistakes most beginners make, and a simple plan you can follow this week. No jargon, no fluff — just practical steps.\n'+
sec(1,'Start With The Basics','Before you buy anything or change anything, understand the basics. '+t+' works best when you start small and focus on one thing at a time. Pick the one area that matters most to you, and improve that first. A small, clear win builds confidence — and confidence keeps you going.\n\nMake a short list of what you already have, what you need, and what you can skip for now. Most people overbuy at the start. You do not need everything on day one. You need a clear starting point and a routine you can actually keep.')+
sec(2,'The Easiest Way To Begin','The easiest way to begin with '+t.toLowerCase()+' is to follow a simple routine. Set aside 20 to 30 minutes, choose one small task, and finish it properly. Repeat it for a week. That is how a habit forms — and habits beat motivation every time.\n\nKeep your tools and materials in one place so you do not waste time searching. Take a photo before and after, so you can see your progress. Progress you can see is progress you will keep.')+
sec(3,'Common Mistakes To Avoid','The most common mistake is trying to do everything at once. The second is copying someone else without thinking about your own space, budget and time. What works for a large home may not work for a small room — and that is fine.\n\nAnother mistake is ignoring the basics: light, space and comfort. Get those right first, and the details will look better. Finally, do not wait for perfect. Start with what you have, improve a little each week, and let the result grow.')+
sec(4,'A Simple Plan For This Week','Day 1: pick your focus area and clear it. Day 2: try one idea from this guide. Day 3: fix the one thing that bothers you most. Day 4: add one small finishing touch. Day 5: take a photo, compare it with day 1, and plan next week.\n\nThat is the whole plan. Small steps, done daily, beat big plans that never start. If you follow this for a month, the change will be easy to see — and easy to keep.')+
'\n## Tips That Make A Real Difference\n\n- Start small. One room, one corner, one idea at a time.\n- Use what you already own before buying anything new.\n- Choose light colours and good light — they make a small space feel bigger.\n- Keep it simple. A clean, calm space beats a crowded one.\n- Review once a week: what worked, what did not, what is next?\n'+
'\n## Frequently Asked Questions\n\n**Is '+t.toLowerCase()+' expensive?**\nNo. Start with free or low-cost changes first. Spend only after you know what actually works for you.\n\n**How long does it take to see results?**\nMost people see a clear difference in the first week if they follow one small step a day.\n\n**Do I need experience?**\nNo. This guide is written for beginners. Follow the steps in order and you will be fine.\n\n**Can I do this in a small space?**\nYes — small spaces often work best, because every small change is easy to see.\n\n**What should I do next?**\nPick one idea from this article and try it today. Then come back next week for the next step.\n'+
'\n---\nMeta description: '+meta+'\nSlug: '+slug+'\n';
  return {text:body, meta, slug, title:t};
}
function showArticle(title, metaLine, text, sourceLabel, image){
  currentArticle = text;
  $('articleOut').style.display='block';
  $('articleTitle').textContent = title;
  $('articleMeta').textContent = metaLine + '  •  ' + sourceLabel;
  $('articleText').textContent = text;
  const box=$('articleImages'); box.innerHTML='';
  if(image && image.image_base64){
    const w=document.createElement('div');
    const im=document.createElement('img');
    im.src='data:'+(image.image_content_type||'image/png')+';base64,'+image.image_base64;
    im.className='art-canvas'; im.style.width='100%'; im.style.height='auto';
    w.appendChild(im);
    const p=document.createElement('p'); p.className='small muted'; p.textContent='AI-generated cover image — Workers AI image model'; w.appendChild(p);
    box.appendChild(w);
  }
  const labels=['Cover image — '+title, 'Section image — getting started', 'Section image — ideas in action'];
  const startIdx = (image && image.image_base64) ? 1 : 0;
  labels.slice(startIdx).forEach((lab,i)=>{ const w=document.createElement('div'); const c=makeCanvas(800,450); drawImage(c, title, lab, i+startIdx); w.appendChild(c); const p=document.createElement('p'); p.className='small muted'; p.textContent='Generated image — '+lab+' (canvas placeholder)'; w.appendChild(p); box.appendChild(w); });
  state.latest=title+' — '+slugify(title); save();
}
async function generateArticle(){
  const topic=$('topic').value.trim();
  if(!topic){ toast('Please enter a topic first.'); $('topic').focus(); return; }
  const btn = document.querySelector('button[onclick="generateArticle()"]');
  if(btn){ btn.disabled=true; btn.textContent='Generating with real AI… (up to ~90 sec)'; }
  $('writerNote').textContent='Generating with real AI (Workers AI) — this takes up to about 90 seconds. Please wait…';
  try{
    const a = await api('/api/generate-article', {method:'POST', body: JSON.stringify({topic, language: $('lang').value || 'English'})});
    currentArticleMeta = {title: a.title, slug: a.seo && a.seo.slug, meta_description: a.seo && a.seo.meta_description, image: a.image || null};
    showArticle(a.title, 'Slug: '+(a.seo&&a.seo.slug||'')+'  •  '+a.word_count+' words  •  Meta: '+(a.seo&&a.seo.meta_description||''), a.draft, 'Source: '+(a.generated_by||'Workers AI')+(a.image_failed?' — AI cover image failed, canvas placeholders used':''), a.image || null);
    $('writerNote').textContent='Real AI article generated for "'+topic+'" ('+a.word_count+' words). You can copy it, download it, save as draft, or publish it to Blogger.';
    toast('Real AI article generated — '+topic);
    log('AI article generated: '+topic+' ('+a.word_count+' words)');
    refreshStatus();
  }catch(e){
    // Offline template fallback — labelled honestly, never passed off as AI.
    const a=articleTextFor(topic); currentArticleMeta = {title: a.title, slug: a.slug, meta_description: a.meta, image: null};
    showArticle(a.title, 'Slug: '+a.slug+'  •  Meta: '+a.meta, a.text, 'Source: OFFLINE TEMPLATE — AI unavailable: '+e.message, null);
    $('writerNote').textContent='AI was unavailable ('+e.message+'). This article is from the offline template — try again in a minute for a real AI article.';
    toast('AI unavailable — offline template used: '+e.message);
    log('Article fallback (template): '+topic+' — '+e.message);
  }finally{
    if(btn){ btn.disabled=false; btn.textContent='Generate Article + Images'; }
  }
}
function saveDraft(){ if(!currentArticle){ toast('Generate an article first.'); return; } log('Draft saved: '+($('topic').value||'Untitled')); toast('Draft saved.'); }
async function publishArticle(){
  if(!currentArticle){ toast('Generate an article first.'); go('writer'); return; }
  if(!state.blogger){ toast('Blogger is not connected — connect it in Connections first.'); go('connections'); return; }
  if(!state.bloggerBlogId){ toast('Select a blog first in Connections.'); go('connections'); return; }
  try{
    const r = await api('/api/blogger/publish', {method:'POST', body: JSON.stringify({title: (currentArticleMeta&&currentArticleMeta.title)||$('topic').value, draft: currentArticle, image: (currentArticleMeta&&currentArticleMeta.image)||null})});
    toast('Published to Blogger: ' + r.url);
    log('Published to Blogger: ' + r.url);
    refreshStatus();
  }catch(e){ toast('Publish failed: '+e.message); log('Blogger publish failed: '+e.message); }
}
function copyArticle(){ if(!currentArticle){ toast('Generate an article first.'); return; } navigator.clipboard.writeText(currentArticle).then(()=>toast('Article copied.')).catch(()=>toast('Copy blocked by browser — use Download instead.')); }
function downloadArticle(){ if(!currentArticle){ toast('Generate an article first.'); return; } const b=new Blob([currentArticle],{type:'text/plain'}); const u=URL.createObjectURL(b); const a=document.createElement('a'); a.href=u; a.download=slugify($('topic').value||'blogneo-article')+'.txt'; a.click(); URL.revokeObjectURL(u); toast('Article downloaded.'); }

// ---------- Pin Generator ----------
function pinSeoFor(topic){
  const t=(topic||'Cozy home decor').trim();
  return { title: t+' — Simple Ideas That Actually Work',
    desc: 'Discover '+t.toLowerCase()+' with simple, practical ideas you can try today. Save this pin for later and visit the blog for the full guide, tips and FAQ.',
    tags: '#'+slugify(t).replace(/-/g,'')+' #HomeDecor #Blogging #PinterestTips #DIYHome #CozyHome' };
}
async function generatePins(){
  const topic=$('pinTopic').value.trim();
  if(!topic){ toast('Please enter a topic for the pins.'); return; }
  $('pinOut').style.display='block';
  const box=$('pinDesigns'); box.innerHTML='';
  const subs=['Save this for later','Simple ideas, big difference','Full guide on the blog'];
  for(let i=0;i<3;i++){ const w=document.createElement('div'); const c=document.createElement('canvas'); c.width=1000; c.height=1500; c.className='pin-canvas'; drawImage(c, topic, subs[i]+' — Pin '+(i+1), i); w.appendChild(c); const p=document.createElement('p'); p.className='small muted'; p.textContent='Pin '+(i+1)+' — 1000 × 1500 • '+subs[i]; w.appendChild(p); box.appendChild(w); }
  let seo=pinSeoFor(topic), sourceLabel=' (template SEO)';
  try{
    const r = await api('/api/pins', {method:'POST', body: JSON.stringify({topic})});
    if(r.draft){ $('pinTitle').textContent='AI pin concepts ready — see below'; $('pinDesc').textContent=r.draft.slice(0,500); $('pinTags').textContent=pinSeoFor(topic).tags; sourceLabel=' (AI pin copy: '+r.generated_by+')'; }
  }catch(e){ seo=pinSeoFor(topic); $('pinTitle').textContent=seo.title; $('pinDesc').textContent=seo.desc; $('pinTags').textContent=seo.tags; }
  if(!$('pinTitle').textContent){ $('pinTitle').textContent=seo.title; $('pinDesc').textContent=seo.desc; $('pinTags').textContent=seo.tags; }
  toast('3 pins generated for "'+topic+'"'+sourceLabel+'.'); log('Pins generated: '+topic+sourceLabel);
}
function buildPinsFromArticle(){ const t=$('topic').value.trim(); if(t){ $('pinTopic').value=t; } generatePins(); }
async function publishPins(){
  if($('pinOut').style.display==='none'){ toast('Generate pins first.'); return; }
  if(!state.pinterest){ toast('Pinterest is not connected — connect it in Connections first.'); go('connections'); return; }
  try{
    const r = await api('/api/pinterest/publish', {method:'POST', body: JSON.stringify({title: $('pinTitle').textContent, description: $('pinDesc').textContent, board_id: null, image_base64: (currentArticleMeta&&currentArticleMeta.image&&currentArticleMeta.image.image_base64)||null})});
    toast('Pin published to Pinterest: ' + r.url);
    log('Published pin to Pinterest: ' + r.url);
  }catch(e){ toast('Pin publish failed: '+e.message); log('Pinterest publish failed: '+e.message); }
}
function copyPinSeo(){ const s=$('pinTitle').textContent+'\n'+$('pinDesc').textContent+'\n'+$('pinTags').textContent; navigator.clipboard.writeText(s).then(()=>toast('Pin SEO text copied.')).catch(()=>toast('Copy blocked by browser.')); }

// ---------- Connections (REAL backend state — no fake "mark Connected") ----------
function connectBlogger(){
  window.open(API + '/api/blogger/auth?device=' + encodeURIComponent(deviceId()), '_blank');
  toast('Google authorize page opened in a new tab. After approving, you will return to BlogNeo.');
  log('Blogger Connect opened (Google OAuth via BlogNeo API).');
}
function connectPinterest(){
  window.open(API + '/api/pinterest/auth?device=' + encodeURIComponent(deviceId()), '_blank');
  toast('Pinterest authorize page opened in a new tab. After approving, you will return to BlogNeo.');
  log('Pinterest Connect opened (Pinterest OAuth via BlogNeo API).');
}
async function disconnect(which){
  try{ await api('/api/' + which + '/disconnect', {method:'POST', body: '{}'}); }catch(e){ /* already disconnected */ }
  state[which]=false; save(); renderBadges(); renderDashboard();
  if(which==='blogger'){
    state.bloggerBlogId=''; state.bloggerBlogName=''; state.bloggerLocked=false;
    const wrap=$('blogPicker'); if(wrap) wrap.style.display='none';
  }
  toast((which==='blogger'?'Blogger':'Pinterest')+' disconnected.');
  log((which==='blogger'?'Blogger':'Pinterest')+' disconnected.');
}
// ---------- Blog picker (Free = pick ONE blog, then it auto-locks) ----------
async function loadBlogPicker(){
  const wrap = $('blogPicker'); if(!wrap) return;
  if(!state.blogger){ wrap.style.display='none'; return; }
  wrap.style.display='';
  try{
    const r = await api('/api/blogger/blogs');
    const sel = $('blogSelect');
    sel.innerHTML='';
    (r.blogs||[]).forEach(b=>{
      const o=document.createElement('option'); o.value=b.id; o.textContent=b.name+(b.url?' ('+b.url+')':''); sel.appendChild(o);
    });
    if(!r.blogs || !r.blogs.length){ const o=document.createElement('option'); o.value=''; o.textContent='No blogs found on this Blogger account'; sel.appendChild(o); }
    if(r.selected_blog_id) sel.value = r.selected_blog_id;
    state.bloggerLocked = !!r.locked;
    state.bloggerBlogId = r.selected_blog_id || '';
    const locked = !!r.locked, isPro = (r.plan||state.plan)==='pro';
    sel.disabled = locked;
    const saveBtn = $('blogSaveBtn'); if(saveBtn) saveBtn.disabled = locked;
    $('blogLockNote').textContent = locked
      ? '🔒 Locked — Free plan allows 1 blog. Upgrade to Pro to change.'
      : isPro ? 'Pro plan — you can change your blog anytime.'
      : 'Pick your one blog — Free plan locks your choice after you save it.';
    save();
  }catch(e){
    $('blogLockNote').textContent = 'Could not load your blogs: '+e.message;
  }
}
async function selectBlog(){
  const id = $('blogSelect').value;
  if(!id){ toast('Pick a blog first.'); return; }
  const btn = $('blogSaveBtn'); btn.disabled = true; btn.textContent = 'Saving…';
  try{
    const r = await api('/api/blogger/select-blog', {method:'POST', body: JSON.stringify({blog_id: id})});
    toast('Blog selected: ' + (r.blog && r.blog.name ? r.blog.name : id));
    log('Blogger blog selected: ' + (r.blog && r.blog.name ? r.blog.name : id));
    refreshStatus();
  }catch(e){
    toast(e.message || 'Could not save the blog.');
    btn.disabled = false; btn.textContent = 'Save Blog';
  }
}
// ---------- Daily Auto Flow (backend settings + real runs) ----------
async function loadAutoFlow(){
  try{
    const s = await api('/api/status');
    if(s.auto){ state.autoOn=!!s.auto.auto_on; state.autoTime=s.auto.run_time||'08:00'; state.autoNiche=s.auto.niche||state.autoNiche; }
    if(s.runs && s.runs.length){
      const html = s.runs.map(r=>'<div>'+esc((r.created_at||'').slice(0,16).replace('T',' ')+' — '+r.niche+' → '+r.status+(r.blogger_url?' — '+r.blogger_url:'')+(r.error?' — '+r.error:''))+'</div>').join('');
      if($('runLog')) $('runLog').innerHTML=html;
    }
    save(); renderAuto();
  }catch(e){ renderAuto(); }
}
async function toggleAuto(){
  state.autoOn=$('autoToggle').checked; state.autoTime=$('autoTime').value||'08:00'; state.autoNiche=$('autoNiche').value.trim()||'Cozy home decor'; save(); renderAuto();
  try{
    await api('/api/autoflow', {method:'POST', body: JSON.stringify({niche: state.autoNiche, run_time: state.autoTime, articles_per_day: Number($('autoCount').value)||1, auto_on: state.autoOn})});
    toast(state.autoOn ? 'Auto Flow is ON — saved on the server, runs daily at '+state.autoTime+'.' : 'Auto Flow is OFF — saved on the server.');
  }catch(e){ toast('Could not save Auto Flow on the server: '+e.message); }
  log('Auto Flow '+(state.autoOn?'turned ON — daily '+state.autoTime+' — niche: '+state.autoNiche:'turned OFF.'));
}
function renderAuto(){
  $('autoToggle').checked=state.autoOn;
  $('autoTime').value=state.autoTime; $('autoNiche').value=state.autoNiche;
  $('autoState').textContent = state.autoOn ? 'Auto Flow is ON' : 'Auto Flow is OFF';
  const b=$('autoBadge'); b.textContent=state.autoOn?'ON':'OFF'; b.className='badge '+(state.autoOn?'on':'off');
  $('nextRun').textContent = state.autoOn ? 'Next run: tomorrow at '+state.autoTime+' (Dhaka time) — niche "'+state.autoNiche+'", '+($('autoCount').value||'1')+' article(s) per day. Runs on the server (Pro plan only).' : 'Next run: — (turn Auto Flow ON to schedule)';
}
async function runNow(){
  if(state.plan!=='pro'){ toast('Daily auto run needs the Pro plan. Upgrade to Pro first.'); go('subscription'); return; }
  try{
    toast('Running the real auto flow on the server — this takes up to ~90 seconds…');
    const r = await api('/api/cron/run-now', {method:'POST', body: '{}'});
    toast('Auto run done — ' + (r.bloggerUrl ? 'published: ' + r.bloggerUrl : 'article generated (Blogger not connected yet)') + (r.error ? ' — ' + r.error : ''));
    log('Auto Flow run (server): ' + (r.bloggerUrl || 'generated, not published') + (r.error ? ' — ' + r.error : ''));
    refreshStatus(); loadAutoFlow();
  }catch(e){ toast('Auto run failed: '+e.message); log('Auto Flow run failed: '+e.message); }
}

// ---------- Subscription ----------
function chooseFree(){ state.plan='free'; save(); renderBadges(); renderDashboard(); toast('Free plan selected.'); log('Plan: Free.'); }
function showProPay(){ $('payBox').style.display='block'; $('payBox').scrollIntoView({behavior:'smooth'}); }
async function markPaid(){
  try{
    await api('/api/plan/paid', {method:'POST', body: JSON.stringify({email: getEmail()})});
    state.plan='pro-pending'; save(); renderBadges(); renderDashboard();
    toast('Marked as Paid — Pro activates within 24h after confirmation.');
    log('Pro payment marked as paid (pending activation).');
  }catch(e){ toast('Could not record payment: '+e.message); }
}

// ---------- Init ----------
// Boot splash: covers the first paint so a logged-in user never sees the
// login screen (or the logged-out landing page) flash while /api/auth/me
// is still checking the session. Hidden only after initAuth has decided
// the real page. A failsafe timer hides it even if the check hangs.
function hideBoot(){ const s=$('bootSplash'); if(s) s.style.display='none'; }
async function initAuth(){
  const q = new URLSearchParams(location.search);
  // Google sign-in returns here with a session token in the URL.
  if(q.get('auth_token')){
    setSession(q.get('auth_token'), q.get('auth_email') || '', true);
    history.replaceState({}, '', location.pathname);
    toast('Signed in with Google — welcome!');
  }
  if(q.get('auth_error')){ toast('Google sign-in failed: ' + q.get('auth_error')); history.replaceState({}, '', location.pathname); }
  if(isAuthed()){
    try{
      const me = await api('/api/auth/me');
      state.plan = me.plan || state.plan;
      renderAuthUI();
      refreshStatus(); loadAutoFlow(); renderBadges(); renderDashboard(); renderAuto(); renderLog();
      go('dashboard');
      hideBoot();
      return;
    }catch(e){ clearSession(); } // bad/expired token — fall through to login screen
  }
  renderAuthUI(); renderBadges(); renderDashboard(); renderAuto(); renderLog();
  if(isGuest()){ go('dashboard'); }
  else {
    // Fast login is the first screen when logged out.
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    $('page-login').classList.add('active');
    renderAuthUI();
  }
  hideBoot();
}
(function init(){
  const q = new URLSearchParams(location.search);
  if(q.get('connected')==='blogger' && q.get('ok')){ toast('Blogger connected successfully!'); log('Blogger connected via OAuth.'); }
  if(q.get('connected')==='pinterest' && q.get('ok')){ toast('Pinterest connected successfully!'); log('Pinterest connected via OAuth.'); }
  if(q.get('error')){ toast('Connection failed: '+q.get('error')); }
  // NOTE: do NOT strip the URL here — initAuth() needs ?auth_token= from
  // the Google sign-in callback. initAuth strips it after reading.
  if(!q.get('auth_token') && !q.get('auth_error')) history.replaceState({}, '', location.pathname);
  // Failsafe: never trap the user behind the splash if the session check hangs.
  setTimeout(hideBoot, 8000);
  initAuth();
})();
