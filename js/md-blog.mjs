const BLOG = {
  posts: [],
  ghRepos: [],
  currentTopic: null,

  voice: {
    React: (p) => "> \u{1F4AD} *Personal note:* I've been tracking React since its v0.3 days - back when createClass was the only game in town and JSX felt like a weird experiment. " + p.title.split(':')[0] + " - are we finally getting the right defaults, or just different defaults?",
    'Game Dev': (p) => "> \u{1F3AE} *Dev log:* Game dev has this unique property - you ship a broken build and it's funny, not catastrophic. Recently I was pair-debugging a libGDX sprite batching issue at 2 AM. Turned out to be a texture atlas page size. " + p.title + " digs into stuff like that.",
    Microservices: (p) => "> \u26A1 *From the trenches:* Microservices are like hosting a dinner party where every dish has its own kitchen. The patterns that survive are the boring ones - predictable retries, bounded queues, and knowing when _not_ to split a service.",
    Fractals: (p) => "> \u{1F300} *Late-night rabbit hole:* There is something meditative about watching a Mandelbrot deep-zoom render. I once left one running overnight and dreamed in complex planes. Fractals teach you that simple rules + iteration = infinite complexity.",
    'Geometry & Maths': (p) => "> \u{1F4D0} *Math is cheating:* Every time I implement a spatial index or hex grid, the best optimizations arent algorithmic - theyre mathematical. A hex coordinate system isnt clever code; its clever _geometry_.",
    Frontend: (p) => "> \u{1F5BC} *Framework fatigue?* Maybe. But I learned more from comparing Signals across frameworks than from any single tutorial. " + p.title + " is part of that ongoing investigation.",
    'React Native': (p) => "> \u{1F4F1} *Mobile reality check:* React Native promised learn once write anywhere. What it delivered was debug once cry everywhere. But when Hermes hits 60fps it feels like magic. " + p.title + " explores that tension.",
    AI: (p) => "> \u{1F916} *Prompting humans:* I spent a week fine-tuning a 7B model for code generation. The hardest part isnt the model - its knowing what you actually want. LLMs mirror our own fuzzy thinking back at us.",
    Logistics: (p) => "> \u{1F69A} *The boring stuff matters:* Logistics optimization isnt glamorous. But when a Grasshopper-solved VRP shaves 12% off fuel costs, thats real impact. " + p.title + " builds on that experience.",
    'Graphs & AI': (p) => "> \u{1F578} *Graphs are the new tables:* I became obsessed with hypergraphs after realizing property graphs could not express n-ary relationships cleanly. " + p.title + " is part of a running series on _why graphs matter for AI_.",
    i2c: (p) => "> \u{1F517} *Ecosystem thinking:* Building the i2c stack (HyperGraph, Fluid, Rings) has been my longest-running research thread. What if data, index, and program weren't separate layers but a single graph? " + p.title + " documents the wins and the bruises.",
    AniGo: (p) => "> \u{1F3AC} *The AI animator:* AniGo started as a question: Can an LLM direct animation keyframes? The answer is yes, but it needs guardrails - literally, constraint gradients. " + p.title + " is the technical story.",
    Long: (p) => "> \u{1F527} *Runtime archaeology:* Building a polyglot runtime from scratch isnt just hard - its _humbling_. Long started as what if JS ran on a graph and became what if _every_ language ran on a graph? " + p.title + " is a piece of that journey.",
    Jigsaw: (p) => "> \u{1F510} *Trust is a spectrum:* Jigsaw came from a simple insight: verification isnt binary. A piece of evidence can be plausible, corroborated, or attested. Graded trust changes how you think about security.",
    Lac: (p) => "> \u{1F9E9} *The glue layer:* Lac exists so you can swap runtimes without touching business logic. Think of it as the HAL from 2001 - but for computation, not spaceships.",
    Uploop: (p) => "> \u{1F310} *Framework from the future:* Uploop flips the script: instead of components calling APIs, entities declare what they _are_ and the framework generates the rest. " + p.title + " is the deep dive.",
    Meta: (p) => "> \u{1F4DD} *Meta moment:* This blog itself is a project. Shoelace WebComponents, client-side Markdown, AI-generated images. " + p.title + " is self-referential. How very 2026 of me.",
    SGMedia: (p) => "> \u{1F3E2} *Founder flashback:* SGMedia was my first real company - founded in a Saigon coffee shop in 2013, killed by YouTube adpocalypse in 2018. " + p.title + " is a piece of that story.",
    Personal: (p) => "> \u{1F30D} *Life update:* Not every post needs to be technical. Sometimes the most important migrations are the ones you make in real life - countries, cities, communities."
  },

  fallbackVoice(p) {
    const t = p.topic || 'tech';
    const voices = [
      "> \u{1F4A1} *Wandering thought:* I was revisiting " + t + " and realized how much the landscape shifted. " + p.title + " captures the current state.",
      "> \u{1F50D} *Deep dive:* " + p.title + " is what I wish Id known when I started exploring " + t + ". The docs skip the hard parts.",
      "> \u{1F3AF} *Why this matters:* Ive been asked why " + t + " enough times that I wrote " + p.title + " as the long-form answer.",
      "> \u{1F9E0} *Hot take:* Everyone talks about " + t + " like its settled science. Its not. Here is what I found by implementing it."
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
    this.posts = [...(POSTS_INDEX||[]), ...(POSTS_EXTRA||[])];
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
    document.title = 'mydevblog - AtomixM';
    const groups = {};
    posts.forEach(p => { const y = new Date(p.date).getFullYear(); (groups[y]=groups[y]||[]).push(p); });
    const years = Object.keys(groups).sort((a,b)=>b-a);
    el.innerHTML = years.map(y => '<div class="year-group"><h3><sl-icon name="calendar-event"></sl-icon> ' + y + ' (' + groups[y].length + ')</h3>' + groups[y].map(p=>this.postCardHTML(p)).join('') + '</div>').join('');
  },

  postImg(p) {
    const m = POST_IMAGES || {};
    const img = m[p.slug] || '2026/blog-relaunch.png';
    return 'images/' + img;
  },

  postCardHTML(p) {
    const date = new Date(p.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
    const tags = (p.tags||[]).map(t=>'<sl-tag size="small" variant="neutral">' + t + '</sl-tag>').join('');
    const img = this.postImg(p);
    return '<div class="post-card" data-slug="' + p.slug + '"><img src="' + img + '" alt="" class="post-thumb" loading="lazy"><div class="post-card-body"><div class="meta"><span><sl-icon name="calendar"></sl-icon> ' + date + '</span>' + (p.topic?'<span><sl-icon name="bookmark"></sl-icon> ' + p.topic + '</span>':'') + '<span><sl-icon name="clock"></sl-icon> ' + (p.readTime||'5') + ' min</span></div><h3>' + p.title + '</h3><div class="excerpt">' + (p.excerpt||'') + '</div>' + (tags?'<div class="tags">' + tags + '</div>':'') + '</div></div>';
  },

  async openPost(slug) {
    const post = this.posts.find(p=>p.slug===slug);
    if(!post) return;
    const el=document.getElementById('post-list'), view=document.getElementById('post-view');
    el.style.display='none'; view.style.display='block';
    document.title=post.title + ' - mydevblog';
    let md='';
    try{ const r=await fetch('posts/' + slug + '.md'); if(r.ok) md=await r.text(); else md='# ' + post.title + '\n\n' + (post.excerpt||''); }
    catch(e){ md='# ' + post.title + '\n\n' + (post.excerpt||''); }
    const note = this.personalNote(post);
    const html=marked.parse(note + '\n\n' + md);
    const date=new Date(post.date).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
    const tags=(post.tags||[]).map(t=>'<sl-tag size="small" variant="neutral">' + t + '</sl-tag>').join('');
    const img=this.postImg(post);
    view.innerHTML='<sl-button class="back-btn" variant="neutral" size="small" onclick="BLOG.renderPostList(BLOG.posts);history.pushState({},\'\',location.pathname);"><sl-icon name="arrow-left" slot="prefix"></sl-icon> Back to posts</sl-button><article><h1>' + post.title + '</h1><div class="post-meta"><span><sl-icon name="calendar"></sl-icon> ' + date + '</span><span><sl-icon name="clock"></sl-icon> ' + (post.readTime||'5') + ' min read</span>' + (post.topic?'<span><sl-icon name="bookmark"></sl-icon> ' + post.topic + '</span>':'') + (tags?'<span>' + tags + '</span>':'') + '</div><hr><img src="' + img + '" alt="' + post.title + '" class="blog-thumb" loading="lazy">' + html + '</article><sl-button class="back-btn" variant="neutral" size="small" onclick="BLOG.renderPostList(BLOG.posts);history.pushState({},\'\',location.pathname);"><sl-icon name="arrow-left" slot="prefix"></sl-icon> Back to posts</sl-button>';
    history.pushState({},'', '#' + slug);
    window.scrollTo({top:0,behavior:'smooth'});
  },

  buildYearNav() {
    const years=[...new Set(this.posts.map(p=>new Date(p.date).getFullYear()))].sort((a,b)=>b-a);
    const nav=document.getElementById('year-nav');
    const counts={}; this.posts.forEach(p=>{const y=new Date(p.date).getFullYear(); counts[y]=(counts[y]||0)+1;});
    nav.innerHTML=years.map(y=>'<div class="year-link" data-year="' + y + '"><sl-icon name="calendar-event"></sl-icon> ' + y + ' <span class="yl-count">' + counts[y] + '</span></div>').join('');
    nav.querySelectorAll('.year-link').forEach(el=>{el.addEventListener('click',()=>{const year=parseInt(el.dataset.year);this.renderPostList(this.posts.filter(p=>new Date(p.date).getFullYear()===year));document.getElementById('nav-drawer').hide();});});
  },

  buildTopicCloud() {
    const topics=[...new Set(this.posts.filter(p=>p.topic).map(p=>p.topic))].sort();
    const cloud=document.getElementById('topic-cloud');
    cloud.innerHTML=topics.map(t=>'<sl-tag size="small" variant="' + (this.currentTopic===t?'primary':'neutral') + '" data-topic="' + t + '" style="cursor:pointer">' + t + '</sl-tag>').join('');
    cloud.querySelectorAll('sl-tag').forEach(el=>{
      el.addEventListener('click',()=>{
        const t=el.dataset.topic;
        this.currentTopic=this.currentTopic===t?null:t;
        this.buildTopicCloud();
        this.renderPostList(this.currentTopic?this.posts.filter(p=>p.topic===this.currentTopic):this.posts);
      });
    });
  },

  renderRepos() {
    const el=document.getElementById('gh-activity');
    if(this.ghRepos.length===0){ el.innerHTML='<p style="color:var(--sl-color-neutral-500);font-size:.875rem">GitHub API unavailable.</p>'; return; }
    el.innerHTML=this.ghRepos.slice(0,8).map(r=>{const lang=r.language?'<span class="ri-lang"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + this.langColor(r.language) + '"></span> ' + r.language + '</span>':'';const desc=r.description?'<div class="ri-desc">' + r.description.slice(0,80) + (r.description.length>80?'...':'') + '</div>':'';return '<div class="repo-item"><div class="ri-name"><a href="' + r.html_url + '" target="_blank">' + r.name + '</a></div>' + desc + lang + '</div>';}).join('');
  },

  langColor(l){const c={JavaScript:'#f1e05a',Rust:'#dea584',TypeScript:'#3178c6',Python:'#3572A5',Java:'#b07219',HTML:'#e34c26',CSS:'#563d7c',CoffeeScript:'#244776'};return c[l]||'#666';},

  search(q){
    if(!q.trim()){document.getElementById('search-results').innerHTML='';return;}
    const query=q.toLowerCase();
    const results=this.posts.filter(p=>p.title.toLowerCase().includes(query)||(p.excerpt||'').toLowerCase().includes(query)||(p.tags||[]).some(t=>t.toLowerCase().includes(query))||(p.topic||'').toLowerCase().includes(query));
    const el=document.getElementById('search-results');
    if(results.length===0){el.innerHTML='<p style="color:var(--sl-color-neutral-500)">No posts found.</p>';return;}
    el.innerHTML=results.slice(0,20).map(p=>{const d=new Date(p.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});return'<div class="search-result-item" data-slug="' + p.slug + '"><div class="sri-title">' + p.title + '</div><div class="sri-meta">' + d + (p.topic?' \u00B7 ' + p.topic:'') + '</div></div>';}).join('');
    el.querySelectorAll('.search-result-item').forEach(e=>{e.addEventListener('click',()=>{document.getElementById('search-drawer').hide();this.openPost(e.dataset.slug);});});
  },

  toggleTheme(){
    const root=document.querySelector('html');
    const current=root.getAttribute('data-theme')||'dark';
    const next=current==='dark'?'light':'dark';
    root.setAttribute('data-theme',next);
    document.getElementById('btn-theme').innerHTML='<sl-icon name="' + (next==='dark'?'moon':'sun') + '"></sl-icon>';
    document.querySelector('link[href*="shoelace"]').href='https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.19.1/cdn/themes/' + next + '.css';
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
