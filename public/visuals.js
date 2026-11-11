// Page chrome that is independent of the archive data: bilingual field-photo mosaic and lightbox,
// hero video and search, header state, and the collapsible filter panel.
const $=s=>document.querySelector(s);
const lang=()=>document.documentElement.lang==='bn'?'bn':'en';

// Published field photographs (see media/FIELD-PHOTOS.json and media/PROVENANCE.md).
// Captions describe only what is visible. size: big = 2×2, wide = 2×1 in the mosaic.
const photos=[
 {file:'field-someshwari-DJI_0325',w:2400,h:1350,size:'big',
  place:{en:'Someshwari River · 26 January 2023',bn:'সোমেশ্বরী নদী · ২৬ জানুয়ারি ২০২৩'},
  title:{en:'Lines across the Someshwari',bn:'সোমেশ্বরীজুড়ে পাইপের সারি'},
  text:{en:'Rows of floating platforms and pipes cross a green channel beside the sand bars.',bn:'বালুচরের পাশে সবুজ জলধারাজুড়ে ভাসমান কাঠামো ও পাইপের সারি।'}},
 {file:'field-jadukata-DJI_0081',w:2400,h:1350,
  place:{en:'Sunamganj / Jadukata · 10 January 2023',bn:'সুনামগঞ্জ / যাদুকাটা · ১০ জানুয়ারি ২০২৩'},
  title:{en:'Boats gather mid-channel',bn:'মাঝনদীতে নৌকার ভিড়'},
  text:{en:'Wooden boats cluster on green water between exposed bars.',bn:'জেগে ওঠা চরের মাঝের সবুজ পানিতে জড়ো হওয়া কাঠের নৌকা।'}},
 {file:'field-someshwari-IMG_2841',w:1620,h:1080,
  place:{en:'Someshwari River · 26 January 2023',bn:'সোমেশ্বরী নদী · ২৬ জানুয়ারি ২০২৩'},
  title:{en:'Washing and sorting',bn:'ধোয়া ও বাছাই'},
  text:{en:'Water and sand pour from a bamboo screening tower onto a growing pile.',bn:'বাঁশের ছাঁকনি-কাঠামো থেকে পানি ও বালু নিচের স্তূপে পড়ছে।'}},
 {file:'field-lubha-DJI_0045',w:2400,h:1350,
  place:{en:'Lubha River · 8 January 2023',bn:'লুভা নদী · ৮ জানুয়ারি ২০২৩'},
  title:{en:'Pits beside the Lubha',bn:'লুভার পাশে খননগর্ত'},
  text:{en:'Water-filled pits and worked ground lie between the river and small farm plots.',bn:'নদী ও ছোট চাষের জমির মাঝখানে পানিভরা গর্ত ও খোঁড়া জমি।'}},
 {file:'field-someshwari-DJI_0300',w:2400,h:1350,
  place:{en:'Someshwari River · 26 January 2023',bn:'সোমেশ্বরী নদী · ২৬ জানুয়ারি ২০২৩'},
  title:{en:'The route out of the riverbed',bn:'নদীতল থেকে বের হওয়ার পথ'},
  text:{en:'A line of loaded trucks follows the tracks through the sandy river landscape.',bn:'বালুময় নদীর ভূদৃশ্যের মধ্য দিয়ে চাকার দাগ বরাবর বোঝাই ট্রাকের সারি।'}},
 {file:'field-jadukata-DJI_0073',w:2400,h:1350,size:'wide',
  place:{en:'Sunamganj / Jadukata · 10 January 2023',bn:'সুনামগঞ্জ / যাদুকাটা · ১০ জানুয়ারি ২০২৩'},
  title:{en:'A working channel',bn:'কর্মব্যস্ত নদীখাত'},
  text:{en:'Loaded and empty boats move along the channel between exposed bars.',bn:'জেগে ওঠা চরের মাঝের নদীখাত দিয়ে বোঝাই ও খালি নৌকার চলাচল।'}},
 {file:'field-bholaganj-DJI_0051',w:2400,h:1350,
  place:{en:'Bholaganj · 9 January 2023',bn:'ভোলাগঞ্জ · ৯ জানুয়ারি ২০২৩'},
  title:{en:'Where the boats meet the bar',bn:'চরের কিনারে নৌকার সারি'},
  text:{en:'Moored boats trace the edge of a sand bar beside the river channel.',bn:'নদীখাতের পাশে চরের কিনারা ধরে নোঙর করা নৌকার সারি।'}},
 {file:'field-bichanakandi-20230106_133400',w:2400,h:1800,
  place:{en:'Bichanakandi · 6 January 2023',bn:'বিছানাকান্দি · ৬ জানুয়ারি ২০২৩'},
  title:{en:'Stone, water and the foothills',bn:'পাথর, পানি ও পাহাড়ের পাদদেশ'},
  text:{en:'A broad bed of rounded stones lies below the wooded hills at Bichanakandi.',bn:'বিছানাকান্দিতে গাছপালায় ঘেরা পাহাড়ের নিচে বিস্তৃত গোলাকার পাথরের নদীতল।'}},
 {file:'field-someshwari-DJI_0330',w:2400,h:1350,
  place:{en:'Someshwari River · 26 January 2023',bn:'সোমেশ্বরী নদী · ২৬ জানুয়ারি ২০২৩'},
  title:{en:'Pipes and platforms',bn:'পাইপ ও ভাসমান কাঠামো'},
  text:{en:'Rows of sand extraction pipes and floating platforms across the Someshwari River.',bn:'সোমেশ্বরী নদীজুড়ে বালু উত্তোলনের পাইপ ও ভাসমান কাঠামোর সারি।'}},
 {file:'field-jadukata-DJI_0070',w:2400,h:1350,
  place:{en:'Sunamganj / Jadukata · 10 January 2023',bn:'সুনামগঞ্জ / যাদুকাটা · ১০ জানুয়ারি ২০২৩'},
  title:{en:'At the water’s edge',bn:'পানির কিনারে'},
  text:{en:'Boats and sorted material stockpiles line a shallow river channel.',bn:'অগভীর নদীখাতের পাশে নৌকা ও বাছাই করা উপকরণের স্তূপ।'}},
 {file:'field-bholaganj-SYL_3019',w:2400,h:1600,
  place:{en:'Bholaganj · 9 January 2023',bn:'ভোলাগঞ্জ · ৯ জানুয়ারি ২০২৩'},
  title:{en:'From river stones to stockpiles',bn:'নদীর পাথর থেকে মজুতের স্তূপ'},
  text:{en:'A conveyor moves crushed stone into stockpiles beside the river.',bn:'নদীর পাশে কনভেয়র দিয়ে ভাঙা পাথর মজুতের স্তূপে নেওয়া হচ্ছে।'}},
 {file:'field-lubha-DJI_0042',w:2400,h:1350,
  place:{en:'Lubha River · 8 January 2023',bn:'লুভা নদী · ৮ জানুয়ারি ২০২৩'},
  title:{en:'The landscape beside the channel',bn:'নদীখাতের পাশের ভূদৃশ্য'},
  text:{en:'Water-filled excavation pits sit between the river channel and the wooded floodplain.',bn:'নদীখাত ও গাছপালায় ঘেরা প্লাবনভূমির মাঝখানে পানিভরা খননগর্ত।'}}
];

