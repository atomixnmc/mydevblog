const BLOG = {
  posts: [],
  ghRepos: [],
  currentTopic: null,

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

  postCardHTML(p) {
    const date = new Date(p.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
    const tags = (p.tags||[]).map(t=>`<sl-tag size="small" variant="neutral">${t}</sl-tag>`).join('');
    return `<div class="post-card" data-slug="${p.slug}"><div class="meta"><span><sl-icon name="calendar"></sl-icon> ${date}</span>${p.topic?`<span><sl-icon name="bookmark"></sl-icon> ${p.topic}</span>`:''}<span><sl-icon name="clock"></sl-icon> ${p.readTime||'5'} min</span></div><h3>${p.title}</h3><div class="excerpt">${p.excerpt||''}</div>${tags?`<div class="tags">${tags}</div>`:''}</div>`;
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
    const html=marked.parse(md);
    const date=new Date(post.date).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
    const tags=(post.tags||[]).map(t=>`<sl-tag size="small" variant="neutral">${t}</sl-tag>`).join('');
    view.innerHTML=`<sl-button class="back-btn" variant="neutral" size="small" onclick="BLOG.renderPostList(BLOG.posts);history.pushState({},'',location.pathname);"><sl-icon name="arrow-left" slot="prefix"></sl-icon> Back to posts</sl-button><article><h1>${post.title}</h1><div class="post-meta"><span><sl-icon name="calendar"></sl-icon> ${date}</span><span><sl-icon name="clock"></sl-icon> ${post.readTime||'5'} min read</span>${post.topic?`<span><sl-icon name="bookmark"></sl-icon> ${post.topic}</span>`:''}${tags?`<span>${tags}</span>`:''}</div><hr>${html}</article><sl-button class="back-btn" variant="neutral" size="small" onclick="BLOG.renderPostList(BLOG.posts);history.pushState({},'',location.pathname);"><sl-icon name="arrow-left" slot="prefix"></sl-icon> Back to posts</sl-button>`;
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
    cloud.innerHTML=topics.map(t=>`<sl-tag size="small" variant="primary" data-topic="${t}" style="cursor:pointer">${t}</sl-tag>`).join('');
    cloud.querySelectorAll('sl-tag').forEach(el=>{el.addEventListener('click',()=>{this.currentTopic=this.currentTopic===el.dataset.topic?null:el.dataset.topic;this.renderPostList(this.currentTopic?this.posts.filter(p=>p.topic===this.currentTopic):this.posts);});});
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
