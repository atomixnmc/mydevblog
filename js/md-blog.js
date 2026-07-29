const BLOG = {
  posts: [],
  ghRepos: [],
  currentTopic: null,

  // Personal voice templates keyed by topic
  voice: {
    'React': (p) => `> 💭 *Personal note:* I've been tracking React since its v0.3 days — back when `createClass` was the only game in town and JSX felt like a weird experiment. Every new release peels back another layer of abstraction. With ${p.title.split(':')[0]}, I found myself wondering: _are we finally getting the right defaults, or just different defaults?_`,
    'Game Dev': (p) => `> 🎮 *Dev log:* Game dev has this unique property — you ship a broken build and it's funny, not catastrophic. Recently I was pair-debugging a libGDX sprite batching issue with a friend at 2 AM. Turned out to be a texture atlas page size. ${p.title} digs into stuff like that.`,
    'Microservices': (p) => `> ⚡ *From the trenches:* Microservices are like hosting a dinner party where every dish has its own kitchen. I've been running Node/NestJS services in production since 2018, and the patterns that survive are the boring ones — predictable retries, bounded queues, and knowing when _not_ to split a service.`,
    'Fractals': (p) => `> 🌀 *Late-night rabbit hole:* There's something meditative about watching a Mandelbrot deep-zoom render. I once left one running overnight and dreamed in complex planes. Fractals teach you that simple rules + iteration = infinite complexity. Kind of like software.`,
    'Geometry & Maths': (p) => `> 📐 *Math is cheating:* Every time I implement a spatial index or hex grid, I'm reminded that the best optimizations aren't algorithmic — they're mathematical. A hex coordinate system isn't clever code; it's clever _geometry_. Cross-reference with Knuth's "premature optimization" and you get the sweet spot.`,
    'Frontend': (p) => `> 🖼️ *Framework fatigue?* Maybe. But I learned more from comparing Solid's signals to Angular's signals than from any single framework tutorial. ${p.title} is part of that ongoing investigation — what does "reactivity" actually _mean_ across implementations?`,
    'React Native': (p) => `> 📱 *Mobile reality check:* React Native promised "learn once, write anywhere." What it delivered was "debug once, cry everywhere." But damn, when Hermes hits 60fps and the bridge doesn't drop a frame, it feels like magic. ${p.title} explores that tension.`,
    'AI': (p) => `> 🤖 *Prompting humans:* I spent a week fine-tuning a 7B model for code generation and learned that the hardest part isn't the model — it's knowing what you actually want. LLMs mirror our own fuzzy thinking back at us. ${p.title} is me trying to think less fuzzy.`,
    'Logistics': (p) => `> 🚚 *The boring stuff matters:* Logistics optimization isn't glamorous. But when a Grasshopper-solved VRP shaves 12% off delivery fuel costs, that's real impact. I worked with a small logistics team in 2022 applying metaheuristics to last-mile delivery — ${p.title} builds on that experience.`,
    'Graphs & AI': (p) => `> 🕸️ *Graphs are the new tables:* I became obsessed with hypergraphs after realizing that property graphs couldn't express n-ary relationships cleanly. Causal graphs, GNNs, hypergraphs — ${p.title} is part of a running series on _why graphs matter for AI_.`,
    'i2c': (p) => `> 🔗 *Ecosystem thinking:* Building the i2c stack (HyperGraph, Fluid, Rings) has been my longest-running research thread. The idea: what if data, index, and program weren't separate layers but a single graph? ${p.title} documents the wins and the bruises.`,
    'AniGo': (p) => `> 🎬 *The AI animator:* AniGo started as a question: "Can an LLM direct animation keyframes?" The answer is yes, but it needs guardrails — literally, constraint gradients. ${p.title} is the technical story behind making AI-generated motion _not_ look uncanny.`,
    'Long': (p) => `> 🔧 *Runtime archaeology:* Building a polyglot runtime from scratch isn't just hard — it's _humbling_. Long started as "what if JS ran on a graph?" and turned into "what if _every_ language ran on a graph?" ${p.title} is a piece of that journey.`,
    'Jigsaw': (p) => `> 🔐 *Trust is a spectrum:* Jigsaw came from a simple insight: verification isn't binary. A piece of evidence can be plausible, corroborated, or attested. Graded trust changes how you think about security. Here's the crypto-meets-identity thinking behind it.`,
    'Lac': (p) => `> 🧩 *The glue layer:* Lac exists so you can swap runtimes without touching business logic. Think of it as the HAL from _2001: A Space Odyssey_ — but for computation, not spaceships. Hopefully fewer homicidal outbursts.`,
    'Uploop': (p) => `> 🌐 *Framework from the future:* Uploop flips the script: instead of components calling APIs, entities declare what they _are_ and the framework generates the rest. It's reactive, graph-native, and AI-readable. ${p.title} is the deep dive.`,
    'Meta': (p) => `> 📝 *Meta moment:* This blog itself is a project. Shoelace WebComponents, client-side Markdown, AI-generated images. ${p.title} is self-referential — a blog post about building the blog. How very 2026 of me.`,
  },

  // Fallback voice for topics not listed
  fallbackVoice(p) {
    const t = p.topic || 'tech';
    const voices = [
      `> 💡 *Wandering thought:* I was revisiting ${t} the other day and realized how much the landscape shifted since I first encountered it. ${p.title} is my attempt to capture the current state — before it shifts again.`,
      `> 🔍 *Deep dive:* ${p.title} isn't just a summary — it's what I wish I'd known when I started exploring ${t}. The docs skip the hard parts. Here they are.`,
      `> 🎯 *Why this matters:* I've been asked "why ${t}?" enough times that I wrote ${p.title} as the long-form answer. TL;DR: because the boring tools break first, and ${t} doesn't break.`,
      `> 🧠 *Hot take:* Everyone talks about ${t} like it's settled science. It's not. Here's what I've found by actually implementing it instead of just reading about it.`
    ];
    return voices[Math.floor(Math.random() * voices.length)];
  },

  personalNote(p) {
    const fn = this.voice[p.topic];
    return fn ? fn(p) : this.fallbackVoice(p);
  },

  async init() {
    await this.loadPosts();
    await this.loadRepos();
    this.renderPostList(this.posts);
    this.buildYearNav();
    this.buildTopicCloud();
    this.bindUI();
    this.checkHash();
  },

  async loadPosts() {
    this.posts = POSTS_INDEX || [];
    this.posts.sort((a, b) => new Date(b.date) - new Date(a.date));
  },

  async loadRepos() {
    try {
      const resp = await fetch('https://api.github.com/users/atomixnmc/repos?sort=updated&per_page=12');
      if (resp.ok) this.ghRepos = await resp.json();
    } catch { console.warn('[md-blog] GitHub API unavailable'); }
    this.renderRepos();
  },

  renderPostList(posts) {
    const el = document.getElementById('post-list');
    const view = document.getElementById('post-view');
    el.style.display = 'block';
    view.style.display = 'none';
    document.title = 'mydevblog — AtomixM';
    const groups = {};
    posts.forEach(p => { const y = new Date(p.date).getFullYear(); (groups[y]=groups[y]||[]).push(p); });
    const years = Object.keys(groups).sort((a,b)=>b-a);
    el.innerHTML = years.map(y => `<div class="year-group"><h3><sl-icon name="calendar-event"></sl-icon> ${y} (${groups[y].length})</h3>${groups[y].map(p=>this.postCardHTML(p)).join('')}</div>`).join('');
  },

  postImg(p) {
    const m = POST_IMAGES || {};
    const fallback = 'blog-mydevblog.png';
    const img = m[p.slug] || fallback;
    // If the mapped image uses date folders, serve from there. Otherwise use flat images/.
    if (img.includes('/')) return `images/${img}`; // date-path style: 2019/react-vintage.png
    return `images/${img}`;
  },

  postCardHTML(p) {
    const date = new Date(p.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
    const tags = (p.tags||[]).map(t=>`<sl-tag size="small" variant="neutral">${t}</sl-tag>`).join('');
    const img = this.postImg(p);
    const thumb = `<img src="${img}" alt="" class="post-thumb" loading="lazy">`;
    return `<div class="post-card" data-slug="${p.slug}">${thumb}<div class="post-card-body"><div class="meta"><span><sl-icon name="calendar"></sl-icon> ${date}</span>${p.topic?`<span><sl-icon name="bookmark"></sl-icon> ${p.topic}</span>`:''}<span><sl-icon name="clock"></sl-icon> ${p.readTime||'5'} min</span></div><h3>${p.title}</h3><div class="excerpt">${p.excerpt||''}</div>${tags?`<div class="tags">${tags}</div>`:''}</div></div>`;
  },

  async openPost(slug) {
    const post = this.posts.find(p=>p.slug===slug);
    if(!post) return;
    const el=document.getElementById('post-list'), view=document.getElementById('post-view');
    el.style.display='none'; view.style.display='block';
    document.title=`${post.title} — mydevblog`;
    let md='';
    try{ const r=await fetch(`posts/${slug}.md`); if(r.ok) md=await r.text(); else md=`# ${post.title}\n\n${post.excerpt||''}`; }
    catch(e){ md=`# ${post.title}\n\n${post.excerpt||''}`; }
    const note = this.personalNote(post);
    const combined = `${note}\n\n${md}`;
    const html=marked.parse(combined);
    const date=new Date(post.date).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
    const tags=(post.tags||[]).map(t=>`<sl-tag size="small" variant="neutral">${t}</sl-tag>`).join('');
    const img=this.postImg(post);
    const imgHtml=`<img src="${img}" alt="${post.title}" class="blog-thumb" loading="lazy">`;
    view.innerHTML=`<sl-button class="back-btn" variant="neutral" size="small" onclick="BLOG.renderPostList(BLOG.posts);history.pushState({},'',location.pathname);"><sl-icon name="arrow-left" slot="prefix"></sl-icon> Back to posts</sl-button><article><h1>${post.title}</h1><div class="post-meta"><span><sl-icon name="calendar"></sl-icon> ${date}</span><span><sl-icon name="clock"></sl-icon> ${post.readTime||'5'} min read</span>${post.topic?`<span><sl-icon name="bookmark"></sl-icon> ${post.topic}</span>`:''}${tags?`<span>${tags}</span>`:''}</div><hr>${imgHtml}${html}</article><sl-button class="back-btn" variant="neutral" size="small" onclick="BLOG.renderPostList(BLOG.posts);history.pushState({},'',location.pathname);"><sl-icon name="arrow-left" slot="prefix"></sl-icon> Back to posts</sl-button>`;
    history.pushState({},'',`#${slug}`);
    window.scrollTo({top:0,behavior:'smooth'});
  },

  buildYearNav() {
    const years=[...new Set(this.posts.map(p=>new Date(p.date).getFullYear()))].sort((a,b)=>b-a);
    const nav=document.getElementById('year-nav');
    const counts={}; this.posts.forEach(p=>{const y=new Date(p.date).getFullYear(); counts[y]=(counts[y]||0)+1;});
    nav.innerHTML=years.map(y=>`<div class="year-link" data-year="${y}"><sl-icon name="calendar-event"></sl-icon> ${y} <span class="yl-count">${counts[y]}</span></div>`).join('');
    nav.querySelectorAll('.year-link').forEach(el=>{el.addEventListener('click',()=>{const year=parseInt(el.dataset.year);this.renderPostList(this.posts.filter(p=>new Date(p.date).getFullYear()===year));document.getElementById('nav-drawer').hide();});});
  },

  buildTopicCloud() {
    const topics=[...new Set(this.posts.filter(p=>p.topic).map(p=>p.topic))].sort();
    const cloud=document.getElementById('topic-cloud');
    cloud.innerHTML=topics.map(t=>`<sl-tag size="small" variant="${this.currentTopic===t?'primary':'neutral'}" data-topic="${t}" style="cursor:pointer">${t}</sl-tag>`).join('');
    cloud.querySelectorAll('sl-tag').forEach(el=>{
      el.addEventListener('click',()=>{
        const t=el.dataset.topic;
        this.currentTopic=this.currentTopic===t?null:t;
        // Rebuild cloud with highlight
        this.buildTopicCloud();
        // Filter posts
        this.renderPostList(this.currentTopic?this.posts.filter(p=>p.topic===this.currentTopic):this.posts);
      });
    });
  },

  renderRepos() {
    const el=document.getElementById('gh-activity');
    if(this.ghRepos.length===0){ el.innerHTML='<p style="color:var(--sl-color-neutral-500);font-size:.875rem">GitHub API unavailable.</p>'; return; }
    el.innerHTML=this.ghRepos.slice(0,8).map(r=>{const lang=r.language?`<span class="ri-lang"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${this.langColor(r.language)}"></span> ${r.language}</span>`:'';const desc=r.description?`<div class="ri-desc">${r.description.slice(0,80)}${r.description.length>80?'...':''}</div>`:'';return`<div class="repo-item"><div class="ri-name"><a href="${r.html_url}" target="_blank">${r.name}</a></div>${desc}${lang}</div>`;}).join('');
  },

  langColor(l){const c={JavaScript:'#f1e05a',Rust:'#dea584',TypeScript:'#3178c6',Python:'#3572A5',Java:'#b07219',HTML:'#e34c26',CSS:'#563d7c',CoffeeScript:'#244776'};return c[l]||'#666';},

  search(q){
    if(!q.trim()){document.getElementById('search-results').innerHTML='';return;}
    const query=q.toLowerCase();
    const results=this.posts.filter(p=>p.title.toLowerCase().includes(query)||(p.excerpt||'').toLowerCase().includes(query)||(p.tags||[]).some(t=>t.toLowerCase().includes(query))||(p.topic||'').toLowerCase().includes(query));
    const el=document.getElementById('search-results');
    if(results.length===0){el.innerHTML='<p style="color:var(--sl-color-neutral-500)">No posts found.</p>';return;}
    el.innerHTML=results.slice(0,20).map(p=>{const d=new Date(p.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});return`<div class="search-result-item" data-slug="${p.slug}"><div class="sri-title">${p.title}</div><div class="sri-meta">${d} ${p.topic?`· ${p.topic}`:''}</div></div>`;}).join('');
    el.querySelectorAll('.search-result-item').forEach(e=>{e.addEventListener('click',()=>{document.getElementById('search-drawer').hide();this.openPost(e.dataset.slug);});});
  },

  toggleTheme(){
    const root=document.querySelector('html');
    const current=root.getAttribute('data-theme')||'dark';
    const next=current==='dark'?'light':'dark';
    root.setAttribute('data-theme',next);
    document.getElementById('btn-theme').innerHTML=`<sl-icon name="${next==='dark'?'moon':'sun'}"></sl-icon>`;
    document.querySelector('link[href*="shoelace"]').href=`https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.19.1/cdn/themes/${next}.css`;
    localStorage.setItem('blog-theme',next);
  },

  checkHash(){const hash=location.hash.replace('#','');if(hash&&this.posts.some(p=>p.slug===hash))setTimeout(()=>this.openPost(hash),100);},

  bindUI(){
    document.getElementById('btn-nav').addEventListener('click',()=>document.getElementById('nav-drawer').show());
    document.getElementById('btn-search').addEventListener('click',()=>document.getElementById('search-drawer').show());
    document.getElementById('btn-theme').addEventListener('click',()=>this.toggleTheme());
    if(localStorage.getItem('blog-theme')!=='dark')this.toggleTheme();
    let st;document.getElementById('search-input').addEventListener('sl-input',()=>{clearTimeout(st);st=setTimeout(()=>this.search(document.getElementById('search-input').value),250);});
    document.getElementById('blog-content').addEventListener('click',e=>{const c=e.target.closest('.post-card');if(c)this.openPost(c.dataset.slug);});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('sl-drawer[open]').forEach(d=>d.hide());});
    window.addEventListener('popstate',()=>this.checkHash());
  }
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>BLOG.init());else BLOG.init();