// ---------- Mosaic ----------
const mosaic=$('#mosaic');
photos.forEach((p,i)=>{
 const tile=document.createElement('button');tile.type='button';tile.className='tile'+(p.size?' '+p.size:'');tile.dataset.index=i;
 const img=document.createElement('img');img.loading='lazy';img.decoding='async';img.width=p.w;img.height=p.h;
 img.src=`media/${p.file}-sm.jpg`;
 if(p.size==='big'){img.srcset=`media/${p.file}-sm.jpg 1200w, media/${p.file}.jpg ${p.w}w`;img.sizes='(max-width: 740px) 82vw, 50vw';}
 const cap=document.createElement('span');cap.className='tile-cap';cap.append(document.createElement('strong'),document.createElement('span'));
 tile.append(img,cap);mosaic.append(tile);
});

// ---------- Lightbox ----------
const dialog=$('#media-dialog');let current=0;
const digits=n=>lang()==='bn'?String(n).replace(/\d/g,d=>'০১২৩৪৫৬৭৮৯'[d]):String(n);
function show(i){
 current=(i+photos.length)%photos.length;const p=photos[current],l=lang(),image=$('#media-image');
 image.src=`media/${p.file}-sm.jpg`;image.alt=p.text[l];
 const full=new Image();full.onload=()=>{if(photos[current]===p)image.src=full.src;};full.src=`media/${p.file}.jpg`;
 $('#media-credit').textContent=p.place[l];$('#media-title').textContent=p.title[l];$('#media-text').textContent=p.text[l];
 $('#media-count').textContent=`${digits(current+1)} / ${digits(photos.length)}`;
}
mosaic.addEventListener('click',e=>{const tile=e.target.closest('.tile');if(!tile)return;show(Number(tile.dataset.index));dialog.showModal();});
$('#media-prev').addEventListener('click',()=>show(current-1));
$('#media-next').addEventListener('click',()=>show(current+1));
$('#close-media').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
dialog.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')show(current-1);if(e.key==='ArrowRight')show(current+1);});

