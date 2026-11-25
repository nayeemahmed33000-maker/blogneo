// BlogNeo MVP v1 — all client-side, localStorage demo state. No secrets, no API keys.
const KEY = 'blogneo_v1';
const $ = id => document.getElementById(id);
const now = () => new Date().toLocaleString('en-GB', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
let state = {blogger:false, pinterest:false, googleId:'', pinId:'', plan:'free', autoOn:false, autoTime:'08:00', autoNiche:'Cozy home decor', articles:0, pins:0, log:[], latest:''};
try { const s = JSON.parse(localStorage.getItem(KEY) || '{}'); state = {...state, ...s}; } catch(e) {}

function save(){ localStorage.setItem(KEY, JSON.stringify(state)); }
function toast(msg){ const t=$('toast'); t.textContent=msg; t.style.display='block'; clearTimeout(t._h); t._h=setTimeout(()=>t.style.display='none', 3800); }
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
function go(page){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const el=$('page-'+page); if(el) el.classList.add('active');
  document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active', b.dataset.page===page));
  if(page==='dashboard') renderDashboard();
  window.scrollTo({top:0, behavior:'smooth'});
}
document.querySelectorAll('#nav button').forEach(b=>b.addEventListener('click', ()=>go(b.dataset.page)));

// ---------- Dashboard ----------
function renderDashboard(){
  $('statArticles').textContent = state.articles;
  $('statPins').textContent = state.pins;
  $('statBlogger').textContent = state.blogger ? 'Connected' : 'Not connected';
  $('statPinterest').textContent = state.pinterest ? 'Connected' : 'Not connected';
  $('dashAuto').textContent = state.autoOn ? 'ON — runs daily at '+state.autoTime+' for niche "'+state.autoNiche+'".' : 'Off — turn it on in Daily Auto Flow.';
  $('dashPlan').textContent = state.plan==='pro' ? 'Pro plan — daily auto flow unlocked.' : state.plan==='pro-pending' ? 'Pro — payment pending (activation within 24h after confirmation).' : 'Free plan — 1 blog, 3 articles/month, manual pins.';
  $('dashLatest').textContent = state.latest || 'No article yet. Generate one in Article Writer.';
  renderLog(); renderBadges();
}
function renderBadges(){
  const bB=$('badgeBlogger'), bP=$('badgePinterest');
  if(bB){ bB.textContent = state.blogger?'Connected':'Not connected'; bB.className='badge '+(state.blogger?'on':'off'); }
  if(bP){ bP.textContent = state.pinterest?'Connected':'Not connected'; bP.className='badge '+(state.pinterest?'on':'off'); }
  const pb=$('planBadge');
  if(pb){ pb.textContent = state.plan==='pro'?'Pro':state.plan==='pro-pending'?'Pro — Pending':'Free'; pb.className='badge '+(state.plan==='pro'?'on':'off'); }
  if($('planNote')) $('planNote').textContent = state.plan==='pro-pending' ? 'Payment sent — Pro activates within 24h after confirmation.' : '';
  if($('ownerNote')) $('ownerNote').textContent = (state.googleId||state.pinId) ? 'Saved in this browser. Google Client ID: '+(state.googleId?'saved ✓':'not set')+' · Pinterest App ID: '+(state.pinId?'saved ✓':'not set') : 'No Client IDs saved yet.';
}

// ---------- Canvas images ----------
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

// ---------- Article Writer ----------
let currentArticle='';
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
'\n---\nMeta description: '+meta+'\nSlug: '+slug+'\nWord count: about 1000-1500 words (generated from your topic).\n';
  return {text:body, meta, slug, title:t};
}
function generateArticle(){
  const topic=$('topic').value.trim();
  if(!topic){ toast('Please enter a topic first.'); $('topic').focus(); return; }
  const a=articleTextFor(topic); currentArticle=a.text;
  $('articleOut').style.display='block';
  $('articleTitle').textContent=a.title;
  $('articleMeta').textContent='Slug: '+a.slug+'  •  Meta: '+a.meta;
  $('articleText').textContent=a.text;
  const box=$('articleImages'); box.innerHTML='';
  const labels=['Cover image — '+topic, 'Section image — getting started', 'Section image — ideas in action'];
  labels.forEach((lab,i)=>{ const w=document.createElement('div'); const c=makeCanvas(800,450); drawImage(c, topic, lab, i); w.appendChild(c); const p=document.createElement('p'); p.className='small muted'; p.textContent='Generated image — '+lab; w.appendChild(p); box.appendChild(w); });
  state.latest=a.title+' — '+a.slug; save();
  $('writerNote').textContent='Article generated for "'+topic+'". You can copy it, download it, save as draft, or publish it to Blogger.';
  toast('Article generated — '+topic);
  log('Article generated: '+topic);
}
function saveDraft(){ if(!currentArticle){ toast('Generate an article first.'); return; } log('Draft saved: '+($('topic').value||'Untitled')); toast('Draft saved.'); }
function publishArticle(){
  if(!currentArticle){ toast('Generate an article first.'); go('writer'); return; }
  if(!state.blogger){ toast('Demo — connect Blogger in Connections to publish for real.'); log('Publish to Blogger (demo, not connected): '+$('topic').value); return; }
  state.articles++; save(); renderDashboard();
  toast('Published to Blogger (demo mode — connect a real Blogger API to publish live).');
  log('Published to Blogger: '+$('topic').value);
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
function generatePins(){
  const topic=$('pinTopic').value.trim();
  if(!topic){ toast('Please enter a topic for the pins.'); return; }
  $('pinOut').style.display='block';
  const box=$('pinDesigns'); box.innerHTML='';
  const subs=['Save this for later','Simple ideas, big difference','Full guide on the blog'];
  for(let i=0;i<3;i++){ const w=document.createElement('div'); const c=document.createElement('canvas'); c.width=1000; c.height=1500; c.className='pin-canvas'; drawImage(c, topic, subs[i]+' — Pin '+(i+1), i); w.appendChild(c); const p=document.createElement('p'); p.className='small muted'; p.textContent='Pin '+(i+1)+' — 1000 × 1500 • '+subs[i]; w.appendChild(p); box.appendChild(w); }
  const seo=pinSeoFor(topic);
  $('pinTitle').textContent=seo.title; $('pinDesc').textContent=seo.desc; $('pinTags').textContent=seo.tags;
  toast('3 pins generated for "'+topic+'".'); log('Pins generated: '+topic);
}
function buildPinsFromArticle(){ const t=$('topic').value.trim(); if(t){ $('pinTopic').value=t; } generatePins(); }
function publishPins(){
  if($('pinOut').style.display==='none'){ toast('Generate pins first.'); return; }
  if(!state.pinterest){ toast('Demo — connect Pinterest in Connections to publish for real.'); log('Publish to Pinterest (demo, not connected): '+$('pinTopic').value); return; }
  state.pins+=3; save(); renderDashboard();
  toast('3 pins published to Pinterest (demo mode — connect a real Pinterest API to publish live).');
  log('Published 3 pins to Pinterest: '+$('pinTopic').value+' → '+$('pinBoard').value);
}
function copyPinSeo(){ const s=$('pinTitle').textContent+'\n'+$('pinDesc').textContent+'\n'+$('pinTags').textContent; navigator.clipboard.writeText(s).then(()=>toast('Pin SEO text copied.')).catch(()=>toast('Copy blocked by browser.')); }

// ---------- Connections ----------
function callbackUrl(){ return location.origin + '/oauth-callback.html'; }
function connectBlogger(){
  if(!state.googleId){ toast('Owner must paste the Google Client ID in Owner Settings first.'); $('googleId').focus(); go('connections'); return; }
  const u='https://accounts.google.com/o/oauth2/v2/auth?client_id='+encodeURIComponent(state.googleId)+'&redirect_uri='+encodeURIComponent(callbackUrl())+'&response_type=code&scope='+encodeURIComponent('https://www.googleapis.com/auth/blogger')+'&access_type=offline&prompt=consent';
  window.open(u,'_blank'); toast('Google authorize page opened in a new tab.'); log('Blogger Connect opened (Google OAuth).');
}
function connectPinterest(){
  if(!state.pinId){ toast('Owner must paste the Pinterest App ID in Owner Settings first.'); $('pinId').focus(); go('connections'); return; }
  const u='https://www.pinterest.com/oauth/?client_id='+encodeURIComponent(state.pinId)+'&redirect_uri='+encodeURIComponent(callbackUrl())+'&response_type=code&scope='+encodeURIComponent('boards:read,pins:read,pins:write')+'&state=blogneo';
  window.open(u,'_blank'); toast('Pinterest authorize page opened in a new tab.'); log('Pinterest Connect opened (Pinterest OAuth).');
}
function confirmConnect(which){ state[which]=true; save(); renderBadges(); renderDashboard(); toast((which==='blogger'?'Blogger':'Pinterest')+' marked as Connected (demo state saved).'); log((which==='blogger'?'Blogger':'Pinterest')+' connected (confirmed by user).'); }
function disconnect(which){ state[which]=false; save(); renderBadges(); renderDashboard(); toast((which==='blogger'?'Blogger':'Pinterest')+' disconnected.'); log((which==='blogger'?'Blogger':'Pinterest')+' disconnected.'); }
function saveOwnerIds(){ state.googleId=$('googleId').value.trim(); state.pinId=$('pinId').value.trim(); save(); renderBadges(); toast('Owner IDs saved in this browser.'); log('Owner IDs saved.'); }
function clearOwnerIds(){ state.googleId=''; state.pinId=''; $('googleId').value=''; $('pinId').value=''; save(); renderBadges(); toast('Owner IDs cleared.'); }

// ---------- Daily Auto Flow ----------
function toggleAuto(){
  state.autoOn=$('autoToggle').checked; state.autoTime=$('autoTime').value||'08:00'; state.autoNiche=$('autoNiche').value.trim()||'Cozy home decor'; save(); renderAuto();
  toast(state.autoOn ? 'Auto Flow is ON — runs daily at '+state.autoTime+'.' : 'Auto Flow is OFF.');
  log('Auto Flow '+(state.autoOn?'turned ON — daily '+state.autoTime+' — niche: '+state.autoNiche:'turned OFF.'));
}
function renderAuto(){
  $('autoToggle').checked=state.autoOn;
  $('autoTime').value=state.autoTime; $('autoNiche').value=state.autoNiche;
  $('autoState').textContent = state.autoOn ? 'Auto Flow is ON' : 'Auto Flow is OFF';
  const b=$('autoBadge'); b.textContent=state.autoOn?'ON':'OFF'; b.className='badge '+(state.autoOn?'on':'off');
  $('nextRun').textContent = state.autoOn ? 'Next run: tomorrow at '+state.autoTime+' (Dhaka time) — niche "'+state.autoNiche+'", '+($('autoCount').value||'1')+' article(s) per day.' : 'Next run: — (turn Auto Flow ON to schedule)';
}
function runNow(){
  const niche=$('autoNiche').value.trim()||'Cozy home decor';
  $('topic').value=niche; generateArticle();
  $('pinTopic').value=niche; generatePins();
  state.articles++; state.pins+=3; save(); renderDashboard();
  log('Auto Flow run (demo): article + 3 pins for "'+niche+'" → Blogger: '+$('autoBlog').value+' • Pinterest: '+$('autoBoard').value);
  toast('Demo run done — 1 article + 3 pins generated and logged.');
  renderAuto();
}

// ---------- Subscription ----------
function chooseFree(){ state.plan='free'; save(); renderBadges(); renderDashboard(); toast('Free plan selected.'); log('Plan: Free.'); }
function showProPay(){ $('payBox').style.display='block'; $('payBox').scrollIntoView({behavior:'smooth'}); }
function markPaid(){ state.plan='pro-pending'; save(); renderBadges(); renderDashboard(); toast('Marked as Paid — Pro activates within 24h after confirmation.'); log('Pro payment marked as paid (pending activation).'); }

// ---------- Init ----------
$('googleId').value=state.googleId||''; $('pinId').value=state.pinId||'';
$('autoTime').value=state.autoTime; $('autoNiche').value=state.autoNiche;
renderBadges(); renderDashboard(); renderAuto(); renderLog();
