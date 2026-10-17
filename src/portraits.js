const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function portraitMarkup(character,source,cls='portrait'){
 const image=/^data:image\/(png|webp);base64,/.test(source||'')
  ?`<img class="portrait-media" src="${escape(source)}" alt="" draggable="false">`
  :'<span class="portrait-placeholder"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="21" r="12"/><path d="M10 59c0-26 44-26 44 0"/></svg><span>이미지 미생성</span></span>';
 return `<div class="${escape(cls)}" role="img" aria-label="${escape(character.name)}">${image}</div>`;
}
