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
 const thumb=card.querySelector('img'),bn=lang()==='bn';
 $('#media-image').src=card.dataset.figure;$('#media-image').alt=thumb.alt;
 $('#media-credit').textContent=card.dataset[bn?'creditBn':'creditEn'];
 dialog.showModal();
}));
$('#close-media').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
