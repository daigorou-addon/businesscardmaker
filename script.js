(function(){
  'use strict';

  // 日本の標準名刺サイズ 91mm x 55mm を300dpiで再現
  const MM_W = 91, MM_H = 55, DPI = 300;
  const CARD_W = Math.round(MM_W / 25.4 * DPI); // 1075
  const CARD_H = Math.round(MM_H / 25.4 * DPI); // 650

  const COLORS = ['#29e0c4','#2563eb','#e0592e','#16a34a','#c026d3','#111827','#d97706','#0891b2'];
  const FONT = '"Zen Kaku Gothic New","Hiragino Sans","Noto Sans JP",sans-serif';

  let state = {
    side: 'front',
    backEnabled: false,
    templateId: { front:'simple', back:'back_logo' },
    accentColor: COLORS[0], // null = アクセントカラーなし
    fields: { company:'株式会社サンプル', name:'日本太郎', kana:'にほん たろう', department:'営業部', title:'部長',
               postal:'〒100-0001', address:'東京都千代田区千代田1-1', tel:'03-1234-5678', fax:'03-1234-5679',
               email:'mail@example.com', url:'https://example.com', line:'', instagram:'',
               company_en:'Sample Co., Ltd.', name_en:'Taro Nihon', address_en:'1-1 Chiyoda, Chiyoda-ku, Tokyo 100-0001',
               business:'Webサイト制作\nソフトウェア開発\nコンサルティング' },
    logoImg: null,
    logoRect: { front:null, back:null }, // {x,y,w,h}（カード座標系 0..CARD_W / 0..CARD_H）
  };

  // ---------- 色まわりのヘルパー（アクセントカラー「なし」に対応） ----------
  function surfaceBg(color){ return color || '#eef0f1'; }          // ブロック背景色（なし時は淡いグレー）
  function surfaceText(color){ return color ? '#ffffff' : '#333333'; } // ブロック背景上の文字色
  function accentLine(color){ return color || '#333333'; }          // アクセントライン・下線
  function watermarkTone(color){ return color || '#d7d7d7'; }        // 背景の薄い透かし色

  // ---------- 描画ヘルパー ----------
  function fitFontSize(ctx, text, maxWidth, baseSize, weight, minSize){
    minSize = minSize || 10;
    let size = baseSize;
    while(size > minSize){
      ctx.font = `${weight} ${size}px ${FONT}`;
      if(ctx.measureText(text).width <= maxWidth) break;
      size -= 1;
    }
    return size;
  }

  function drawLinesFit(ctx, lines, x, yTop, yBottom, opts){
    opts = opts || {};
    const n = lines.length;
    if(n === 0) return;
    const align = opts.align || 'left';
    const color = opts.color || '#444';
    const maxFont = opts.maxFont || (yBottom - yTop);
    const slot = (yBottom - yTop) / n;
    const fontSize = Math.min(maxFont, slot * 0.64);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.font = `400 ${fontSize}px ${FONT}`;
    for(let i=0;i<n;i++){
      const baseline = yTop + slot*i + slot*0.74;
      ctx.fillText(lines[i], x, baseline);
    }
  }

  function contactLines(f){
    const lines = [];
    if(f.postal || f.address) lines.push([f.postal, f.address].filter(Boolean).join('　'));
    if(f.tel) lines.push('TEL：' + f.tel + (f.fax ? '　FAX：' + f.fax : ''));
    else if(f.fax) lines.push('FAX：' + f.fax);
    if(f.email) lines.push('Email：' + f.email);
    if(f.url) lines.push(f.url);
    if(f.line) lines.push('LINE：' + f.line);
    if(f.instagram) lines.push('Instagram：' + f.instagram);
    return lines;
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight){
    let line = '', yy = y;
    for(const ch of text){
      const test = line + ch;
      if(ctx.measureText(test).width > maxWidth && line){
        ctx.fillText(line, x, yy); line = ch; yy += lineHeight;
      } else { line = test; }
    }
    if(line) ctx.fillText(line, x, yy);
  }

  function roundRectPath(ctx, x, y, w, h, r){
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.arcTo(x+w, y, x+w, y+h, r);
    ctx.arcTo(x+w, y+h, x, y+h, r);
    ctx.arcTo(x, y+h, x, y, r);
    ctx.arcTo(x, y, x+w, y, r);
    ctx.closePath();
  }

  // ---------- 表面テンプレート ----------
  function drawSimple(ctx, W, H, f, color, hasLogo){
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle = accentLine(color); ctx.fillRect(0,0,W*0.012,H);

    const padL = W*0.09, padR = W*0.07;
    let y = H*0.16;
    if(f.company){ ctx.fillStyle='#555'; ctx.font=`600 ${H*0.052}px ${FONT}`; ctx.textAlign='left'; ctx.fillText(f.company, padL, y); y += H*0.075; }
    if(f.name){
      const size = fitFontSize(ctx, f.name, W - padL - padR - W*0.22, H*0.15, 700);
      ctx.fillStyle = '#111'; ctx.font = `700 ${size}px ${FONT}`;
      ctx.fillText(f.name, padL, y + size*0.78);
      if(f.kana){ ctx.fillStyle='#888'; ctx.font=`400 ${H*0.035}px ${FONT}`; ctx.fillText(f.kana, padL, y + size*0.78 + H*0.055); }
      y += size*0.95 + (f.kana ? H*0.06 : 0);
    }
    const posLine = [f.department, f.title].filter(Boolean).join('　');
    if(posLine){ ctx.fillStyle='#555'; ctx.font=`500 ${H*0.045}px ${FONT}`; ctx.fillText(posLine, padL, y + H*0.04); }

    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(padL, H*0.72); ctx.lineTo(W-padR, H*0.72); ctx.stroke();
    drawLinesFit(ctx, contactLines(f), padL, H*0.78, H*0.97, { align:'left', color:'#444', maxFont:H*0.037 });
  }

  function drawColorBlock(ctx, W, H, f, color, hasLogo){
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,W,H);
    const blockW = W*0.33;
    ctx.fillStyle = surfaceBg(color); ctx.fillRect(0,0,blockW,H);
    const txtColor = surfaceText(color);

    if(!hasLogo && f.company){
      ctx.fillStyle = txtColor; ctx.textAlign='left';
      const size = fitFontSize(ctx, f.company, blockW*0.8, H*0.07, 700, 12);
      ctx.font = `700 ${size}px ${FONT}`;
      wrapText(ctx, f.company, blockW*0.12, H*0.30, blockW*0.76, size*1.2);
    }
    const leftLines = contactLines(f).slice(0,3).map(l => l.length>26? l.slice(0,26)+'…' : l);
    drawLinesFit(ctx, leftLines, blockW*0.12, H*0.78, H*0.96, { align:'left', color: color ? 'rgba(255,255,255,.85)' : 'rgba(51,51,51,.8)', maxFont:H*0.032 });

    const padL = blockW + W*0.08;
    let y = H*0.30;
    if(f.name){
      const size = fitFontSize(ctx, f.name, W - padL - W*0.06, H*0.16, 700);
      ctx.fillStyle = '#111'; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign='left';
      ctx.fillText(f.name, padL, y);
      if(f.kana){ ctx.fillStyle='#999'; ctx.font=`400 ${H*0.032}px ${FONT}`; ctx.fillText(f.kana, padL, y+H*0.055); }
      y += H*0.10;
    }
    const posLine = [f.department, f.title].filter(Boolean).join('　');
    if(posLine){ ctx.fillStyle='#555'; ctx.font=`500 ${H*0.042}px ${FONT}`; ctx.fillText(posLine, padL, y); y += H*0.09; }

    ctx.strokeStyle='#eee'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(padL, H*0.70); ctx.lineTo(W-W*0.06, H*0.70); ctx.stroke();
    drawLinesFit(ctx, contactLines(f), padL, H*0.76, H*0.97, { align:'left', color:'#444', maxFont:H*0.034 });
  }

  function drawTopBar(ctx, W, H, f, color, hasLogo){
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,W,H);
    const barH = H*0.22;
    ctx.fillStyle = surfaceBg(color); ctx.fillRect(0,0,W,barH);
    ctx.textAlign='center';
    if(!hasLogo && f.company){
      ctx.fillStyle = surfaceText(color); const size = fitFontSize(ctx, f.company, W*0.7, barH*0.42, 700, 14);
      ctx.font = `700 ${size}px ${FONT}`; ctx.textBaseline='middle';
      ctx.fillText(f.company, W/2, barH/2);
    }
    ctx.textBaseline='alphabetic';
    let y = barH + H*0.17;
    if(f.name){
      const size = fitFontSize(ctx, f.name, W*0.8, H*0.15, 700);
      ctx.fillStyle='#111'; ctx.font = `700 ${size}px ${FONT}`;
      ctx.fillText(f.name, W/2, y); y += H*0.05;
      if(f.kana){ ctx.fillStyle='#999'; ctx.font=`400 ${H*0.032}px ${FONT}`; ctx.fillText(f.kana, W/2, y); y += H*0.045; }
    }
    const posLine = [f.department, f.title].filter(Boolean).join('　');
    if(posLine){ ctx.fillStyle='#555'; ctx.font=`500 ${H*0.04}px ${FONT}`; ctx.fillText(posLine, W/2, y+H*0.03); }
    drawLinesFit(ctx, contactLines(f), W/2, H*0.78, H*0.97, { align:'center', color:'#444', maxFont:H*0.034 });
  }

  function drawMinimalLine(ctx, W, H, f, color, hasLogo){
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,W,H);
    const padL = W*0.09; ctx.textAlign='left';
    if(f.company){ ctx.fillStyle = '#999'; ctx.font = `600 ${H*0.034}px ${FONT}`; ctx.fillText(f.company.toUpperCase(), padL, H*0.16); }
    let y = H*0.46;
    if(f.name){
      const size = fitFontSize(ctx, f.name, W*0.6, H*0.17, 700);
      ctx.fillStyle = '#111'; ctx.font = `700 ${size}px ${FONT}`;
      ctx.fillText(f.name, padL, y);
      ctx.strokeStyle = accentLine(color); ctx.lineWidth = H*0.012;
      ctx.beginPath(); ctx.moveTo(padL, y+H*0.035); ctx.lineTo(padL + Math.min(ctx.measureText(f.name).width, W*0.6), y+H*0.035); ctx.stroke();
      y += H*0.075;
      if(f.kana){ ctx.fillStyle='#999'; ctx.font=`400 ${H*0.03}px ${FONT}`; ctx.fillText(f.kana, padL, y); y += H*0.05; }
    }
    const posLine = [f.department, f.title].filter(Boolean).join('　');
    if(posLine){ ctx.fillStyle='#666'; ctx.font=`500 ${H*0.038}px ${FONT}`; ctx.fillText(posLine, padL, y); }
    drawLinesFit(ctx, contactLines(f), W - W*0.07, H*0.78, H*0.97, { align:'right', color:'#444', maxFont:H*0.032 });
  }

  function drawDiagonal(ctx, W, H, f, color, hasLogo){
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle = surfaceBg(color);
    ctx.beginPath(); ctx.moveTo(W*0.62,0); ctx.lineTo(W,0); ctx.lineTo(W,H); ctx.lineTo(W*0.42,H); ctx.closePath(); ctx.fill();

    ctx.textAlign='left';
    const padL = W*0.08;
    let y = H*0.30;
    if(f.company){ ctx.fillStyle='#666'; ctx.font=`600 ${H*0.038}px ${FONT}`; ctx.fillText(f.company, padL, H*0.16); }
    if(f.name){
      const size = fitFontSize(ctx, f.name, W*0.46, H*0.15, 700);
      ctx.fillStyle='#111'; ctx.font=`700 ${size}px ${FONT}`;
      ctx.fillText(f.name, padL, y); y += H*0.065;
      if(f.kana){ ctx.fillStyle='#999'; ctx.font=`400 ${H*0.03}px ${FONT}`; ctx.fillText(f.kana, padL, y); y+=H*0.05; }
    }
    const posLine = [f.department, f.title].filter(Boolean).join('　');
    if(posLine){ ctx.fillStyle='#555'; ctx.font=`500 ${H*0.038}px ${FONT}`; ctx.fillText(posLine, padL, y); }

    const diagLines = contactLines(f).map(l => l.length>24? l.slice(0,24)+'…' : l);
    drawLinesFit(ctx, diagLines, W*0.66, H*0.68, H*0.95, { align:'left', color: surfaceText(color), maxFont:H*0.032 });
  }

  function drawLogoCenter(ctx, W, H, f, color, hasLogo){
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,W,H);
    ctx.textAlign='center';
    if(!hasLogo && f.company){
      const size = fitFontSize(ctx, f.company, W*0.7, H*0.08, 700, 14);
      ctx.fillStyle = accentLine(color); ctx.font = `700 ${size}px ${FONT}`;
      ctx.fillText(f.company, W/2, H*0.22);
    }
    ctx.strokeStyle='#ddd'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(W*0.3,H*0.42); ctx.lineTo(W*0.7,H*0.42); ctx.stroke();

    let y = H*0.57;
    if(f.name){
      const size = fitFontSize(ctx, f.name, W*0.7, H*0.13, 700);
      ctx.fillStyle='#111'; ctx.font=`700 ${size}px ${FONT}`;
      ctx.fillText(f.name, W/2, y); y += H*0.05;
      if(f.kana){ ctx.fillStyle='#999'; ctx.font=`400 ${H*0.03}px ${FONT}`; ctx.fillText(f.kana, W/2, y); y += H*0.045; }
    }
    const posLine = [f.department, f.title].filter(Boolean).join('　');
    if(posLine){ ctx.fillStyle='#555'; ctx.font=`500 ${H*0.036}px ${FONT}`; ctx.fillText(posLine, W/2, y+H*0.03); }
    drawLinesFit(ctx, contactLines(f), W/2, H*0.78, H*0.97, { align:'center', color:'#444', maxFont:H*0.03 });
  }

  function drawRightAlign(ctx, W, H, f, color, hasLogo){
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle = accentLine(color); ctx.fillRect(W-W*0.012,0,W*0.012,H);
    ctx.textAlign='right';
    const padR = W*0.09;
    let y = H*0.30;
    if(f.company){ ctx.fillStyle='#666'; ctx.font=`600 ${H*0.038}px ${FONT}`; ctx.fillText(f.company, W-padR, H*0.16); }
    if(f.name){
      const size = fitFontSize(ctx, f.name, W*0.6, H*0.15, 700);
      ctx.fillStyle='#111'; ctx.font=`700 ${size}px ${FONT}`;
      ctx.fillText(f.name, W-padR, y); y += H*0.065;
      if(f.kana){ ctx.fillStyle='#999'; ctx.font=`400 ${H*0.03}px ${FONT}`; ctx.fillText(f.kana, W-padR, y); y += H*0.05; }
    }
    const posLine = [f.department, f.title].filter(Boolean).join('　');
    if(posLine){ ctx.fillStyle='#555'; ctx.font=`500 ${H*0.038}px ${FONT}`; ctx.fillText(posLine, W-padR, y); }
    ctx.strokeStyle='#ddd'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(W*0.3, H*0.70); ctx.lineTo(W-padR, H*0.70); ctx.stroke();
    drawLinesFit(ctx, contactLines(f), W-padR, H*0.78, H*0.97, { align:'right', color:'#444', maxFont:H*0.032 });
  }

  function drawWatermark(ctx, W, H, f, color, hasLogo){
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,W,H);
    const initial = (f.name || f.company || '?').trim().charAt(0);
    ctx.save(); ctx.globalAlpha = 0.14; ctx.fillStyle = watermarkTone(color);
    ctx.font = `800 ${H*0.9}px ${FONT}`; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(initial, W*0.78, H*0.52); ctx.restore();

    ctx.textAlign='left';
    const padL = W*0.09;
    if(f.company){ ctx.fillStyle = accentLine(color); ctx.font=`700 ${H*0.04}px ${FONT}`; ctx.fillText(f.company, padL, H*0.18); }
    let y = H*0.42;
    if(f.name){
      const size = fitFontSize(ctx, f.name, W*0.5, H*0.15, 700);
      ctx.fillStyle='#111'; ctx.font=`700 ${size}px ${FONT}`;
      ctx.fillText(f.name, padL, y); y += H*0.065;
      if(f.kana){ ctx.fillStyle='#999'; ctx.font=`400 ${H*0.03}px ${FONT}`; ctx.fillText(f.kana, padL, y); y+=H*0.05; }
    }
    const posLine = [f.department, f.title].filter(Boolean).join('　');
    if(posLine){ ctx.fillStyle='#555'; ctx.font=`500 ${H*0.038}px ${FONT}`; ctx.fillText(posLine, padL, y); }
    drawLinesFit(ctx, contactLines(f), padL, H*0.78, H*0.97, { align:'left', color:'#444', maxFont:H*0.032 });
  }

  function drawBottomBar(ctx, W, H, f, color, hasLogo){
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,W,H);
    const barH = H*0.24;
    ctx.fillStyle = surfaceBg(color); ctx.fillRect(0,H-barH,W,barH);
    ctx.textAlign='center';
    const txtColor = surfaceText(color);

    let y = H*0.20;
    if(f.company){ ctx.fillStyle='#666'; ctx.font=`600 ${H*0.04}px ${FONT}`; ctx.fillText(f.company, W/2, y); y += H*0.08; }
    if(f.name){
      const size = fitFontSize(ctx, f.name, W*0.8, H*0.16, 700);
      ctx.fillStyle='#111'; ctx.font=`700 ${size}px ${FONT}`;
      ctx.fillText(f.name, W/2, y); y += H*0.055;
      if(f.kana){ ctx.fillStyle='#999'; ctx.font=`400 ${H*0.03}px ${FONT}`; ctx.fillText(f.kana, W/2, y); y+=H*0.045; }
    }
    const posLine = [f.department, f.title].filter(Boolean).join('　');
    if(posLine){ ctx.fillStyle='#555'; ctx.font=`500 ${H*0.038}px ${FONT}`; ctx.fillText(posLine, W/2, y); }

    drawLinesFit(ctx, contactLines(f), W/2, H-barH+barH*0.12, H-barH*0.08, { align:'center', color:txtColor, maxFont:H*0.03 });
  }

  function drawRoundedFrame(ctx, W, H, f, color, hasLogo){
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle = accentLine(color); ctx.lineWidth = H*0.018;
    roundRectPath(ctx, H*0.05, H*0.05, W-H*0.10, H-H*0.10, H*0.08);
    ctx.stroke();

    ctx.textAlign='center';
    if(f.company){ ctx.fillStyle='#666'; ctx.font=`600 ${H*0.036}px ${FONT}`; ctx.fillText(f.company, W/2, H*0.26); }
    let y = H*0.44;
    if(f.name){
      const size = fitFontSize(ctx, f.name, W*0.6, H*0.14, 700);
      ctx.fillStyle='#111'; ctx.font=`700 ${size}px ${FONT}`;
      ctx.fillText(f.name, W/2, y); y += H*0.05;
      if(f.kana){ ctx.fillStyle='#999'; ctx.font=`400 ${H*0.03}px ${FONT}`; ctx.fillText(f.kana, W/2, y); y+=H*0.045; }
    }
    const posLine = [f.department, f.title].filter(Boolean).join('　');
    if(posLine){ ctx.fillStyle='#555'; ctx.font=`500 ${H*0.036}px ${FONT}`; ctx.fillText(posLine, W/2, y+H*0.03); }
    drawLinesFit(ctx, contactLines(f), W/2, H*0.76, H*0.92, { align:'center', color:'#444', maxFont:H*0.028 });
  }

  function drawGradientCorner(ctx, W, H, f, color, hasLogo){
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,W,H);
    const c = accentLine(color);
    const grad = ctx.createRadialGradient(W*1.02,H*-0.05,W*0.05, W*1.02,H*-0.05,W*0.55);
    grad.addColorStop(0, c); grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad; ctx.fillRect(0,0,W,H);

    ctx.textAlign='left';
    const padL = W*0.09;
    let y = H*0.30;
    if(f.company){ ctx.fillStyle='#666'; ctx.font=`600 ${H*0.038}px ${FONT}`; ctx.fillText(f.company, padL, H*0.16); }
    if(f.name){
      const size = fitFontSize(ctx, f.name, W*0.6, H*0.15, 700);
      ctx.fillStyle='#111'; ctx.font=`700 ${size}px ${FONT}`;
      ctx.fillText(f.name, padL, y); y += H*0.065;
      if(f.kana){ ctx.fillStyle='#999'; ctx.font=`400 ${H*0.03}px ${FONT}`; ctx.fillText(f.kana, padL, y); y += H*0.05; }
    }
    const posLine = [f.department, f.title].filter(Boolean).join('　');
    if(posLine){ ctx.fillStyle='#555'; ctx.font=`500 ${H*0.038}px ${FONT}`; ctx.fillText(posLine, padL, y); }
    drawLinesFit(ctx, contactLines(f), padL, H*0.78, H*0.97, { align:'left', color:'#444', maxFont:H*0.032 });
  }

  function drawDotAccent(ctx, W, H, f, color, hasLogo){
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,W,H);
    const c = accentLine(color);
    ctx.fillStyle = c;
    const rows=5, cols=5, r=H*0.012, gap=H*0.034;
    for(let i=0;i<rows;i++){
      for(let j=0;j<cols;j++){
        if(i+j > 5) continue;
        ctx.globalAlpha = 1 - (i+j)*0.12;
        ctx.beginPath(); ctx.arc(W-W*0.10-j*gap, H*0.12+i*gap, r, 0, Math.PI*2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    ctx.textAlign='left';
    const padL = W*0.09;
    let y = H*0.32;
    if(f.company){ ctx.fillStyle='#666'; ctx.font=`600 ${H*0.038}px ${FONT}`; ctx.fillText(f.company, padL, H*0.16); }
    if(f.name){
      const size = fitFontSize(ctx, f.name, W*0.6, H*0.15, 700);
      ctx.fillStyle='#111'; ctx.font=`700 ${size}px ${FONT}`;
      ctx.fillText(f.name, padL, y); y += H*0.065;
      if(f.kana){ ctx.fillStyle='#999'; ctx.font=`400 ${H*0.03}px ${FONT}`; ctx.fillText(f.kana, padL, y); y += H*0.05; }
    }
    const posLine = [f.department, f.title].filter(Boolean).join('　');
    if(posLine){ ctx.fillStyle='#555'; ctx.font=`500 ${H*0.038}px ${FONT}`; ctx.fillText(posLine, padL, y); }
    drawLinesFit(ctx, contactLines(f), padL, H*0.78, H*0.97, { align:'left', color:'#444', maxFont:H*0.032 });
  }

  const FRONT_TEMPLATES = [
    { id:'simple', nameKey:'tpl_simple', draw: drawSimple },
    { id:'colorblock', nameKey:'tpl_colorblock', draw: drawColorBlock },
    { id:'topbar', nameKey:'tpl_topbar', draw: drawTopBar },
    { id:'minimalline', nameKey:'tpl_minimalline', draw: drawMinimalLine },
    { id:'diagonal', nameKey:'tpl_diagonal', draw: drawDiagonal },
    { id:'logocenter', nameKey:'tpl_logocenter', draw: drawLogoCenter },
    { id:'rightalign', nameKey:'tpl_rightalign', draw: drawRightAlign },
    { id:'watermark', nameKey:'tpl_watermark', draw: drawWatermark },
    { id:'bottombar', nameKey:'tpl_bottombar', draw: drawBottomBar },
    { id:'roundedframe', nameKey:'tpl_roundedframe', draw: drawRoundedFrame },
    { id:'gradientcorner', nameKey:'tpl_gradientcorner', draw: drawGradientCorner },
    { id:'dotaccent', nameKey:'tpl_dotaccent', draw: drawDotAccent },
  ];

  // ---------- 裏面テンプレート ----------
  function drawBackLogo(ctx, W, H, f, color, hasLogo){
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,W,H);
    if(!hasLogo){
      ctx.textAlign='center'; ctx.fillStyle = accentLine(color);
      const size = fitFontSize(ctx, f.company || f.name || '', W*0.7, H*0.1, 700, 14);
      ctx.font = `700 ${size}px ${FONT}`;
      ctx.fillText(f.company || f.name || '', W/2, H/2);
    }
  }

  function drawBackFill(ctx, W, H, f, color, hasLogo){
    ctx.fillStyle = surfaceBg(color); ctx.fillRect(0,0,W,H);
    if(!hasLogo){
      ctx.textAlign='center'; ctx.fillStyle = surfaceText(color);
      const size = fitFontSize(ctx, f.company || f.name || '', W*0.7, H*0.11, 700, 14);
      ctx.font = `700 ${size}px ${FONT}`;
      ctx.fillText(f.company || f.name || '', W/2, H/2);
    }
  }

  function drawBackBilingual(ctx, W, H, f, color, hasLogo){
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle = accentLine(color); ctx.fillRect(0,0,W,H*0.02);
    ctx.textAlign='center';
    let y = H*0.42;
    if(f.company){ ctx.fillStyle='#111'; ctx.font=`700 ${H*0.06}px ${FONT}`; ctx.fillText(f.company, W/2, y); y += H*0.09; }
    const line2 = [f.address].filter(Boolean).join(' ');
    if(line2){ ctx.fillStyle='#555'; ctx.font=`400 ${H*0.034}px ${FONT}`; ctx.fillText(line2, W/2, y); y += H*0.055; }
    const line3 = [f.tel && ('TEL ' + f.tel), f.url].filter(Boolean).join('　|　');
    if(line3){ ctx.fillStyle='#777'; ctx.font=`400 ${H*0.03}px ${FONT}`; ctx.fillText(line3, W/2, y); }
  }

  function drawBackBusiness(ctx, W, H, f, color, hasLogo){
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle = accentLine(color); ctx.fillRect(0,0,W,H*0.09);
    ctx.textAlign='left';
    ctx.fillStyle = surfaceText(color) === '#ffffff' ? '#ffffff' : '#ffffff';
    const size = fitFontSize(ctx, f.company||'', W*0.8, H*0.05, 700, 14);
    ctx.font = `700 ${size}px ${FONT}`; ctx.textBaseline='middle';
    ctx.fillText(f.company||'', W*0.08, H*0.045);
    ctx.textBaseline='alphabetic';

    ctx.fillStyle = '#999'; ctx.font = `600 ${H*0.032}px ${FONT}`;
    ctx.fillText('BUSINESS', W*0.08, H*0.22);

    const items = (f.business||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean).map(s=>'・'+s);
    drawLinesFit(ctx, items, W*0.08, H*0.28, H*0.94, { align:'left', color:'#333', maxFont:H*0.044 });
  }

  function drawBackEnglish(ctx, W, H, f, color, hasLogo){
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,W,H);
    ctx.textAlign='left';
    const padL = W*0.09;
    let y = H*0.34;
    const companyEn = f.company_en || f.company || '';
    if(companyEn){
      const size = fitFontSize(ctx, companyEn, W*0.82, H*0.09, 700);
      ctx.fillStyle = accentLine(color); ctx.font = `700 ${size}px "Zen Kaku Gothic New",Arial,sans-serif`;
      ctx.fillText(companyEn, padL, y); y += H*0.08;
    }
    const nameEn = f.name_en || '';
    if(nameEn){ ctx.fillStyle='#333'; ctx.font=`400 ${H*0.042}px Arial,sans-serif`; ctx.fillText(nameEn, padL, y); y += H*0.07; }

    ctx.strokeStyle='#ddd'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(padL,H*0.58); ctx.lineTo(W-padL,H*0.58); ctx.stroke();

    const lines = [f.address_en, f.tel && ('TEL '+f.tel), f.url].filter(Boolean);
    drawLinesFit(ctx, lines, padL, H*0.66, H*0.93, { align:'left', color:'#555', maxFont:H*0.036 });
  }

  function drawBackBlank(ctx, W, H, f, color, hasLogo){
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle = accentLine(color); ctx.lineWidth = H*0.01;
    ctx.strokeRect(H*0.06, H*0.06, W-H*0.12, H-H*0.12);
  }

  const BACK_TEMPLATES = [
    { id:'back_logo', nameKey:'tpl_back_logo', draw: drawBackLogo },
    { id:'back_fill', nameKey:'tpl_back_fill', draw: drawBackFill },
    { id:'back_bilingual', nameKey:'tpl_back_bilingual', draw: drawBackBilingual },
    { id:'back_business', nameKey:'tpl_back_business', draw: drawBackBusiness },
    { id:'back_english', nameKey:'tpl_back_english', draw: drawBackEnglish },
    { id:'back_blank', nameKey:'tpl_back_blank', draw: drawBackBlank },
  ];

  function templatesFor(side){ return side === 'back' ? BACK_TEMPLATES : FRONT_TEMPLATES; }

  function render(ctx, W, H, side, templateId, color, fields, hasLogo){
    const list = templatesFor(side);
    const tpl = list.find(t => t.id === templateId) || list[0];
    ctx.clearRect(0,0,W,H);
    tpl.draw(ctx, W, H, fields, color, hasLogo);
  }

  // ---------- DOM 配線 ----------
  const canvas = document.getElementById('cardCanvas');
  const ctx = canvas.getContext('2d');
  canvas.width = CARD_W; canvas.height = CARD_H;

  const overlay = document.getElementById('logoOverlay');
  const octx = overlay.getContext('2d');
  overlay.width = CARD_W; overlay.height = CARD_H;

  const cardStack = document.getElementById('cardStack');
  const sideTabs = document.querySelectorAll('.side-tab');
  const templateGridFront = document.getElementById('templateGridFront');
  const templateGridBack = document.getElementById('templateGridBack');
  const colorSwatches = document.getElementById('colorSwatches');
  const customColor = document.getElementById('customColor');
  const downloadBtn = document.getElementById('downloadBtn');
  const printBtn = document.getElementById('printBtn');
  const backFieldsSection = document.getElementById('backFieldsSection');
  const fieldsEnglish = document.getElementById('fieldsEnglish');
  const fieldsBusiness = document.getElementById('fieldsBusiness');
  const logoUploadBtn = document.getElementById('logoUploadBtn');
  const logoClearBtn = document.getElementById('logoClearBtn');
  const logoInput = document.getElementById('logoInput');
  const logoFileName = document.getElementById('logoFileName');

  const fieldIds = ['company','name','kana','department','title','postal','address','tel','fax','email','url',
                     'line','instagram','company_en','name_en','address_en','business'];
  fieldIds.forEach(id => {
    const el = document.getElementById('f_' + id);
    el.value = state.fields[id] || '';
    el.addEventListener('input', () => { state.fields[id] = el.value; draw(); });
  });

  function currentTemplateId(){ return state.templateId[state.side]; }
  function setCurrentTemplateId(id){ state.templateId[state.side] = id; updateBackFieldsVisibility(); }

  // 裏面テンプレートごとに、実際に使う入力項目だけを表示する
  function updateBackFieldsVisibility(){
    if(state.side !== 'back'){
      backFieldsSection.style.display = 'none';
      return;
    }
    const id = currentTemplateId();
    const needsEnglish = id === 'back_english';
    const needsBusiness = id === 'back_business';
    fieldsEnglish.style.display = needsEnglish ? '' : 'none';
    fieldsBusiness.style.display = needsBusiness ? '' : 'none';
    backFieldsSection.style.display = (needsEnglish || needsBusiness) ? '' : 'none';
  }

  function defaultLogoRect(img){
    const w = CARD_W * 0.20;
    let h = w * (img.height / img.width);
    if(h > CARD_H*0.55){ h = CARD_H*0.55; }
    return { x: CARD_W*0.76, y: CARD_H*0.08, w, h };
  }

  function currentLogoRect(){
    if(!state.logoImg) return null;
    if(!state.logoRect[state.side]) state.logoRect[state.side] = defaultLogoRect(state.logoImg);
    return state.logoRect[state.side];
  }

  function draw(){
    render(ctx, CARD_W, CARD_H, state.side, currentTemplateId(), state.accentColor, state.fields, !!state.logoImg);
    const rect = currentLogoRect();
    if(state.logoImg && rect){
      ctx.drawImage(state.logoImg, rect.x, rect.y, rect.w, rect.h);
    }
    renderThumbnails();
    drawOverlay();
  }

  function renderThumbnails(){
    [templateGridFront, templateGridBack].forEach((grid, gi) => {
      const side = gi === 0 ? 'front' : 'back';
      grid.querySelectorAll('.template-item').forEach(item => {
        const id = item.dataset.id;
        const c = item.querySelector('canvas');
        const tctx = c.getContext('2d');
        render(tctx, c.width, c.height, side, id, state.accentColor, state.fields, !!state.logoImg);
        if(state.logoImg && side === state.side){
          const r = currentLogoRect();
          if(r){
            const sx = c.width / CARD_W, sy = c.height / CARD_H;
            tctx.drawImage(state.logoImg, r.x*sx, r.y*sy, r.w*sx, r.h*sy);
          }
        }
        item.classList.toggle('active', id === state.templateId[side]);
      });
    });
  }

  function buildTemplateGrid(grid, list, side){
    grid.innerHTML = '';
    list.forEach(tpl => {
      const item = document.createElement('div');
      item.className = 'template-item';
      item.dataset.id = tpl.id;
      const c = document.createElement('canvas');
      c.width = 215; c.height = Math.round(215 * CARD_H / CARD_W);
      item.appendChild(c);
      const label = document.createElement('div');
      label.className = 'template-name'; label.textContent = t(tpl.nameKey);
      item.appendChild(label);
      item.addEventListener('click', () => { setCurrentTemplateId(tpl.id); draw(); });
      grid.appendChild(item);
    });
  }

  function buildColorSwatches(){
    colorSwatches.innerHTML = '';
    const noneBtn = document.createElement('button');
    noneBtn.className = 'color-swatch none-swatch';
    noneBtn.title = t('none_color_title');
    noneBtn.addEventListener('click', () => { state.accentColor = null; draw(); updateSwatchActive(); });
    colorSwatches.appendChild(noneBtn);

    COLORS.forEach(c => {
      const btn = document.createElement('button');
      btn.className = 'color-swatch';
      btn.style.background = c;
      btn.dataset.color = c;
      btn.addEventListener('click', () => { state.accentColor = c; customColor.value = c; draw(); updateSwatchActive(); });
      colorSwatches.appendChild(btn);
    });
    updateSwatchActive();
  }

  function updateSwatchActive(){
    colorSwatches.querySelectorAll('.color-swatch').forEach(btn => {
      const isNone = btn.classList.contains('none-swatch');
      btn.classList.toggle('active', isNone ? state.accentColor === null : (btn.dataset.color && state.accentColor && btn.dataset.color.toLowerCase() === state.accentColor.toLowerCase()));
    });
  }

  customColor.value = state.accentColor;
  customColor.addEventListener('input', () => { state.accentColor = customColor.value; draw(); updateSwatchActive(); });

  function switchSide(side){
    state.side = side;
    sideTabs.forEach(t => t.classList.toggle('active', t.dataset.side === side));
    templateGridFront.style.display = side === 'front' ? '' : 'none';
    templateGridBack.style.display = side === 'back' ? '' : 'none';
    updateBackFieldsVisibility();
    draw();
  }

  function updateSideTabsDisabled(){
    sideTabs.forEach(t => {
      if(t.dataset.side === 'back') t.classList.toggle('disabled', !state.backEnabled);
    });
  }

  sideTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      if(tab.dataset.side === 'back' && !state.backEnabled) return;
      switchSide(tab.dataset.side);
    });
  });

  const backEnabledToggle = document.getElementById('backEnabledToggle');
  backEnabledToggle.addEventListener('change', () => {
    state.backEnabled = backEnabledToggle.checked;
    updateSideTabsDisabled();
    if(!state.backEnabled && state.side === 'back'){
      switchSide('front');
    }
  });

  logoUploadBtn.addEventListener('click', () => logoInput.click());
  logoInput.addEventListener('change', () => {
    const file = logoInput.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        state.logoImg = img;
        state.logoRect = { front:null, back:null };
        draw();
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    logoFileName.textContent = file.name;
  });
  logoClearBtn.addEventListener('click', () => {
    state.logoImg = null;
    state.logoRect = { front:null, back:null };
    logoInput.value = '';
    logoFileName.textContent = '未選択';
    draw();
  });

  downloadBtn.addEventListener('click', () => {
    const a = document.createElement('a');
    const suffix = state.side === 'back' ? t('back_suffix') : '';
    a.download = (state.fields.name || t('card_fallback_name')) + suffix + '.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
  });

  // 指定した面（表/裏）をオフスクリーンに描画してdataURLを返す（印刷用）
  function renderSideToDataURL(side){
    const tmp = document.createElement('canvas');
    tmp.width = CARD_W; tmp.height = CARD_H;
    const tctx = tmp.getContext('2d');
    render(tctx, CARD_W, CARD_H, side, state.templateId[side], state.accentColor, state.fields, !!state.logoImg);
    const rect = state.logoImg ? (state.logoRect[side] || defaultLogoRect(state.logoImg)) : null;
    if(state.logoImg && rect){ tctx.drawImage(state.logoImg, rect.x, rect.y, rect.w, rect.h); }
    return tmp.toDataURL('image/png');
  }

  printBtn.addEventListener('click', () => {
    const frontUrl = renderSideToDataURL('front');
    const pages = [`<div class="pg"><img src="${frontUrl}"></div>`];
    if(state.backEnabled){
      const backUrl = renderSideToDataURL('back');
      pages.push(`<div class="pg"><img src="${backUrl}"></div>`);
    }
    const w = window.open('', '_blank');
    if(!w){ return; }
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${t('brand_name')}</title>
<style>
  @page { size: ${MM_W}mm ${MM_H}mm; margin: 0; }
  *{ margin:0; padding:0; }
  body{ background:#888; }
  .pg{ width:${MM_W}mm; height:${MM_H}mm; page-break-after: always; overflow:hidden; }
  .pg:last-child{ page-break-after: auto; }
  .pg img{ width:100%; height:100%; display:block; }
  @media screen{
    body{ display:flex; flex-direction:column; align-items:center; gap:16px; padding:16px; }
    .pg{ box-shadow:0 4px 14px rgba(0,0,0,.35); }
  }
</style>
</head><body>
  ${pages.join('\n  ')}
  <script>
    window.onload = function(){ setTimeout(function(){ window.print(); }, 150); };
  </script>
</body></html>`);
    w.document.close();
  });

  // ---------- ロゴのドラッグ移動・リサイズ（マウス/タッチ/ペン共通：Pointer Events） ----------
  const logoMove = document.getElementById('logoMove');
  const logoHandle = document.getElementById('logoHandle');
  let drag = null; // { mode:'move'|'resize', px, py, rect, aspect }

  function toCardCoords(evt){
    const rect = overlay.getBoundingClientRect();
    const scaleX = CARD_W / rect.width, scaleY = CARD_H / rect.height;
    return { x: (evt.clientX - rect.left) * scaleX, y: (evt.clientY - rect.top) * scaleY };
  }

  function drawOverlay(){
    octx.clearRect(0,0,CARD_W,CARD_H);
    const r = currentLogoRect();
    if(!r){
      logoMove.style.display = 'none';
      logoHandle.style.display = 'none';
      return;
    }
    // 画面上の見た目の大きさが小さくなりすぎないよう、表示倍率に合わせて線・丸の太さを補正
    const scale = (overlay.getBoundingClientRect().width || CARD_W) / CARD_W;
    const handleR = Math.max(CARD_W * 0.018, 9 / scale);
    octx.save();
    octx.strokeStyle = '#29e0c4';
    octx.lineWidth = Math.max(3, 2 / scale);
    octx.setLineDash([10,7]);
    octx.strokeRect(r.x, r.y, r.w, r.h);
    octx.setLineDash([]);
    octx.fillStyle = '#29e0c4';
    octx.beginPath();
    octx.arc(r.x + r.w, r.y + r.h, handleR, 0, Math.PI*2);
    octx.fill();
    octx.strokeStyle = '#ffffff'; octx.lineWidth = Math.max(2, 1.5 / scale); octx.stroke();
    octx.restore();

    // 操作用の透明な領域（ロゴ本体と右下ハンドル）を、カード表示に対する%で配置
    logoMove.style.display = 'block';
    logoMove.style.left = (r.x / CARD_W * 100) + '%';
    logoMove.style.top = (r.y / CARD_H * 100) + '%';
    logoMove.style.width = (r.w / CARD_W * 100) + '%';
    logoMove.style.height = (r.h / CARD_H * 100) + '%';
    logoHandle.style.display = 'block';
    logoHandle.style.left = ((r.x + r.w) / CARD_W * 100) + '%';
    logoHandle.style.top = ((r.y + r.h) / CARD_H * 100) + '%';
  }

  function startDrag(mode, evt){
    const r = currentLogoRect();
    if(!r) return;
    const p = toCardCoords(evt);
    drag = { mode, px:p.x, py:p.y, rect:{...r}, aspect: state.logoImg.width / state.logoImg.height };
    evt.currentTarget.setPointerCapture(evt.pointerId);
    evt.preventDefault();
    evt.stopPropagation();
  }

  function onDragMove(evt){
    if(!drag) return;
    const r = currentLogoRect();
    if(!r) return;
    const p = toCardCoords(evt);
    const dx = p.x - drag.px, dy = p.y - drag.py;
    if(drag.mode === 'move'){
      r.x = drag.rect.x + dx;
      r.y = drag.rect.y + dy;
    } else {
      const newW = Math.max(CARD_W * 0.04, drag.rect.w + dx);
      r.w = newW; r.h = newW / drag.aspect;
    }
    draw();
  }

  function endDrag(){ drag = null; }

  logoMove.addEventListener('pointerdown', e => startDrag('move', e));
  logoHandle.addEventListener('pointerdown', e => startDrag('resize', e));
  [logoMove, logoHandle].forEach(el => {
    el.addEventListener('pointermove', onDragMove);
    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);
  });
  // 画面サイズが変わったら、ハンドルの大きさ補正をやり直す
  window.addEventListener('resize', drawOverlay);

  function updateTemplateLabels(){
    [templateGridFront, templateGridBack].forEach((grid, gi) => {
      const list = gi === 0 ? FRONT_TEMPLATES : BACK_TEMPLATES;
      grid.querySelectorAll('.template-item').forEach(item => {
        const tpl = list.find(t2 => t2.id === item.dataset.id);
        if(tpl) item.querySelector('.template-name').textContent = t(tpl.nameKey);
      });
    });
  }

  function updateLogoFileNameText(){
    if(!state.logoImg) logoFileName.textContent = t('logo_none');
  }

  window.meishimakerOnLangChange = function(){
    updateTemplateLabels();
    updateLogoFileNameText();
    colorSwatches.querySelector('.none-swatch').title = t('none_color_title');
  };

  buildTemplateGrid(templateGridFront, FRONT_TEMPLATES, 'front');
  buildTemplateGrid(templateGridBack, BACK_TEMPLATES, 'back');
  buildColorSwatches();
  updateLogoFileNameText();
  updateBackFieldsVisibility();
  updateSideTabsDisabled();
  draw();
})();
