// Bilingual labels for the field media and the research-figure lightbox.
const $=s=>document.querySelector(s);
const lang=()=>document.documentElement.lang==='bn'?'bn':'en';
const translate=()=>{
 const bn=lang()==='bn';
 document.querySelectorAll('[data-visual-en]').forEach(el=>{el.textContent=el.dataset[bn?'visualBn':'visualEn'];});
 document.querySelectorAll('[data-alt-en]').forEach(el=>{el.alt=el.dataset[bn?'altBn':'altEn'];});
};
translate();
new MutationObserver(translate).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});

const dialog=$('#media-dialog');
document.querySelectorAll('[data-figure]').forEach(card=>card.addEventListener('click',()=>{
 const thumb=card.closest('.slide')?.querySelector('img')??card.querySelector('img'),bn=lang()==='bn';
 $('#media-image').src=card.dataset.figure;$('#media-image').alt=thumb.alt;
 $('#media-credit').textContent=card.dataset[bn?'creditBn':'creditEn'];
 dialog.showModal();
}));
$('#close-media').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});

// Slideshow: videos play through and advance when they end; figures stay for the interval.
// Pauses on hover/focus, when the tab is hidden or the show is off screen, and never
// auto-advances for visitors who prefer reduced motion.
const show=$('.slideshow');
if(show){
 const slides=[...show.querySelectorAll('.slide')],dots=show.querySelector('.slide-dots'),toggle=show.querySelector('.slide-toggle'),count=show.querySelector('.slide-count');
 const interval=Number(show.dataset.interval)||8000,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 let index=0,timer=null,started=0,remaining=interval,userPaused=reduced,hovered=false,visible=false;
 const bn=()=>lang()==='bn',digits=n=>bn()?String(n).replace(/\d/g,d=>'০১২৩৪৫৬৭৮৯'[d]):String(n);
 slides.forEach((slide,i)=>{
  slide.id=`slide-${i}`;slide.setAttribute('aria-label',`${i+1} / ${slides.length}`);
  const dot=document.createElement('button');dot.type='button';dot.className='slide-dot';dot.setAttribute('role','tab');dot.setAttribute('aria-controls',slide.id);dot.setAttribute('aria-label',`${i+1}`);
  dot.append(document.createElement('i'));dot.addEventListener('click',()=>go(i,true));dots.append(dot);
  const v=slide.querySelector('video');v?.addEventListener('ended',()=>{if(!paused())go(index+1);});
  v?.querySelector('source:last-child')?.addEventListener('error',()=>{if(slides[index]===slide&&!paused())go(index+1);});
 });
 const paused=()=>userPaused||hovered||!visible||document.hidden;
 const load=slide=>{const img=slide.querySelector('img[data-src]');if(img){img.src=img.dataset.src;img.removeAttribute('data-src');}};
 function clear(){clearTimeout(timer);timer=null;}
 function schedule(){
  clear();const slide=slides[index],video=slide.querySelector('video');
  if(paused()){video?.pause();show.classList.add('is-paused');return;}
  show.classList.remove('is-paused');
  // Advances on 'ended'. If the video errors or has not started within 5 s, move on anyway.
  if(video){video.play().catch(()=>{});timer=setTimeout(()=>{if(video.currentTime===0||video.error)go(index+1);},5000);return;}
  started=Date.now();
  timer=setTimeout(()=>go(index+1),remaining);
 }
 function go(next,manual=false){
  const prev=slides[index];prev.querySelector('video')?.pause();
  index=(next+slides.length)%slides.length;remaining=interval;
  slides.forEach((s,i)=>{s.classList.toggle('is-active',i===index);s.setAttribute('aria-hidden',i===index?'false':'true');s.inert=i!==index;});
  [...dots.children].forEach((d,i)=>{d.classList.toggle('is-active',i===index);d.setAttribute('aria-selected',i===index?'true':'false');d.classList.remove('is-done');if(i<index)d.classList.add('is-done');});
  const video=slides[index].querySelector('video');
  if(video){video.currentTime=0;const set=()=>show.style.setProperty('--progress-duration',(video.duration||0)+'s');video.readyState>0?set():video.addEventListener('loadedmetadata',set,{once:true});}
  else show.style.setProperty('--progress-duration',interval+'ms');
  load(slides[index]);load(slides[(index+1)%slides.length]);
  count.textContent=`${digits(index+1)} / ${digits(slides.length)}`;
  // restart the dot progress animation
  const bar=dots.children[index].firstChild;bar.style.animation='none';void bar.offsetWidth;bar.style.animation='';
  schedule();
 }
 const hold=()=>{if(timer){remaining=Math.max(0,remaining-(Date.now()-started));}schedule();};
 show.querySelector('.prev').addEventListener('click',()=>go(index-1,true));
 show.querySelector('.next').addEventListener('click',()=>go(index+1,true));
 toggle.addEventListener('click',()=>{userPaused=!userPaused;toggle.setAttribute('aria-pressed',String(userPaused));toggle.setAttribute('aria-label',userPaused?'Play slideshow':'Pause slideshow');toggle.firstChild.textContent=userPaused?'▶':'❚❚';hold();});
 show.addEventListener('pointerenter',()=>{hovered=true;hold();});
 show.addEventListener('pointerleave',()=>{hovered=false;hold();});
 show.addEventListener('focusin',()=>{hovered=true;hold();});
 show.addEventListener('focusout',e=>{if(!show.contains(e.relatedTarget)){hovered=false;hold();}});
 show.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')go(index-1,true);if(e.key==='ArrowRight')go(index+1,true);});
 document.addEventListener('visibilitychange',hold);
 new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;hold();},{threshold:.35}).observe(show);
 if(reduced){toggle.setAttribute('aria-pressed','true');toggle.setAttribute('aria-label','Play slideshow');toggle.firstChild.textContent='▶';}
 // Videos keep native controls reachable when the slideshow is paused by the visitor.
 slides.forEach(s=>{const v=s.querySelector('video');if(v)v.addEventListener('click',()=>{v.paused?v.play():v.pause();});});
 new MutationObserver(()=>{count.textContent=`${digits(index+1)} / ${digits(slides.length)}`;}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 go(0);
}
