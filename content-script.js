/**
 * Salesforce Flow Minimap — content-script.js
 */

(function () {
  'use strict';

  const CFG = {
    INITIAL_W:    240,
    PADDING:      10,
    MIN_W:        140,
    MIN_H:        90,
    DEBOUNCE_MS:  80,
    INIT_DELAY_MS: 1200,
    CONTEXT_ZOOM: 2.5,
    CLICK_SNAP_PX: 30,
    NODE_SELECTORS: [
      'div.base-card',
      '[class*="base-card"]',
      'builder_platform_interaction-canvas-element',
      '[data-node-id]',
      '[class*="canvas-element"]',
    ],
    FLOW_URL_PATTERNS: ['/flow/', 'FlowBuilder', 'flowBuilder'],
    COLOURS: {
      start:'#22c55e', end:'#ef4444', decision:'#f59e0b',
      loop:'#a855f7', assignment:'#3b82f6', screen:'#06b6d4',
      action:'#ec4899', default:'#64748b',
    },
  };

  let minimap=null, showNames=true, fitAllMode=false;
  let updateTimer=null, navObserver=null, domObserver=null;
  let scrollListeners=[], lastUrl=location.href;
  let renderParams=null, tooltip=null;
  let canvasScrollEl=null;   // cached scroll container for pan / navigate
  let isMinimapDragging=false;

  function isFlowBuilderPage() {
    if (CFG.FLOW_URL_PATTERNS.some(p => location.href.includes(p))) return true;
    return !!(document.querySelector('div.base-card')||document.querySelector('builder_platform_interaction-canvas'));
  }

  function classifyElement(el) {
    const icon = el.querySelector('lightning-icon[icon-name]');
    if (icon) {
      const n = (icon.getAttribute('icon-name')||'').toLowerCase();
      if (n.includes('start'))      return 'start';
      if (n.includes('end')||n.includes('fault')) return 'end';
      if (n.includes('decision'))   return 'decision';
      if (n.includes('loop'))       return 'loop';
      if (n.includes('assignment')) return 'assignment';
      if (n.includes('screen'))     return 'screen';
      if (n.includes('action')||n.includes('apex')||n.includes('quick_action')) return 'action';
    }
    const a = (el.getAttribute('aria-label')||'').toLowerCase();
    if (a.startsWith('start'))      return 'start';
    if (a.startsWith('end')||a.startsWith('fault')) return 'end';
    if (a.startsWith('decision'))   return 'decision';
    if (a.startsWith('loop'))       return 'loop';
    if (a.startsWith('assignment')) return 'assignment';
    if (a.startsWith('screen'))     return 'screen';
    if (a.startsWith('action')||a.startsWith('apex')) return 'action';
    return 'default';
  }

  function getShortLabel(el) {
    const s = el.querySelector('.text-element-label');
    if (s&&s.textContent.trim()) return s.textContent.trim().slice(0,18);
    const a = el.getAttribute('aria-label')||'';
    if (a) { const i=a.indexOf(', '); return (i!==-1?a.slice(i+2):a).trim().slice(0,18); }
    return '';
  }

  function getFullLabel(el) {
    const s = el.querySelector('.text-element-label');
    if (s&&s.textContent.trim()) return s.textContent.trim();
    const a = el.getAttribute('aria-label')||'';
    if (a) { const i=a.indexOf(', '); return (i!==-1?a.slice(i+2):a).trim(); }
    return '(unnamed)';
  }

  function collectNodes() {
    for (const sel of CFG.NODE_SELECTORS) {
      const found = Array.from(document.querySelectorAll(sel));
      if (found.length) return found;
    }
    return [];
  }

  function collectConnectors(nb) {
    const margin=120;
    const inBounds=(x,y)=>x>=nb.minX-margin&&x<=nb.maxX+margin&&y>=nb.minY-margin&&y<=nb.maxY+margin;
    const lines=[];
    for (const el of document.querySelectorAll('svg path, svg line, svg polyline')) {
      if (el.closest('.base-card')) continue;
      try {
        const svg=el.closest('svg'); if (!svg) continue;
        const ctm=svg.getScreenCTM(); if (!ctm) continue;
        const toS=(px,py)=>{ const p=svg.createSVGPoint(); p.x=px; p.y=py; return p.matrixTransform(ctm); };
        let x1,y1,x2,y2;
        if (el.tagName.toLowerCase()==='line') {
          const p1=toS(+el.getAttribute('x1'),+el.getAttribute('y1'));
          const p2=toS(+el.getAttribute('x2'),+el.getAttribute('y2'));
          x1=p1.x;y1=p1.y;x2=p2.x;y2=p2.y;
        } else {
          if (typeof el.getTotalLength!=='function') continue;
          const len=el.getTotalLength(); if (len<15) continue;
          const s=toS(el.getPointAtLength(0).x,el.getPointAtLength(0).y);
          const e=toS(el.getPointAtLength(len).x,el.getPointAtLength(len).y);
          x1=s.x;y1=s.y;x2=e.x;y2=e.y;
        }
        if (!inBounds(x1,y1)||!inBounds(x2,y2)) continue;
        const dx=x2-x1,dy=y2-y1;
        if (Math.sqrt(dx*dx+dy*dy)<10) continue;
        lines.push({x1,y1,x2,y2});
      } catch(_){}
    }
    return lines;
  }

  function drawRR(ctx,x,y,w,h,r) {
    r=Math.min(r,w/2,h/2);
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
    ctx.closePath();
  }

  function renderMinimap() {
    if (!minimap) return;
    const {canvas,ctx}=minimap;
    const W=canvas.width, H=canvas.height, PAD=CFG.PADDING;
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle='#0f172a'; ctx.fillRect(0,0,W,H);

    const nodes=collectNodes();
    if (!nodes.length) {
      ctx.fillStyle='#475569'; ctx.font='10px system-ui,sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('Waiting for flow elements\u2026',W/2,H/2);
      updateBadge(0); renderParams=null; return;
    }

    const rects=nodes.map(el=>{ const r=el.getBoundingClientRect(); return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,el}; });
    const nb={
      minX:Math.min(...rects.map(r=>r.left)), minY:Math.min(...rects.map(r=>r.top)),
      maxX:Math.max(...rects.map(r=>r.right)), maxY:Math.max(...rects.map(r=>r.bottom)),
    };
    const scaleFitAll=Math.min((W-PAD*2)/(nb.maxX-nb.minX||1),(H-PAD*2)/(nb.maxY-nb.minY||1));

    let scale,ox,oy;
    if (fitAllMode) {
      scale=scaleFitAll; ox=nb.minX; oy=nb.minY;
    } else {
      // Use the visible-nodes extent (not full screen width) as the context
      // reference — this eliminates dead space caused by toolbars / sidebars.
      const vis=rects.filter(r=>r.right>0&&r.left<window.innerWidth&&r.bottom>0&&r.top<window.innerHeight);
      const src=vis.length?vis:rects;
      const srcMinX=Math.min(...src.map(r=>r.left));
      const srcMaxX=Math.max(...src.map(r=>r.right));
      const srcMinY=Math.min(...src.map(r=>r.top));
      const srcMaxY=Math.max(...src.map(r=>r.bottom));
      const srcW=Math.max(srcMaxX-srcMinX,100);
      const srcH=Math.max(srcMaxY-srcMinY,100);
      const scaleCtx=Math.min((W-PAD*2)/(srcW*CFG.CONTEXT_ZOOM),(H-PAD*2)/(srcH*CFG.CONTEXT_ZOOM));
      scale=Math.max(scaleFitAll,scaleCtx);
      const cx=(srcMinX+srcMaxX)/2;
      const cy=(srcMinY+srcMaxY)/2;
      ox=cx-(W-PAD*2)/(2*scale);
      oy=cy-(H-PAD*2)/(2*scale);
    }

    const toMX=x=>(x-ox)*scale+PAD;
    const toMY=y=>(y-oy)*scale+PAD;
    renderParams={scale,ox,oy};

    // Connectors
    ctx.save(); ctx.strokeStyle='rgba(148,163,184,0.6)'; ctx.lineWidth=1;
    for (const c of collectConnectors(nb)) {
      ctx.beginPath(); ctx.moveTo(toMX(c.x1),toMY(c.y1)); ctx.lineTo(toMX(c.x2),toMY(c.y2)); ctx.stroke();
    }
    ctx.restore();

    // Nodes
    for (const r of rects) {
      const x=toMX(r.left), y=toMY(r.top);
      const w=Math.max((r.right-r.left)*scale,6), h=Math.max((r.bottom-r.top)*scale,4);
      if (x+w<0||x>W||y+h<0||y>H) continue;
      ctx.fillStyle=CFG.COLOURS[classifyElement(r.el)]||CFG.COLOURS.default;
      drawRR(ctx,x,y,w,h,2); ctx.fill();
      if (showNames&&w>=16) {
        const label=getShortLabel(r.el);
        if (label) {
          const fs=Math.max(5,Math.min(7,h*0.5));
          ctx.save(); ctx.beginPath(); ctx.rect(x+1,y+1,w-2,h-2); ctx.clip();
          ctx.fillStyle='rgba(255,255,255,0.92)'; ctx.font=fs+'px system-ui,sans-serif';
          ctx.textAlign='center'; ctx.textBaseline='middle';
          ctx.fillText(label,x+w/2,y+h/2); ctx.restore();
        }
      }
    }

    // Viewport indicator
    const vpX=toMX(0), vpY=toMY(0), vpW=window.innerWidth*scale, vpH=window.innerHeight*scale;
    ctx.fillStyle='rgba(255,255,255,0.04)'; ctx.fillRect(vpX,vpY,vpW,vpH);
    ctx.strokeStyle='rgba(255,255,255,0.75)'; ctx.lineWidth=1.5;
    ctx.setLineDash([4,3]); ctx.strokeRect(vpX,vpY,vpW,vpH); ctx.setLineDash([]);

    updateBadge(rects.length);
  }

  function scheduleRender() { clearTimeout(updateTimer); updateTimer=setTimeout(renderMinimap,CFG.DEBOUNCE_MS); }
  function updateBadge(n) { if (minimap&&minimap.badge) minimap.badge.textContent=n>0?n+' nodes':''; }

  function minimapToScreen(mx,my) {
    if (!renderParams) return null;
    const {scale,ox,oy}=renderParams;
    return {x:(mx-CFG.PADDING)/scale+ox, y:(my-CFG.PADDING)/scale+oy};
  }

  // Navigate canvas to a node — uses stored scroll container for precision
  function navigateToNode(clientX, clientY) {
    const cvr=minimap.canvas.getBoundingClientRect();
    const sc=minimapToScreen(clientX-cvr.left, clientY-cvr.top); if (!sc) return;
    let best=null, bestD=Infinity;
    const snap=CFG.CLICK_SNAP_PX;
    for (const node of collectNodes()) {
      const r=node.getBoundingClientRect();
      if (sc.x>=r.left-snap&&sc.x<=r.right+snap&&sc.y>=r.top-snap&&sc.y<=r.bottom+snap) {
        const d=Math.hypot((r.left+r.right)/2-sc.x,(r.top+r.bottom)/2-sc.y);
        if (d<bestD){bestD=d;best=node;}
      }
    }
    if (!best) return;
    if (canvasScrollEl) {
      // Scroll so node is centred in the canvas viewport
      const nr=best.getBoundingClientRect();
      const cr=canvasScrollEl.getBoundingClientRect();
      canvasScrollEl.scrollBy({
        left: (nr.left+nr.width/2) - (cr.left+cr.width/2),
        top:  (nr.top+nr.height/2) - (cr.top+cr.height/2),
        behavior:'smooth'
      });
    } else {
      best.scrollIntoView({behavior:'smooth',block:'center',inline:'center'});
    }
  }

  // Mousedown on minimap: drag → pan canvas, no drag → navigate to node
  function handleMinimapMouseDown(e) {
    if (e.button!==0) return;
    const clickX=e.clientX, clickY=e.clientY;
    let prevX=e.clientX, prevY=e.clientY;
    isMinimapDragging=false;
    minimap.canvas.style.cursor='grab';

    function onMove(me) {
      const totalDx=me.clientX-clickX, totalDy=me.clientY-clickY;
      if (!isMinimapDragging && Math.sqrt(totalDx*totalDx+totalDy*totalDy)>4) {
        isMinimapDragging=true;
        minimap.canvas.style.cursor='grabbing';
        hideTooltip();
      }
      if (!isMinimapDragging||!renderParams) return;
      // Convert minimap-pixel delta → screen-pixel delta and pan
      const {scale}=renderParams;
      panCanvas((me.clientX-prevX)/scale, (me.clientY-prevY)/scale);
      prevX=me.clientX; prevY=me.clientY;
    }

    function onUp() {
      document.removeEventListener('mousemove',onMove);
      document.removeEventListener('mouseup',onUp);
      if (!isMinimapDragging) navigateToNode(clickX,clickY);
      isMinimapDragging=false;
      minimap.canvas.style.cursor='default';
    }

    document.addEventListener('mousemove',onMove);
    document.addEventListener('mouseup',onUp);
    e.preventDefault();
  }

  function ensureTooltip() {
    if (tooltip) return;
    tooltip=document.createElement('div');
    tooltip.id='sf-minimap-tooltip';
    document.body.appendChild(tooltip);
  }

  function showTooltip(x,y,text,type) {
    ensureTooltip();
    // Build: [coloured type badge] full name
    tooltip.innerHTML='';
    const badge=document.createElement('span');
    badge.id='sf-minimap-tooltip-badge';
    badge.textContent=type.charAt(0).toUpperCase()+type.slice(1);
    badge.style.background=CFG.COLOURS[type]||CFG.COLOURS.default;
    const name=document.createElement('span');
    name.textContent=text;
    tooltip.appendChild(badge);
    tooltip.appendChild(name);
    tooltip.style.display='block';
    // Position above cursor, shift left if near right edge
    const pad=12;
    tooltip.style.left='0px'; // reset so offsetWidth is accurate
    const tw=tooltip.offsetWidth;
    tooltip.style.left=Math.min(x+pad, window.innerWidth-tw-pad)+'px';
    tooltip.style.top=(y-44)+'px';
  }

  function hideTooltip() { if (tooltip) tooltip.style.display='none'; }

  function handleMinimapHover(e) {
    if (isMinimapDragging) return; // don't show tooltip while panning
    const cvr=minimap.canvas.getBoundingClientRect();
    const sc=minimapToScreen(e.clientX-cvr.left,e.clientY-cvr.top);
    if (!sc) { hideTooltip(); return; }
    for (const node of collectNodes()) {
      const r=node.getBoundingClientRect();
      if (sc.x>=r.left&&sc.x<=r.right&&sc.y>=r.top&&sc.y<=r.bottom) {
        showTooltip(e.clientX,e.clientY,getFullLabel(node),classifyElement(node));
        minimap.canvas.style.cursor='pointer'; return;
      }
    }
    hideTooltip(); minimap.canvas.style.cursor='default';
  }

  function buildMinimap() {
    if (minimap) return;
    const initW=CFG.INITIAL_W;
    const initH=Math.max(CFG.MIN_H,Math.round(initW*window.innerHeight/window.innerWidth));

    const container=document.createElement('div');
    container.id='sf-minimap-root'; container.setAttribute('data-sf-minimap','true');

    const header=document.createElement('div'); header.id='sf-minimap-header';
    const title=document.createElement('span'); title.id='sf-minimap-title'; title.textContent='Flow Minimap';
    const badge=document.createElement('span'); badge.id='sf-minimap-badge';

    const namesBtn=document.createElement('button'); namesBtn.id='sf-minimap-names';
    namesBtn.title='Toggle node labels'; namesBtn.textContent='Names';
    namesBtn.classList.toggle('sf-btn-active',showNames);
    namesBtn.addEventListener('click',()=>{ showNames=!showNames; namesBtn.classList.toggle('sf-btn-active',showNames); renderMinimap(); });

    const fitBtn=document.createElement('button'); fitBtn.id='sf-minimap-fit';
    fitBtn.title='Fit all / context view'; fitBtn.textContent='Fit';
    fitBtn.addEventListener('click',()=>{ fitAllMode=!fitAllMode; fitBtn.classList.toggle('sf-btn-active',fitAllMode); renderMinimap(); });

    const collapseBtn=document.createElement('button'); collapseBtn.id='sf-minimap-collapse';
    collapseBtn.title='Toggle minimap'; collapseBtn.textContent='\u2212';
    collapseBtn.addEventListener('click',()=>{
      const body=document.getElementById('sf-minimap-body'); if (!body) return;
      const c=body.style.display==='none'; body.style.display=c?'block':'none'; collapseBtn.textContent=c?'\u2212':'+';
    });

    header.appendChild(title); header.appendChild(badge);
    header.appendChild(namesBtn); header.appendChild(fitBtn); header.appendChild(collapseBtn);

    const body=document.createElement('div'); body.id='sf-minimap-body';
    const canvas=document.createElement('canvas'); canvas.id='sf-minimap-canvas';
    canvas.width=initW; canvas.height=initH;
    canvas.addEventListener('mousedown',handleMinimapMouseDown);
    canvas.addEventListener('mousemove',handleMinimapHover);
    canvas.addEventListener('mouseleave',hideTooltip);

    const legend=document.createElement('div'); legend.id='sf-minimap-legend';
    for (const [type,label] of [['start','Start'],['decision','Decision'],['screen','Screen'],['action','Action'],['end','End']]) {
      const dot=document.createElement('span'); dot.className='sf-legend-dot'; dot.style.background=CFG.COLOURS[type];
      legend.appendChild(dot); legend.appendChild(Object.assign(document.createElement('span'),{textContent:label}));
    }

    const resizeHandle=document.createElement('div'); resizeHandle.id='sf-minimap-resize';
    body.appendChild(canvas); body.appendChild(legend); body.appendChild(resizeHandle);
    container.appendChild(header); container.appendChild(body);
    document.body.appendChild(container);

    makeDraggable(container,header);
    makeResizable(container,canvas,resizeHandle);
    minimap={container,canvas,ctx:canvas.getContext('2d'),badge};
    watchScrollContainer();
    scheduleRender();
  }

  function makeDraggable(el,handle) {
    let drag=null;
    handle.addEventListener('mousedown',e=>{
      if (e.target.tagName==='BUTTON') return;
      const r=el.getBoundingClientRect();
      drag={sx:e.clientX,sy:e.clientY,ol:r.left,ot:r.top};
      document.addEventListener('mousemove',onMove); document.addEventListener('mouseup',onUp); e.preventDefault();
    });
    function onMove(e){ if (!drag) return; el.style.left=(drag.ol+e.clientX-drag.sx)+'px'; el.style.top=(drag.ot+e.clientY-drag.sy)+'px'; el.style.right='auto'; el.style.bottom='auto'; }
    function onUp(){ drag=null; document.removeEventListener('mousemove',onMove); document.removeEventListener('mouseup',onUp); }
  }

  function makeResizable(container,canvas,handle) {
    let drag=null;
    handle.addEventListener('mousedown',e=>{
      drag={sx:e.clientX,sy:e.clientY,sw:canvas.width,sh:canvas.height};
      document.addEventListener('mousemove',onMove); document.addEventListener('mouseup',onUp);
      e.preventDefault(); e.stopPropagation();
    });
    function onMove(e){ if (!drag) return; canvas.width=Math.max(CFG.MIN_W,Math.round(drag.sw+e.clientX-drag.sx)); canvas.height=Math.max(CFG.MIN_H,Math.round(drag.sh+e.clientY-drag.sy)); renderMinimap(); }
    function onUp(){ drag=null; document.removeEventListener('mousemove',onMove); document.removeEventListener('mouseup',onUp); }
  }

  function watchScrollContainer() {
    scrollListeners.forEach(([el,fn])=>el.removeEventListener('scroll',fn));
    scrollListeners=[];
    canvasScrollEl=null;

    const nodes=collectNodes();
    if (nodes.length) {
      // 1. Try known Salesforce canvas container selectors first
      const sfSelectors=['[class*="canvas-container"]','[class*="alc-canvas"]','[class*="flow-canvas"]','[class*="canvas-body"]'];
      for (const sel of sfSelectors) {
        const el=document.querySelector(sel);
        if (el && el.contains(nodes[0])) { canvasScrollEl=el; break; }
      }
      // 2. Walk up the DOM from a node looking for a scrollable ancestor
      if (!canvasScrollEl) {
        let el=nodes[0].parentElement;
        while (el&&el!==document.documentElement) {
          const s=window.getComputedStyle(el);
          if (['auto','scroll'].some(v=>s.overflow===v||s.overflowX===v||s.overflowY===v)) {
            canvasScrollEl=el; break;
          }
          el=el.parentElement;
        }
      }
      if (canvasScrollEl) {
        const fn=()=>scheduleRender();
        canvasScrollEl.addEventListener('scroll',fn,{passive:true});
        scrollListeners.push([canvasScrollEl,fn]);
      }
    }
    const wf=()=>scheduleRender(); window.addEventListener('scroll',wf,{passive:true}); scrollListeners.push([window,wf]);
  }

  // Pan the flow canvas by (dx, dy) screen pixels.
  // Only uses scrollBy — never mutates CSS transforms, which would physically
  // move canvas elements rather than changing the viewport focus.
  function panCanvas(dx,dy) {
    if (canvasScrollEl) {
      canvasScrollEl.scrollBy(dx,dy);
      return;
    }
    window.scrollBy(dx,dy);
  }

  function teardown() {
    clearTimeout(updateTimer);
    scrollListeners.forEach(([el,fn])=>el.removeEventListener('scroll',fn)); scrollListeners=[];
    hideTooltip();
    if (minimap){ minimap.container.remove(); minimap=null; }
  }

  function startDomObserver() {
    if (domObserver) domObserver.disconnect();
    domObserver=new MutationObserver(()=>{ if (!minimap&&isFlowBuilderPage()) buildMinimap(); else if (minimap) scheduleRender(); });
    domObserver.observe(document.body,{childList:true,subtree:true});
  }

  function watchNavigation() {
    navObserver=new MutationObserver(()=>{
      const url=location.href;
      if (url!==lastUrl){ lastUrl=url; teardown(); if (isFlowBuilderPage()) setTimeout(buildMinimap,CFG.INIT_DELAY_MS); }
    });
    navObserver.observe(document.documentElement,{childList:true,subtree:true});
  }

  function init() { if (isFlowBuilderPage()) buildMinimap(); startDomObserver(); watchNavigation(); }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else setTimeout(init,CFG.INIT_DELAY_MS);

})();
