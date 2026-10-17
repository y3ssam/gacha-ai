const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// The 1774×887 atlas contains four equal 443.5×887 portraits. SVG crops a
// single cell first, then preserves its native 1:2 ratio in every UI slot.
export function portraitMarkup(character,source,cls='portrait'){
 const name=escape(character.name);
 const image=/^data:image\/(png|webp);base64,/.test(source||'')
  ?`<img class="portrait-media" src="${escape(source)}" alt="" draggable="false">`
  :`<svg class="portrait-media" viewBox="0 0 443.5 887" preserveAspectRatio="xMidYMin meet" aria-hidden="true"><image href="assets/characters.webp" x="${-443.5*Math.max(0,Math.min(3,Math.floor(Number(character.portrait)||0)))}" width="1774" height="887"/></svg>`;
 return `<div class="${escape(cls)}" role="img" aria-label="${name}">${image}</div>`;
}
