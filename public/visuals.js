const translateVisuals=()=>{
 const lang=document.documentElement.lang==='bn'?'bn':'en';
 document.querySelectorAll('[data-visual-en]').forEach(el=>{el.textContent=el.dataset[lang==='bn'?'visualBn':'visualEn']});
 document.querySelectorAll('[data-alt-en]').forEach(el=>{el.alt=el.dataset[lang==='bn'?'altBn':'altEn']});
};
translateVisuals();
new MutationObserver(translateVisuals).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
