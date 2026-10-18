/* Alice chat Markdown: escape-first parser; no raw HTML or executable links. */
(function(global){
 'use strict';
 const escape=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
 function inline(source){
  let text=escape(source),tokens=[];
  const reserve=html=>{const key='\uE000'+tokens.length+'\uE001';tokens.push(html);return key};
  text=text.replace(/`([^`\n]+)`/g,(_,x)=>reserve('<code>'+x+'</code>'));
  text=text.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,(_,name,url)=>reserve('<a target="_blank" rel="noopener noreferrer" href="'+url+'">'+name+'</a>'));
  text=text.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/__(.+?)__/g,'<strong>$1</strong>');
  text=text.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g,'<em>$1</em>');
  return text.replace(/\uE000(\d+)\uE001/g,(_,i)=>tokens[Number(i)]||'');
 }
 const isFence=l=>/^\s*(```|~~~)/.test(l);
 const isTableSep=l=>/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(l);
 const cells=l=>l.trim().replace(/^\|/,'').replace(/\|$/,'').split(/(?<!\\)\|/).map(s=>s.trim().replace(/\\\|/g,'|'));
 const special=l=>/^\s*(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s?|---+\s*$)/.test(l)||isFence(l);
 function render(input){
  const lines=String(input??'').replace(/\r\n?/g,'\n').split('\n'),out=[];let i=0;
  while(i<lines.length){let line=lines[i];if(!line.trim()){i++;continue}
   if(isFence(line)){
    const start=line.trim().slice(0,3);const lang=line.trim().slice(3).trim().replace(/[^a-zA-Z0-9_-]/g,'');const code=[];i++;
    while(i<lines.length&&!lines[i].trim().startsWith(start))code.push(lines[i++]);
    if(i<lines.length)i++;
    out.push('<pre class="alice-md-code"><code'+(lang?' data-lang="'+lang+'"':'')+'>'+escape(code.join('\n'))+'</code></pre>');continue;
   }
   let h=line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/);
   if(h){let level=Math.min(5,h[1].length+1);out.push('<h'+level+'>'+inline(h[2])+'</h'+level+'>');i++;continue}
   if(/^\s*(---+|\*\s*\*\s*\*+)\s*$/.test(line)){out.push('<hr>');i++;continue}
   if(i+1<lines.length && line.includes('|') && isTableSep(lines[i+1])){
    const headers=cells(line),sep=cells(lines[i+1]),alignment=sep.map(c=>c.startsWith(':')&&c.endsWith(':')?'center':c.endsWith(':')?'right':'left');i+=2;
    let table='<div class="alice-md-tablewrap"><table><thead><tr>'+headers.map((h,j)=>'<th style="text-align:'+alignment[j%alignment.length]+'">'+inline(h)+'</th>').join('')+'</tr></thead><tbody>';
    while(i<lines.length&&lines[i].includes('|')&&lines[i].trim()){
     const row=cells(lines[i]);table+='<tr>'+headers.map((_,j)=>'<td style="text-align:'+alignment[j%alignment.length]+'">'+inline(row[j]||'')+'</td>').join('')+'</tr>';i++;
    }
    out.push(table+'</tbody></table></div>');continue;
   }
   let match=line.match(/^\s*([-*+]|\d+[.)])\s+(.+)$/);
   if(match){const ordered=/^\d/.test(match[1]);const items=[];
    while(i<lines.length){const m=lines[i].match(/^\s*([-*+]|\d+[.)])\s+(.+)$/);if(!m||/^\d/.test(m[1])!==ordered)break;items.push('<li>'+inline(m[2])+'</li>');i++}
    out.push('<'+(ordered?'ol':'ul')+'>'+items.join('')+'</'+(ordered?'ol':'ul')+'>');continue;
   }
   if(/^\s*>/.test(line)){const quote=[];while(i<lines.length&&/^\s*>/.test(lines[i]))quote.push(lines[i++].replace(/^\s*>\s?/,''));out.push('<blockquote>'+render(quote.join('\n'))+'</blockquote>');continue}
   const paragraph=[line];i++;
   while(i<lines.length&&lines[i].trim()&&!special(lines[i])&&!(i+1<lines.length&&lines[i].includes('|')&&isTableSep(lines[i+1]))){paragraph.push(lines[i]);i++}
   out.push('<p>'+paragraph.map(inline).join('<br>')+'</p>');
  }
  return out.join('\n');
 }
 global.aliceRenderMarkdown=render;
})(typeof window!=='undefined'?window:globalThis);
