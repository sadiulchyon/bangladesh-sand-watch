// Canonical place names for filtering and Bangla labels. Record text is never rewritten:
// these helpers only decide which filter values a record's district and river fields map to.

// All 64 districts, using the spellings the archive uses, with Bangla names.
export const districtBn={
 'Bagerhat':'বাগেরহাট','Bandarban':'বান্দরবান','Barguna':'বরগুনা','Barishal':'বরিশাল','Bhola':'ভোলা','Bogura':'বগুড়া',
 'Brahmanbaria':'ব্রাহ্মণবাড়িয়া','Chandpur':'চাঁদপুর','Chapainawabganj':'চাঁপাইনবাবগঞ্জ','Chattogram':'চট্টগ্রাম','Chuadanga':'চুয়াডাঙ্গা',
 "Cox's Bazar":'কক্সবাজার','Cumilla':'কুমিল্লা','Dhaka':'ঢাকা','Dinajpur':'দিনাজপুর','Faridpur':'ফরিদপুর','Feni':'ফেনী',
 'Gaibandha':'গাইবান্ধা','Gazipur':'গাজীপুর','Gopalganj':'গোপালগঞ্জ','Habiganj':'হবিগঞ্জ','Jamalpur':'জামালপুর','Jashore':'যশোর',
 'Jhalokati':'ঝালকাঠি','Jhenaidah':'ঝিনাইদহ','Joypurhat':'জয়পুরহাট','Khagrachhari':'খাগড়াছড়ি','Khulna':'খুলনা','Kishoreganj':'কিশোরগঞ্জ',
 'Kurigram':'কুড়িগ্রাম','Kushtia':'কুষ্টিয়া','Lakshmipur':'লক্ষ্মীপুর','Lalmonirhat':'লালমনিরহাট','Madaripur':'মাদারীপুর','Magura':'মাগুরা',
 'Manikganj':'মানিকগঞ্জ','Meherpur':'মেহেরপুর','Moulvibazar':'মৌলভীবাজার','Munshiganj':'মুন্সিগঞ্জ','Mymensingh':'ময়মনসিংহ','Naogaon':'নওগাঁ',
 'Narail':'নড়াইল','Narayanganj':'নারায়ণগঞ্জ','Narsingdi':'নরসিংদী','Natore':'নাটোর','Netrokona':'নেত্রকোনা','Nilphamari':'নীলফামারী',
 'Noakhali':'নোয়াখালী','Pabna':'পাবনা','Panchagarh':'পঞ্চগড়','Patuakhali':'পটুয়াখালী','Pirojpur':'পিরোজপুর','Rajbari':'রাজবাড়ী',
 'Rajshahi':'রাজশাহী','Rangamati':'রাঙামাটি','Rangpur':'রংপুর','Satkhira':'সাতক্ষীরা','Shariatpur':'শরীয়তপুর','Sherpur':'শেরপুর',
 'Sirajganj':'সিরাজগঞ্জ','Sunamganj':'সুনামগঞ্জ','Sylhet':'সিলেট','Tangail':'টাঙ্গাইল','Thakurgaon':'ঠাকুরগাঁও'
};
const districtAliases={
 'cox’s bazar':"Cox's Bazar",'coxs bazar':"Cox's Bazar",'chittagong':'Chattogram','comilla':'Cumilla','barisal':'Barishal','bogra':'Bogura',
 'jessore':'Jashore','netrakona':'Netrokona','moulvi bazar':'Moulvibazar','maulvibazar':'Moulvibazar',
 'bangladesh':'National / multiple','national':'National / multiple','nationwide':'National / multiple','multiple; national':'National / multiple',
 'multiple':'Multiple districts','multiple districts':'Multiple districts','multiple sites':'Multiple districts','northern bangladesh':'Multiple districts',
 'regional study':'Regional / transboundary','transboundary catchment':'Regional / transboundary','transboundary ganges-brahmaputra delta':'Regional / transboundary',
 'global':'Global'
};
const dropDistricts=new Set(['others','other','unknown','']);
export function canonicalDistrict(value){
 const v=String(value??'').trim(),key=v.toLowerCase();
 if(dropDistricts.has(key))return '';
 return districtAliases[key]??Object.keys(districtBn).find(d=>d.toLowerCase()===key)??v;
}

