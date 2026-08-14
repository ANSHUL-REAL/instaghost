/* InstaGhost — in-page control panel.
 * Lives in a shadow root so Instagram's stylesheet cannot touch it and ours
 * cannot leak out. */
(function () {
  'use strict';
  var IGX = window.IGX;
  var CFG = window.IGX_CONFIG;

  var P = IGX.panel = {};
  var host = null, root = null, ui = {};
  var currentTab = 'ghost';
  var query = '';

  /* ================================================================== *
   * styles
   * ================================================================== */
  var CSS = `
  :host{all:initial;}
  *{box-sizing:border-box;margin:0;padding:0;font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}
  :host{
    --acc:124,92,255;
    --bg:14,15,22;
    --bg2:20,21,31;
    --card:26,27,39;
    --line:44,46,64;
    --tx:236,237,245;
    --tx2:150,153,175;
    --ok:64,214,153;
    --warn:255,183,77;
    --bad:255,107,124;
  }

  /* ---------- launcher ---------- */
  .launch{
    position:fixed;right:20px;bottom:20px;z-index:2147483000;
    display:flex;align-items:center;gap:9px;
    height:46px;padding:0 16px 0 13px;border-radius:23px;
    background:linear-gradient(135deg,rgba(var(--acc),1),rgba(var(--acc),.72));
    color:#fff;font-size:13.5px;font-weight:600;letter-spacing:.2px;
    box-shadow:0 8px 28px rgba(var(--acc),.42),0 2px 8px rgba(0,0,0,.4);
    cursor:pointer;user-select:none;
    transition:transform .22s cubic-bezier(.2,.8,.3,1),box-shadow .22s ease,opacity .2s ease;
  }
  .launch:hover{transform:translateY(-2px) scale(1.02);box-shadow:0 14px 36px rgba(var(--acc),.5);}
  .launch:active{transform:translateY(0) scale(.98);}
  .launch .dot{width:7px;height:7px;border-radius:50%;background:#fff;opacity:.9;
    box-shadow:0 0 0 0 rgba(255,255,255,.7);animation:pulse 2.6s infinite;}
  .launch.off{background:linear-gradient(135deg,#3a3c4d,#2b2d3a);box-shadow:0 6px 20px rgba(0,0,0,.4);}
  .launch.off .dot{background:rgba(255,255,255,.35);animation:none;}
  @keyframes pulse{0%{box-shadow:0 0 0 0 rgba(255,255,255,.55);}70%{box-shadow:0 0 0 9px rgba(255,255,255,0);}100%{box-shadow:0 0 0 0 rgba(255,255,255,0);}}

  /* ---------- overlay ---------- */
  .overlay{
    position:fixed;inset:0;z-index:2147483100;display:none;
    align-items:center;justify-content:center;
    background:rgba(6,7,12,.62);backdrop-filter:blur(6px);
    opacity:0;transition:opacity .2s ease;
  }
  .overlay.open{display:flex;opacity:1;}

  .panel{
    width:min(980px,94vw);height:min(660px,88vh);
    display:flex;flex-direction:column;overflow:hidden;
    background:rgb(var(--bg));color:rgb(var(--tx));
    border:1px solid rgba(255,255,255,.07);border-radius:20px;
    box-shadow:0 40px 100px rgba(0,0,0,.6),0 0 0 1px rgba(var(--acc),.12);
    transform:translateY(12px) scale(.985);opacity:0;
    transition:transform .26s cubic-bezier(.2,.8,.3,1),opacity .22s ease;
  }
  .overlay.open .panel{transform:none;opacity:1;}

  /* ---------- header ---------- */
  header{
    display:flex;align-items:center;gap:14px;padding:16px 20px;
    border-bottom:1px solid rgba(255,255,255,.06);
    background:linear-gradient(180deg,rgba(var(--acc),.10),rgba(var(--acc),0));
  }
  .brand{display:flex;align-items:center;gap:11px;}
  .glyph{
    width:34px;height:34px;border-radius:11px;display:grid;place-items:center;font-size:17px;
    background:linear-gradient(135deg,rgba(var(--acc),1),rgba(var(--acc),.6));
    box-shadow:0 4px 14px rgba(var(--acc),.4);
  }
  .brand h1{font-size:15.5px;font-weight:700;letter-spacing:-.2px;}
  .brand p{font-size:11.5px;color:rgb(var(--tx2));margin-top:1px;}
  .grow{flex:1;}

  .search{
    display:flex;align-items:center;gap:7px;height:34px;padding:0 12px;
    background:rgb(var(--card));border:1px solid rgba(255,255,255,.06);border-radius:10px;
    min-width:190px;
  }
  .search input{
    all:unset;flex:1;font-size:12.5px;color:rgb(var(--tx));width:100%;
  }
  .search input::placeholder{color:rgb(var(--tx2));}
  .search svg{opacity:.5;flex:none;}

  .master{display:flex;align-items:center;gap:9px;padding:0 4px 0 12px;
    border-left:1px solid rgba(255,255,255,.07);}
  .master span{font-size:12px;font-weight:600;color:rgb(var(--tx2));}
  .master.on span{color:rgb(var(--ok));}

  .x{
    width:32px;height:32px;border-radius:9px;display:grid;place-items:center;
    color:rgb(var(--tx2));cursor:pointer;font-size:18px;line-height:1;
    transition:background .15s ease,color .15s ease;
  }
  .x:hover{background:rgba(255,255,255,.07);color:rgb(var(--tx));}

  /* ---------- body ---------- */
  .body{display:flex;flex:1;min-height:0;}
  nav{
    width:210px;flex:none;padding:12px 10px;overflow-y:auto;
    border-right:1px solid rgba(255,255,255,.06);background:rgb(var(--bg2));
  }
  .navitem{
    display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:10px;
    font-size:13px;font-weight:500;color:rgb(var(--tx2));cursor:pointer;
    transition:background .15s ease,color .15s ease;margin-bottom:2px;
  }
  .navitem:hover{background:rgba(255,255,255,.05);color:rgb(var(--tx));}
  .navitem.sel{background:rgba(var(--acc),.16);color:rgb(var(--tx));
    box-shadow:inset 0 0 0 1px rgba(var(--acc),.28);}
  .navitem .ic{font-size:14px;width:18px;text-align:center;}
  .navitem .cnt{
    margin-left:auto;font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:20px;
    background:rgba(var(--acc),.2);color:rgb(var(--tx));
  }
  .navitem.sel .cnt{background:rgba(var(--acc),.42);}

  main{flex:1;overflow-y:auto;padding:20px 24px 28px;min-width:0;}
  main::-webkit-scrollbar,nav::-webkit-scrollbar{width:9px;}
  main::-webkit-scrollbar-thumb,nav::-webkit-scrollbar-thumb{
    background:rgba(255,255,255,.09);border-radius:9px;border:3px solid transparent;background-clip:padding-box;}

  .tabhead{margin-bottom:16px;}
  .tabhead h2{font-size:19px;font-weight:700;letter-spacing:-.3px;display:flex;align-items:center;gap:9px;}
  .tabhead p{font-size:12.5px;color:rgb(var(--tx2));margin-top:5px;line-height:1.5;}

  /* ---------- rows ---------- */
  .row{
    display:flex;align-items:flex-start;gap:14px;padding:13px 15px;margin-bottom:8px;
    background:rgb(var(--card));border:1px solid rgba(255,255,255,.05);border-radius:13px;
    transition:border-color .18s ease,transform .18s ease,background .18s ease;
  }
  .row:hover{border-color:rgba(var(--acc),.35);background:rgba(var(--card),1);}
  .row .info{flex:1;min-width:0;}
  .row .lbl{font-size:13.5px;font-weight:600;display:flex;align-items:center;gap:7px;}
  .row .hint{font-size:11.8px;color:rgb(var(--tx2));margin-top:4px;line-height:1.5;}
  .pill{font-size:9.5px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;
    padding:2px 6px;border-radius:5px;}
  .pill.safe{background:rgba(var(--ok),.16);color:rgb(var(--ok));}
  .pill.risky{background:rgba(var(--warn),.16);color:rgb(var(--warn));}

  /* ---------- switch ---------- */
  .sw{
    position:relative;width:42px;height:24px;flex:none;border-radius:14px;cursor:pointer;
    background:rgba(255,255,255,.13);transition:background .22s ease;margin-top:2px;
  }
  .sw::after{
    content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;
    background:#fff;transition:transform .24s cubic-bezier(.3,1.4,.5,1);
    box-shadow:0 2px 5px rgba(0,0,0,.35);
  }
  .sw.on{background:linear-gradient(135deg,rgba(var(--acc),1),rgba(var(--acc),.7));
    box-shadow:0 0 14px rgba(var(--acc),.45);}
  .sw.on::after{transform:translateX(18px);}

  /* ---------- inputs ---------- */
  select,input[type=text],textarea{
    all:unset;background:rgb(var(--bg2));border:1px solid rgba(255,255,255,.09);
    border-radius:9px;padding:7px 10px;font-size:12.5px;color:rgb(var(--tx));
    min-width:150px;cursor:pointer;
  }
  select:focus,input:focus,textarea:focus{border-color:rgba(var(--acc),.6);}
  select option{background:#15161f;color:#eceef5;}
  textarea{width:100%;min-height:88px;font-family:ui-monospace,Menlo,Consolas,monospace;
    font-size:11.5px;cursor:text;resize:vertical;line-height:1.5;}
  input[type=color]{all:unset;width:38px;height:26px;border-radius:8px;cursor:pointer;
    border:1px solid rgba(255,255,255,.15);overflow:hidden;}
  input[type=range]{all:unset;width:150px;height:4px;border-radius:4px;cursor:pointer;
    background:linear-gradient(90deg,rgba(var(--acc),1) var(--pct,50%),rgba(255,255,255,.14) var(--pct,50%));}
  input[type=range]::-webkit-slider-thumb{
    -webkit-appearance:none;width:15px;height:15px;border-radius:50%;background:#fff;
    box-shadow:0 2px 6px rgba(0,0,0,.4);}
  .rangewrap{display:flex;align-items:center;gap:10px;}
  .rangewrap b{font-size:11.5px;color:rgb(var(--tx2));min-width:34px;text-align:right;}

  .btn{
    display:inline-flex;align-items:center;gap:7px;padding:8px 14px;border-radius:10px;
    font-size:12.5px;font-weight:600;cursor:pointer;user-select:none;
    background:rgba(255,255,255,.07);color:rgb(var(--tx));border:1px solid rgba(255,255,255,.08);
    transition:background .16s ease,transform .16s ease,border-color .16s ease;
  }
  .btn:hover{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.16);}
  .btn:active{transform:scale(.97);}
  .btn.pri{background:linear-gradient(135deg,rgba(var(--acc),1),rgba(var(--acc),.72));
    border-color:transparent;box-shadow:0 6px 18px rgba(var(--acc),.35);}
  .btn.pri:hover{filter:brightness(1.08);}
  .btn.danger{background:rgba(var(--bad),.14);color:rgb(var(--bad));border-color:rgba(var(--bad),.25);}
  .btn.danger:hover{background:rgba(var(--bad),.22);}
  .btn[disabled]{opacity:.45;pointer-events:none;}

  /* ---------- footer ---------- */
  footer{
    display:flex;align-items:center;gap:12px;padding:11px 20px;
    border-top:1px solid rgba(255,255,255,.06);background:rgb(var(--bg2));
    font-size:11.5px;color:rgb(var(--tx2));
  }
  footer .stat{display:flex;align-items:center;gap:6px;}
  footer .stat b{color:rgb(var(--tx));font-variant-numeric:tabular-nums;}
  .live{width:6px;height:6px;border-radius:50%;background:rgb(var(--ok));box-shadow:0 0 8px rgba(var(--ok),.8);}

  .by{display:flex;align-items:center;gap:6px;padding-left:12px;
    border-left:1px solid rgba(255,255,255,.09);}
  .by a{
    display:inline-flex;align-items:center;gap:5px;color:rgb(var(--tx2));
    text-decoration:none;font-weight:600;transition:color .15s ease;
  }
  .by a:hover{color:rgb(var(--acc));}
  .by svg{opacity:.85;}

  /* ---------- audit ---------- */
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:16px;}
  .card{
    padding:13px 14px;border-radius:13px;background:rgb(var(--card));
    border:1px solid rgba(255,255,255,.05);
  }
  .card .n{font-size:22px;font-weight:700;letter-spacing:-.5px;font-variant-numeric:tabular-nums;}
  .card .k{font-size:10.5px;color:rgb(var(--tx2));margin-top:3px;text-transform:uppercase;letter-spacing:.5px;}
  .card.good .n{color:rgb(var(--ok));}
  .card.bad .n{color:rgb(var(--bad));}

  .chips{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px;}
  .chip{
    padding:6px 12px;border-radius:20px;font-size:11.5px;font-weight:600;cursor:pointer;
    background:rgb(var(--card));border:1px solid rgba(255,255,255,.06);color:rgb(var(--tx2));
    transition:all .16s ease;
  }
  .chip:hover{color:rgb(var(--tx));border-color:rgba(255,255,255,.14);}
  .chip.sel{background:rgba(var(--acc),.18);color:rgb(var(--tx));border-color:rgba(var(--acc),.4);}

  .ulist{border:1px solid rgba(255,255,255,.06);border-radius:13px;overflow:hidden;}
  .urow{
    display:flex;align-items:center;gap:11px;padding:9px 13px;
    border-bottom:1px solid rgba(255,255,255,.04);transition:background .14s ease;
  }
  .urow:last-child{border-bottom:none;}
  .urow:hover{background:rgba(255,255,255,.035);}
  .urow img{width:32px;height:32px;border-radius:50%;flex:none;background:rgb(var(--bg2));object-fit:cover;}
  .urow .u{font-size:12.8px;font-weight:600;}
  .urow .f{font-size:11px;color:rgb(var(--tx2));margin-top:1px;}
  .urow a{color:rgb(var(--tx2));text-decoration:none;font-size:11.5px;margin-left:auto;
    padding:5px 10px;border-radius:8px;background:rgba(255,255,255,.06);}
  .urow a:hover{color:rgb(var(--tx));background:rgba(255,255,255,.12);}

  .empty{padding:36px 20px;text-align:center;color:rgb(var(--tx2));font-size:12.5px;line-height:1.7;}
  .bar{height:5px;border-radius:5px;background:rgba(255,255,255,.08);overflow:hidden;margin:12px 0;}
  .bar i{display:block;height:100%;width:30%;border-radius:5px;
    background:linear-gradient(90deg,rgba(var(--acc),1),rgba(var(--acc),.5));
    animation:slide 1.3s ease-in-out infinite;}
  @keyframes slide{0%{transform:translateX(-100%);}100%{transform:translateX(400%);}}

  .note{
    padding:11px 13px;border-radius:11px;font-size:11.8px;line-height:1.6;margin-bottom:14px;
    background:rgba(var(--warn),.09);border:1px solid rgba(var(--warn),.22);color:rgb(var(--tx));
  }
  .note b{color:rgb(var(--warn));}
  .note.info{background:rgba(var(--acc),.09);border-color:rgba(var(--acc),.22);}
  .note.info b{color:rgb(var(--acc));}
  `;

  /* ================================================================== *
   * build
   * ================================================================== */
  var REPO = 'https://github.com/ANSHUL-REAL/instaghost';

  var GH_MARK = '<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">' +
    '<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 ' +
    '0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53' +
    '.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 ' +
    '0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27' +
    'c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95' +
    '.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>';

  function svgIcon(d) {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round"><' + d + '></svg>';
  }

  P.build = function () {
    if (host || !document.body) return;
    host = document.createElement('div');
    host.id = 'igx-root';
    host.style.cssText = 'all:initial;position:fixed;z-index:2147483000;';
    root = host.attachShadow({ mode: 'open' });

    var style = document.createElement('style');
    style.textContent = CSS;
    root.appendChild(style);

    /* launcher */
    ui.launch = document.createElement('div');
    ui.launch.className = 'launch';
    ui.launch.innerHTML = '<span class="dot"></span><span>InstaGhost</span>';
    ui.launch.addEventListener('click', P.open);
    root.appendChild(ui.launch);

    /* overlay + panel */
    ui.overlay = document.createElement('div');
    ui.overlay.className = 'overlay';
    ui.overlay.innerHTML =
      '<div class="panel">' +
        '<header>' +
          '<div class="brand">' +
            '<div class="glyph">👻</div>' +
            '<div><h1>InstaGhost</h1><p class="sub">Private layer for Instagram</p></div>' +
          '</div>' +
          '<div class="grow"></div>' +
          '<div class="search">' +
            svgIcon('circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"') +
            '<input type="text" placeholder="Search settings…" />' +
          '</div>' +
          '<div class="master"><span>OFF</span><div class="sw" data-master></div></div>' +
          '<div class="x">×</div>' +
        '</header>' +
        '<div class="body"><nav></nav><main></main></div>' +
        '<footer>' +
          '<span class="live"></span>' +
          '<span class="stat">Blocked this session <b class="blk">0</b></span>' +
          '<span class="stat">Dislikes <b class="dis">0</b></span>' +
          '<span class="by">Made by ' +
            '<a href="https://github.com/ANSHUL-REAL" target="_blank" rel="noopener noreferrer">Anshul</a>' +
            '<a href="' + REPO + '" target="_blank" rel="noopener noreferrer" title="InstaGhost on GitHub">' +
              GH_MARK + 'GitHub</a>' +
          '</span>' +
          '<div class="grow"></div>' +
          '<div class="btn danger" data-reset>Reset everything</div>' +
        '</footer>' +
      '</div>';
    root.appendChild(ui.overlay);

    ui.nav = root.querySelector('nav');
    ui.main = root.querySelector('main');
    ui.masterSw = root.querySelector('[data-master]');
    ui.masterBox = root.querySelector('.master');
    ui.blk = root.querySelector('.blk');
    ui.dis = root.querySelector('.dis');
    ui.searchInput = root.querySelector('.search input');

    root.querySelector('.x').addEventListener('click', P.close);
    ui.overlay.addEventListener('click', function (e) { if (e.target === ui.overlay) P.close(); });
    ui.masterSw.addEventListener('click', function () {
      IGX.set('enabled', !IGX.settings.enabled);
      P.sync();
    });
    root.querySelector('[data-reset]').addEventListener('click', function () {
      if (!confirm('Reset InstaGhost?\n\nThis clears every setting, all dislikes and all follower snapshots, and returns Instagram to stock. Cannot be undone.')) return;
      CFG.resetAll(function () {
        IGX.toast('InstaGhost reset. Reloading…', 'ok');
        setTimeout(function () { location.reload(); }, 700);
      });
    });
    ui.searchInput.addEventListener('input', function () {
      query = this.value.trim().toLowerCase();
      renderMain();
    });

    document.body.appendChild(host);
    renderNav();
    renderMain();
    P.sync();
  };

  /* ================================================================== *
   * nav
   * ================================================================== */
  function renderNav() {
    ui.nav.innerHTML = '';
    CFG.GROUPS.forEach(function (g) {
      var item = document.createElement('div');
      item.className = 'navitem' + (g.id === currentTab ? ' sel' : '');
      var on = CFG.SCHEMA.filter(function (s) {
        return s.group === g.id && s.def !== undefined && typeof s.def === 'boolean' && IGX.settings[s.key];
      }).length;
      item.innerHTML = '<span class="ic">' + g.icon + '</span><span>' + g.label + '</span>' +
        (on ? '<span class="cnt">' + on + '</span>' : '');
      item.addEventListener('click', function () {
        currentTab = g.id;
        query = '';
        ui.searchInput.value = '';
        renderNav();
        renderMain();
      });
      ui.nav.appendChild(item);
    });
  }

  /* ================================================================== *
   * settings rows
   * ================================================================== */
  function rowFor(def) {
    var s = IGX.settings;
    var row = document.createElement('div');
    row.className = 'row';

    var badge = def.safe ? '<span class="pill safe">safe</span>'
      : def.risky ? '<span class="pill risky">aggressive</span>' : '';

    var info = document.createElement('div');
    info.className = 'info';
    info.innerHTML = '<div class="lbl">' + def.label + badge + '</div>' +
                     '<div class="hint">' + def.hint + '</div>';
    row.appendChild(info);

    var type = def.type || 'bool';

    if (type === 'bool') {
      var sw = document.createElement('div');
      sw.className = 'sw' + (s[def.key] ? ' on' : '');
      sw.addEventListener('click', function () {
        var v = !IGX.settings[def.key];
        sw.classList.toggle('on', v);
        IGX.set(def.key, v);
        renderNav();
      });
      row.appendChild(sw);

    } else if (type === 'select') {
      var sel = document.createElement('select');
      def.options.forEach(function (o) {
        var op = document.createElement('option');
        op.value = o.value; op.textContent = o.label;
        if (String(s[def.key]) === String(o.value)) op.selected = true;
        sel.appendChild(op);
      });
      sel.addEventListener('change', function () { IGX.set(def.key, sel.value); });
      row.appendChild(sel);

    } else if (type === 'color') {
      var c = document.createElement('input');
      c.type = 'color'; c.value = s[def.key] || '#7C5CFF';
      c.addEventListener('input', function () {
        IGX.set(def.key, c.value);
        applyAccent();
      });
      row.appendChild(c);

    } else if (type === 'range') {
      var wrap = document.createElement('div');
      wrap.className = 'rangewrap';
      var r = document.createElement('input');
      r.type = 'range'; r.min = def.min; r.max = def.max; r.step = def.step;
      r.value = s[def.key];
      var b = document.createElement('b');
      b.textContent = r.value;
      function pct() {
        r.style.setProperty('--pct', ((r.value - def.min) / (def.max - def.min) * 100) + '%');
      }
      pct();
      r.addEventListener('input', function () { b.textContent = r.value; pct(); IGX.set(def.key, r.value); });
      wrap.appendChild(r); wrap.appendChild(b);
      row.appendChild(wrap);

    } else if (type === 'textarea') {
      row.style.flexDirection = 'column';
      row.style.alignItems = 'stretch';
      var ta = document.createElement('textarea');
      ta.value = s[def.key] || '';
      ta.placeholder = 'article { border: 1px solid magenta; }';
      var t;
      ta.addEventListener('input', function () {
        clearTimeout(t);
        t = setTimeout(function () { IGX.set(def.key, ta.value); }, 420);
      });
      row.appendChild(ta);
    }

    return row;
  }

  /* ================================================================== *
   * main
   * ================================================================== */
  function renderMain() {
    ui.main.innerHTML = '';

    if (query) {
      var hits = CFG.SCHEMA.filter(function (d) {
        return d.group !== 'master' &&
          ((d.label + ' ' + d.hint).toLowerCase().indexOf(query) !== -1);
      });
      head('Search', '🔍', hits.length + ' setting' + (hits.length === 1 ? '' : 's') + ' matching "' + query + '"');
      if (!hits.length) ui.main.appendChild(el('div', 'empty', 'Nothing matched. Try “story”, “blur”, “download”…'));
      hits.forEach(function (d) { ui.main.appendChild(rowFor(d)); });
      return;
    }

    var g = CFG.GROUPS.filter(function (x) { return x.id === currentTab; })[0];
    head(g.label, g.icon, g.blurb);

    if (currentTab === 'ghost') {
      note('info', '<b>How this works.</b> These block the outbound request itself, so Instagram is never told. They cannot un-tell it — anything you viewed before switching them on is already recorded.');
    }
    if (currentTab === 'counts') {
      note('info', '<b>Blurred, not deleted.</b> Every number below stays on the page — hover it to read it.');
    }
    if (currentTab === 'audit') { renderAudit(); return; }

    if (currentTab === 'vault') {
      note('warn', '<b>Worth a thought first.</b> This only ever keeps messages that were already delivered to you — ' +
        'nothing is fetched, and nothing leaves this machine. But someone unsending a message is them changing their ' +
        'mind, and this quietly overrides that. It is off by default on purpose.');
    }

    CFG.SCHEMA.filter(function (d) { return d.group === currentTab; })
      .forEach(function (d) { ui.main.appendChild(rowFor(d)); });

    if (currentTab === 'tools') renderDislikeManager();
    if (currentTab === 'ghost') renderActivityNote();
    if (currentTab === 'plus') renderPlusActions();
    if (currentTab === 'vault') renderVault();
  }

  /* ---- page actions for the Beyond Insta+ tab ---- */
  function renderPlusActions() {
    var route = IGX.route();
    var where = {
      profile: 'this profile grid', home: 'your feed', explore: 'Explore',
      post: 'this post', reel: 'the loaded reels', story: 'this story', dm: 'this conversation'
    }[route] || 'this page';

    var box = document.createElement('div');
    box.className = 'row';
    box.innerHTML = '<div class="info"><div class="lbl">Bulk actions</div>' +
      '<div class="hint">Acts on what is loaded right now — currently ' + where + '. ' +
      'Scroll further first to catch more.</div></div>';

    var bulk = el('div', 'btn pri', 'Download everything loaded');
    bulk.addEventListener('click', function () { P.close(); setTimeout(IGX.plus.bulk, 250); });
    box.appendChild(bulk);

    if (route === 'dm') {
      var dm = el('div', 'btn', 'Save this chat');
      dm.addEventListener('click', function () { P.close(); setTimeout(IGX.plus.dmGrab, 250); });
      box.appendChild(dm);
    }
    ui.main.appendChild(box);

    note('info', '<b>Things a modded phone app cannot do.</b> Picture-in-picture keeps a reel floating over ' +
      'every other tab. Alt-click copies any text on the page. Bulk download saves a whole grid in one go ' +
      'rather than one post at a time.');
  }

  /* ---- unsend vault ---- */
  function renderVault() {
    var list = IGX.vault.all();

    var bar = document.createElement('div');
    bar.style.cssText = 'display:flex;gap:9px;flex-wrap:wrap;margin:14px 0;';
    if (list.length) {
      var ex = el('div', 'btn', 'Export as text');
      ex.addEventListener('click', function () { IGX.vault.export(); });
      bar.appendChild(ex);
      var cl = el('div', 'btn danger', 'Clear the vault');
      cl.addEventListener('click', function () {
        if (!confirm('Delete every archived and unsent message? This cannot be undone.')) return;
        IGX.vault.clear();
        renderMain();
        P.sync();
      });
      bar.appendChild(cl);
      ui.main.appendChild(bar);
    }

    if (!list.length) {
      ui.main.appendChild(el('div', 'empty', IGX.settings.vaultEnabled
        ? 'Nothing unsent yet. Open your DMs and leave this running — anything taken back from here on lands in this list.'
        : 'The vault is off. Turn it on above and messages will be archived as they arrive.'));
      return;
    }

    var box = document.createElement('div');
    box.className = 'ulist';
    list.slice(0, 200).forEach(function (u) {
      var r = document.createElement('div');
      r.className = 'urow';
      r.style.alignItems = 'flex-start';
      var when = u.ts ? IGX.stamp(u.ts * 1000) : 'unknown time';
      var body = u.text
        ? escapeHtml(u.text)
        : '<i style="opacity:.6">' + escapeHtml(u.type || 'media') + ' — no text</i>';

      r.innerHTML =
        '<div style="flex:1;min-width:0">' +
          '<div class="u">@' + escapeHtml(u.from || 'unknown') +
            (u.title ? ' <span style="opacity:.5;font-weight:400">· ' + escapeHtml(u.title) + '</span>' : '') +
          '</div>' +
          '<div style="font-size:12.5px;margin:4px 0 3px;line-height:1.5;word-break:break-word">' + body + '</div>' +
          '<div class="f">sent ' + when + ' · unsent ' + IGX.stamp(u.noticed) + '</div>' +
        '</div>';

      if (u.media) {
        var open = el('a', '', 'Media');
        open.href = u.media;
        open.target = '_blank';
        open.rel = 'noopener noreferrer';
        r.appendChild(open);
      }
      var x = el('a', '', 'Forget');
      x.href = 'javascript:void 0';
      x.addEventListener('click', function (e) {
        e.preventDefault();
        IGX.vault.forget(u.id);
        renderMain();
      });
      r.appendChild(x);
      box.appendChild(r);
    });
    ui.main.appendChild(box);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function head(title, icon, blurb) {
    var h = document.createElement('div');
    h.className = 'tabhead';
    h.innerHTML = '<h2><span>' + icon + '</span>' + title + '</h2><p>' + blurb + '</p>';
    ui.main.appendChild(h);
  }

  function note(kind, html) {
    var n = document.createElement('div');
    n.className = 'note' + (kind === 'info' ? ' info' : '');
    n.innerHTML = html;
    ui.main.appendChild(n);
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  function renderActivityNote() {
    note('warn', '<b>One honest limit.</b> Your own green dot is a server-side account setting — no extension can fake it. ' +
      'Turn it off for real in Settings → Messages and story replies → Show activity status. ' +
      '<a href="https://www.instagram.com/accounts/activity_status/" target="_blank" style="color:rgb(var(--acc))">Open that page →</a>');
  }

  function renderDislikeManager() {
    var wrap = document.createElement('div');
    wrap.className = 'row';
    var n = IGX.dislike.count();
    wrap.innerHTML = '<div class="info"><div class="lbl">Disliked posts</div>' +
      '<div class="hint">' + (n ? n + ' post' + (n === 1 ? '' : 's') + ' hidden or blurred for you only.' :
        'Nothing disliked yet. Hit the 👎 next to any Like button.') + '</div></div>';
    if (n) {
      var b = el('div', 'btn danger', 'Clear all');
      b.addEventListener('click', function () {
        IGX.dislike.clear();
        IGX.toast('Dislikes cleared', 'ok');
        renderMain();
        P.sync();
      });
      wrap.appendChild(b);
    }
    ui.main.appendChild(wrap);
  }

  /* ================================================================== *
   * follower audit tab
   * ================================================================== */
  var auditState = { snap: null, prev: null, analysis: null, view: 'notFollowingBack', busy: false, msg: '' };

  function renderAudit() {
    CFG.SCHEMA.filter(function (d) { return d.group === 'audit'; })
      .forEach(function (d) { ui.main.appendChild(rowFor(d)); });

    note('warn', '<b>Use sparingly.</b> A scan walks your follower and following lists page by page through Instagram\'s own API. ' +
      'That is the part most likely to trip a rate limit, so run it once a day at most — not once an hour.');

    var bar = document.createElement('div');
    bar.style.cssText = 'display:flex;gap:9px;flex-wrap:wrap;margin-bottom:16px;';

    var scanBtn = el('div', 'btn pri', auditState.busy ? 'Scanning…' : 'Run a scan');
    scanBtn.addEventListener('click', function () {
      if (auditState.busy) return;
      runScan();
    });
    bar.appendChild(scanBtn);

    if (auditState.busy) {
      var stop = el('div', 'btn danger', 'Stop');
      stop.addEventListener('click', function () { IGX.audit.stop(); auditState.msg = 'Stopping…'; renderAudit2(); });
      bar.appendChild(stop);
    }

    if (auditState.analysis) {
      var csv = el('div', 'btn', 'Export list as CSV');
      csv.addEventListener('click', function () {
        IGX.audit.exportCsv(currentList(), 'instaghost-' + auditState.view);
      });
      bar.appendChild(csv);

      var json = el('div', 'btn', 'Export snapshot as JSON');
      json.addEventListener('click', function () {
        IGX.audit.exportJson(auditState.snap, 'instaghost-snapshot');
      });
      bar.appendChild(json);
    }
    ui.main.appendChild(bar);

    if (auditState.busy) {
      var b2 = document.createElement('div');
      b2.className = 'bar';
      b2.innerHTML = '<i></i>';
      ui.main.appendChild(b2);
    }
    if (auditState.msg) {
      var m = el('div', 'scanmsg', auditState.msg);
      m.style.cssText = 'font-size:12px;color:rgb(var(--tx2));margin-bottom:14px;';
      ui.main.appendChild(m);
    }

    if (!auditState.analysis) {
      ui.main.appendChild(el('div', 'empty',
        'No snapshot yet. Run a scan and InstaGhost will work out who never followed you back, ' +
        'who follows you unreciprocated, and — from the second scan onward — exactly who dropped you.'));
      return;
    }

    var a = auditState.analysis;
    var cards = document.createElement('div');
    cards.className = 'cards';
    [
      ['followers', a.counts.followers, ''],
      ['following', a.counts.following, ''],
      ['mutual', a.counts.mutuals, ''],
      ['don\'t follow back', a.counts.notFollowingBack, 'bad'],
      ['you don\'t follow back', a.counts.fans, ''],
      ['unfollowed you', a.lostFollowers.length, 'bad'],
      ['new followers', a.gainedFollowers.length, 'good']
    ].forEach(function (c) {
      var card = document.createElement('div');
      card.className = 'card ' + (c[2] || '');
      card.innerHTML = '<div class="n">' + IGX.fmt(c[1]) + '</div><div class="k">' + c[0] + '</div>';
      cards.appendChild(card);
    });
    ui.main.appendChild(cards);

    var chips = document.createElement('div');
    chips.className = 'chips';
    [
      ['notFollowingBack', 'Not following back'],
      ['fans', 'You don\'t follow back'],
      ['mutuals', 'Mutuals'],
      ['lostFollowers', 'Unfollowed you'],
      ['gainedFollowers', 'New followers'],
      ['youUnfollowed', 'You unfollowed'],
      ['churn', 'Followed then left']
    ].forEach(function (c) {
      var chip = el('div', 'chip' + (auditState.view === c[0] ? ' sel' : ''), c[1]);
      chip.addEventListener('click', function () { auditState.view = c[0]; renderAudit2(); });
      chips.appendChild(chip);
    });
    ui.main.appendChild(chips);

    if (!a.hasPrev && ['lostFollowers', 'gainedFollowers', 'youUnfollowed', 'churn'].indexOf(auditState.view) !== -1) {
      ui.main.appendChild(el('div', 'empty',
        'Needs two scans to compare. This one is your baseline — run another later and the differences appear here.'));
      return;
    }

    var list = currentList();
    if (!list.length) {
      ui.main.appendChild(el('div', 'empty', 'Empty — nothing in this category.'));
      return;
    }

    var box = document.createElement('div');
    box.className = 'ulist';
    list.slice(0, 400).forEach(function (u) {
      /* Display names are attacker-controlled text. This panel lives in the
       * isolated world, so an <img onerror> smuggled through a full_name would
       * execute with chrome.* in reach — escape everything. */
      var r = document.createElement('div');
      r.className = 'urow';
      var safeName = escapeHtml(u.username || '');
      r.innerHTML =
        '<img src="' + escapeHtml(u.pic || '') + '" loading="lazy" referrerpolicy="no-referrer" />' +
        '<div><div class="u">@' + safeName + (u.ver ? ' ✓' : '') + '</div>' +
        '<div class="f">' + escapeHtml(u.full_name || (u.priv ? 'private account' : '')) + '</div></div>' +
        '<a href="https://www.instagram.com/' + encodeURIComponent(u.username || '') + '/" ' +
        'target="_blank" rel="noopener noreferrer">Open</a>';
      box.appendChild(r);
    });
    ui.main.appendChild(box);

    if (list.length > 400) {
      ui.main.appendChild(el('div', 'empty', 'Showing the first 400 of ' + IGX.fmt(list.length) + '. Export as CSV for the rest.'));
    }
    ui.main.appendChild(el('div', 'empty', 'Snapshot taken ' + IGX.stamp(a.ts) +
      (a.hasPrev ? ' · compared against ' + IGX.stamp(a.prevTs) : '')));
  }

  function renderAudit2() { ui.main.innerHTML = ''; head('Followers', '📊', 'Who dropped you, who never followed back.'); renderAudit(); }

  function currentList() {
    var a = auditState.analysis;
    if (!a) return [];
    if (auditState.view === 'churn') return (auditState.churn || []).map(function (c) { return c.user; });
    return a[auditState.view] || [];
  }

  function runScan() {
    auditState.busy = true;
    auditState.msg = 'Starting…';
    renderAudit2();

    IGX.audit.scan(function (p) {
      auditState.msg = (p.throttled ? '⚠️ Instagram is throttling — waiting it out. ' : '') +
        'Fetched ' + IGX.fmt(p.count) + ' ' + p.kind + ' (page ' + p.page + ')…';
      var line = ui.main.querySelector('.scanmsg');
      if (line) line.textContent = auditState.msg;
    }).then(function (res) {
      auditState.busy = false;
      if (!res || res.error) {
        auditState.msg = '❌ ' + ((res && res.error) || 'Scan failed.');
        renderAudit2();
        return;
      }
      if (res.aborted && !res.followers) { auditState.msg = 'Scan stopped.'; renderAudit2(); return; }

      IGX.audit.snapshots().then(function (snaps) {
        auditState.snap = snaps[snaps.length - 1] || res;
        auditState.prev = snaps.length > 1 ? snaps[snaps.length - 2] : null;
        auditState.analysis = IGX.audit.analyse(auditState.snap, auditState.prev);
        auditState.churn = IGX.audit.churn(snaps);
        auditState.msg = '✅ Done — ' + IGX.fmt(auditState.snap.followers.length) + ' followers, ' +
          IGX.fmt(auditState.snap.following.length) + ' following.';
        renderAudit2();
      });
    });
  }

  /* Load the newest stored snapshot when the tab is first opened. */
  function primeAudit() {
    IGX.audit.snapshots().then(function (snaps) {
      if (!snaps.length) return;
      auditState.snap = snaps[snaps.length - 1];
      auditState.prev = snaps.length > 1 ? snaps[snaps.length - 2] : null;
      auditState.analysis = IGX.audit.analyse(auditState.snap, auditState.prev);
      auditState.churn = IGX.audit.churn(snaps);
      if (currentTab === 'audit') renderAudit2();
    });
  }

  /* ================================================================== *
   * public
   * ================================================================== */
  var lastAccent = null;
  function applyAccent() {
    if (!root) return;
    var acc = IGX.hexToRgb(IGX.settings.accent);
    if (acc === lastAccent) return;
    lastAccent = acc;
    root.querySelector('style').textContent = CSS.replace('--acc:124,92,255;', '--acc:' + acc + ';');
  }

  P.sync = function () {
    if (!root) return;
    var on = !!IGX.settings.enabled;
    ui.masterSw.classList.toggle('on', on);
    ui.masterBox.classList.toggle('on', on);
    ui.masterBox.querySelector('span').textContent = on ? 'ON' : 'OFF';
    ui.launch.classList.toggle('off', !on);
    ui.blk.textContent = IGX.fmt(IGX.blockedCount);
    ui.dis.textContent = IGX.fmt(IGX.dislike.count());
    applyAccent();
  };

  P.open = function () {
    P.build();
    if (!ui.overlay) return;
    ui.overlay.classList.add('open');
    P.sync();
    renderNav();
    renderMain();
    setTimeout(function () { ui.searchInput.focus(); }, 120);
  };

  P.close = function () { if (ui.overlay) ui.overlay.classList.remove('open'); };

  P.toggle = function () {
    if (ui.overlay && ui.overlay.classList.contains('open')) P.close();
    else P.open();
  };

  P.init = function () {
    P.build();
    primeAudit();
    IGX.on('blocked', function () {
      if (ui.blk) ui.blk.textContent = IGX.fmt(IGX.blockedCount);
    });
    IGX.on('settings', function () { P.sync(); if (ui.overlay && ui.overlay.classList.contains('open')) renderNav(); });
  };

  /* keyboard */
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.shiftKey && (e.key === 'G' || e.key === 'g')) { e.preventDefault(); P.toggle(); }
    if (e.key === 'Escape' && ui.overlay && ui.overlay.classList.contains('open')) P.close();
  }, true);

  /* popup → panel */
  chrome.runtime.onMessage.addListener(function (msg) {
    if (msg && msg.type === 'igx:open-panel') P.open();
  });
})();
