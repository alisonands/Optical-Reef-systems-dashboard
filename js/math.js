/** Small offline TeX-to-MathML renderer for the equation registry. No evaluation. */
export function mathMarkup(latex) {
  const escape = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let index = 0;
  const symbols = {Delta:'Δ',rho:'ρ',sigma:'σ',eta:'η',phi:'φ',ell:'ℓ',sum:'∑',cdot:'·',times:'×',le:'≤',ge:'≥',pi:'π',infty:'∞'};
  function group() {
    while (/\s/.test(latex[index] || '') && index < latex.length) index++;
    if (latex[index] === '{') { index++; const roman=latex.slice(index).startsWith('\\rm ');if(roman){index+=4;return `<mstyle mathvariant="normal"><mrow>${sequence('}')}</mrow></mstyle>`;}return `<mrow>${sequence('}')}</mrow>`; }
    return atom();
  }
  function atom() {
    const char = latex[index++];
    if (!char) return '<mrow/>';
    if (char === '{') return `<mrow>${sequence('}')}</mrow>`;
    if (char === '\\') {
      const match = /^[a-zA-Z]+/.exec(latex.slice(index));
      const command = match?.[0] || latex[index++] || '';
      if (match) index += command.length;
      if (command === 'frac') return `<mfrac>${group()}${group()}</mfrac>`;
      if (command === 'sqrt') return `<msqrt>${group()}</msqrt>`;
      if (command === 'dot') return `<mover>${group()}<mo>˙</mo></mover>`;
      if (command === 'mathrm' || command === 'text') return `<mstyle mathvariant="normal">${group()}</mstyle>`;
      if (command === 'rm' || command === 'left' || command === 'right' || command === '!') return '';
      if (['quad','qquad',',',';',' '].includes(command)) return '<mspace width="0.7em"/>';
      if (['exp','ln','log','sin','cos'].includes(command)) return `<mi mathvariant="normal">${command}</mi>`;
      return symbols[command] ? `<mi>${symbols[command]}</mi>` : `<mi>${escape(command)}</mi>`;
    }
    if (/\d/.test(char)) {
      const match = /^[\d.]*/.exec(latex.slice(index))[0]; index += match.length;
      return `<mn>${char}${match}</mn>`;
    }
    if (/[a-zA-Z]/.test(char)) return `<mi>${char}</mi>`;
    return `<mo>${escape(char)}</mo>`;
  }
  function sequence(end) {
    let out = '';
    while (index < latex.length) {
      if (end && latex[index] === end) {index++; break;}
      if (/\s/.test(latex[index])) {index++;continue;}
      let base = atom(); let sub = null, sup = null;
      while (latex[index] === '_' || latex[index] === '^') {
        const script = latex[index++]; const value = group();
        if (script === '_') sub = value; else sup = value;
      }
      if (sub && sup) base = `<msubsup>${base}${sub}${sup}</msubsup>`;
      else if (sub) base = `<msub>${base}${sub}</msub>`;
      else if (sup) base = `<msup>${base}${sup}</msup>`;
      out += base;
    }
    return out;
  }
  return `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block" aria-label="${escape(latex)}"><mrow>${sequence()}</mrow></math>`;
}