// Rivers, channels and well-known quarry sites. Order matters: longer names that contain
// shorter ones (Buri Teesta, Chhoto Jamuna, Mora Chela) are matched and removed first.
const placeRules=[
 ['Buri Teesta','বুড়ি তিস্তা',/\bburi\s+teesta\b/i],
 ['Chhoto Jamuna','ছোট যমুনা',/\bchh?o(?:to|ta)\s+jamuna\b/i],
 ['Mora Chela','মরা চেলা',/\bmora\s*chela\b/i],
 ['Old Brahmaputra','পুরাতন ব্রহ্মপুত্র',/\bold\s+brahmaputra\b/i],
 ['Ganga–Brahmaputra–Meghna basin','গঙ্গা–ব্রহ্মপুত্র–মেঘনা অববাহিকা',/\bganga?e?s?\s*[–-]\s*brahmaputra(?:\s*[–-]\s*meghna)?\b/i],
 ['Maheshkhali Channel','মহেশখালী চ্যানেল',/\bmaheshkhali\s+channel\b/i],
 ['Sandwip Channel','সন্দ্বীপ চ্যানেল',/\bsandwip\s+channel\b/i],
 ['Meghna','মেঘনা',/\bmeghna\b/i],
 ['Padma (Ganges)','পদ্মা (গঙ্গা)',/\b(?:padma|ganges|ganga)\b/i],
 ['Jamuna','যমুনা',/\bjamuna\b/i],
 ['Brahmaputra','ব্রহ্মপুত্র',/\bbrahmaputra\b/i],
 ['Teesta','তিস্তা',/\bteesta\b/i],
 ['Someshwari','সোমেশ্বরী',/\bs[ho]{1,2}meshwari\b/i],
 ['Jadukata','যাদুকাটা',/\bjadukata\b/i],
 ['Piyain','পিয়াইন',/\bpiyai?n\b|\bpiyang\b/i],
 ['Dhalai','ধলাই',/\bdh[ao]lai\b/i],
 ['Lubha','লুভা',/\blubha(?:chorra|chhara)?\b|\blobhachh?ara\b|\blovachh?ara\b/i],
 ['Kushiyara','কুশিয়ারা',/\bkushiyara\b/i],
 ['Surma','সুরমা',/\bsurma\b/i],
 ['Sari-Goyain','সারি-গোয়াইন',/\bsari\b|\bgoyain\b/i],
 ['Chela','চেলা',/\bchela\b/i],
 ['Dhopajan','ধোপাজান',/\bdhopajan\b/i],
 ['Halda','হালদা',/\bhalda\b/i],
 ['Karnaphuli','কর্ণফুলী',/\bkarnaphuli\b/i],
 ['Matamuhuri','মাতামুহুরী',/\bmatamuhuri\b/i],
 ['Sangu','সাঙ্গু',/\bsangu\b/i],
 ['Tentulia','তেঁতুলিয়া',/\bte[nt]{1,2}ulia\b/i],
 ['Dakatia','ডাকাতিয়া',/\bdakatiy?a\b/i],
 ['Gomti','গোমতী',/\bgom[ao]?ti\b/i],
 ['Bangali','বাঙালি',/\bbang[a]{1,2}li\b/i],
 ['Dharla','ধরলা',/\bdharla\b/i],
 ['Dudhkumar','দুধকুমার',/\bdudh\s*kumar\b/i],
 ['Gorai','গড়াই',/\bgorai\b/i],
 ['Arial Khan','আড়িয়াল খাঁ',/\barial\s*kh[ae]n?\b/i],
 ['Shitalakshya','শীতলক্ষ্যা',/\bs(?:h)?italakk?h?sh?ya\b/i],
 ['Bangshi','বংশী',/\bbangshi\b|\bbansh?i\b/i],
 ['Dhaleshwari','ধলেশ্বরী',/\bdhaleshwari\b/i],
 ['Atrai','আত্রাই',/\batrai\b/i],
 ['Mahananda','মহানন্দা',/\bmahananda\b/i],
 ['Karatoya','করতোয়া',/\bkaratoy?a\b/i],
 ['Pussur','পশুর',/\bp[ua]ss?ur\b/i],
 ['Manu','মনু',/\bmanu\b/i],
 ['Jinjiram','জিঞ্জিরাম',/\bjinjir[au]m\b/i],
 ['Jaldhaka','জলঢাকা',/\bjaldhaka\b/i],
 ['Dahuk','ডাহুক',/\bdahuk\b/i],
 ['Khowai','খোয়াই',/\bkhowai\b/i],
 ['Kangsha','কংস',/\bkangs?h?a\s+river\b|\bkangsha\b/i],
 ['Bhogai','ভোগাই',/\bbhogai\b/i],
 ['Dalua','দলুয়া',/\bdalu[y]?a\b/i],
 ['Feni','ফেনী',/\bfeni\s+river\b/i],
 ['Titas','তিতাস',/\btitas\b/i],
 ['Kirtankhola','কীর্তনখোলা',/\bkirtankhola\b/i],
 ['Mahadeo','মহাদেও',/\bmahadeo\b/i],
 ['Dhanu','ধনু',/\bdhanu\b/i],
 ['Maharshi','মহারশি',/\bmaharshi\b/i],
 ['Charalkata','চাড়ালকাটা',/\bcharalkata\b/i],
 ['Fuljor','ফুলজোড়',/\bfuljor\b/i],
 ['Turag','তুরাগ',/\bturag\b/i],
 ['Buriganga','বুড়িগঙ্গা',/\bburiganga\b/i],
 ['Ichamati','ইছামতী',/\bichh?amati\b/i],
 ['Madhumati','মধুমতী',/\bmadhumati\b/i],
 ['Jaflong (quarry)','জাফলং (কোয়ারি)',/\bjaflong\b/i],
 ['Bholaganj (quarry)','ভোলাগঞ্জ (কোয়ারি)',/\bbholaganj\b/i],
 ['Bichanakandi (quarry)','বিছনাকান্দি (কোয়ারি)',/\bbichh?anakandi\b/i],
 ['Sada Pathor (quarry)','সাদাপাথর (কোয়ারি)',/\bs[h]?ada\s*pathor\b/i],
 ['Shah Arefin Tila (quarry)','শাহ আরেফিন টিলা (কোয়ারি)',/\bshah\s+arefin\b/i],
 ['Garo Hills','গারো পাহাড়',/\bgaro\s+hills?\b/i]
];
// Used only when no named river or site matches.
const groupRules=[
 ['Multiple rivers','একাধিক নদী',/\brivers?\b.*\b(?:nationwide|multiple|unnamed)\b|\b(?:multiple|twelve)\b.*\brivers?\b|\bnationwide\b/i],
 ['Sand mahal / lease areas','বালুমহাল / ইজারা এলাকা',/balumahal|sand\s*mahal|lease\s+area/i],
 ['Coast & estuaries','উপকূল ও মোহনা',/\bcoast|\bestuar|bay of bengal/i],
 ['Canals, streams & chharas','খাল, ছড়া ও পাহাড়ি স্রোত',/chh?ara\b|\bkhal\b|\bcanals?\b|\bstreams?\b|\bcreeks?\b/i],
 ['Stone quarries','পাথর কোয়ারি',/\bquarr(?:y|ies)\b|granite mine/i]
];
export const placeBn={...districtBn,...Object.fromEntries([...placeRules,...groupRules].map(([name,bn])=>[name,bn])),
 'National / multiple':'জাতীয় / একাধিক','Multiple districts':'একাধিক জেলা','Regional / transboundary':'আঞ্চলিক / আন্তঃসীমান্ত',
 'Global':'বৈশ্বিক','Other / unspecified':'অন্যান্য / অনির্দিষ্ট'};

export function detectRivers(text){
 let rest=String(text??'');const found=[];
 for(const [name,,pattern] of placeRules){
  const global=new RegExp(pattern.source,'gi');
  if(global.test(rest)){found.push(name);rest=rest.replace(global,' ');}
 }
 if(!found.length)for(const [name,,pattern] of groupRules)if(pattern.test(rest)){found.push(name);break;}
 return found;
}