// ---------- Language ----------
function translate(){
 const l=lang(),bn=l==='bn';
 document.querySelectorAll('[data-visual-en]').forEach(el=>{el.textContent=el.dataset[bn?'visualBn':'visualEn'];});
 document.querySelectorAll('[data-ph-en]').forEach(el=>{el.placeholder=el.dataset[bn?'phBn':'phEn'];el.setAttribute('aria-label',el.placeholder);});
 mosaic.querySelectorAll('.tile').forEach(tile=>{const p=photos[tile.dataset.index];tile.querySelector('img').alt=p.text[l];tile.querySelector('strong').textContent=p.title[l];tile.querySelector('.tile-cap span').textContent=p.place[l];tile.setAttribute('aria-label',`${p.title[l]}. ${p.place[l]}`);});
 dialog.setAttribute('aria-label',bn?'মাঠের ছবি':'Field photograph');
 $('#media-prev').setAttribute('aria-label',bn?'আগের ছবি':'Previous photograph');$('#media-next').setAttribute('aria-label',bn?'পরের ছবি':'Next photograph');
 if(dialog.open)show(current);
 labelVideoToggle();
}

// ---------- Hero video ----------
// Plays muted and looped; stays paused for visitors who prefer reduced motion, when the tab is
// hidden, or once the visitor pauses it.
const video=$('#hero-video'),toggle=$('#video-toggle');
let userPaused=matchMedia('(prefers-reduced-motion: reduce)').matches;
function labelVideoToggle(){const bn=lang()==='bn';toggle.setAttribute('aria-pressed',String(userPaused));toggle.setAttribute('aria-label',userPaused?(bn?'পটভূমির ভিডিও চালান':'Play background video'):(bn?'পটভূমির ভিডিও থামান':'Pause background video'));toggle.firstElementChild.textContent=userPaused?'▶':'❚❚';}
function syncVideo(){if(userPaused||document.hidden||document.body.dataset.view!=='archive')video.pause();else video.play().catch(()=>{});}
toggle.addEventListener('click',()=>{userPaused=!userPaused;labelVideoToggle();syncVideo();});
document.addEventListener('visibilitychange',syncVideo);

// ---------- Header: transparent over the hero, solid elsewhere ----------
const masthead=$('.masthead');
function syncHeader(){masthead.classList.toggle('solid',document.body.dataset.view!=='archive'||scrollY>40);}
addEventListener('scroll',syncHeader,{passive:true});
new MutationObserver(()=>{syncHeader();syncVideo();}).observe(document.body,{attributes:true,attributeFilter:['data-view']});

// ---------- Hero search: feeds the archive search and jumps to the results ----------
const heroSearch=$('#hero-search'),search=$('#search');
heroSearch.addEventListener('input',()=>{search.value=heroSearch.value;search.dispatchEvent(new Event('input',{bubbles:true}));});
search.addEventListener('input',()=>{if(heroSearch.value!==search.value)heroSearch.value=search.value;});
$('#hero-form').addEventListener('submit',e=>{e.preventDefault();$('#catalogue').scrollIntoView({behavior:'smooth',block:'start'});heroSearch.blur();});

// ---------- Filter panel ----------
const panel=$('#filters'),filterToggle=$('#filter-toggle'),filterCount=$('#filter-count');
function openFilters(open){panel.classList.toggle('open',open);filterToggle.setAttribute('aria-expanded',String(open));}
filterToggle.addEventListener('click',()=>openFilters(!panel.classList.contains('open')));
function countFilters(){const n=[...panel.querySelectorAll('select,input')].filter(el=>el.type==='date'?el.value:el.value!=='all').length;filterCount.hidden=!n;filterCount.textContent=digits(n);}
panel.addEventListener('change',countFilters);
// Filters can also be set from the hero totals, the Insights charts and Reset.
document.addEventListener('click',()=>setTimeout(countFilters));

translate();syncHeader();syncVideo();countFilters();
new MutationObserver(()=>{translate();countFilters();}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
