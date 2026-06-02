import {Runner} from './runner.js';

/* lightweight service worker registration for caching static assets (improves subsequent load times)
   Register with root scope and report status to console for easier debugging; fail silently but log. */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('./sw.js', import.meta.url).href, { scope: '/' })
      .then(reg => {
        console.info('ServiceWorker registered:', reg.scope);
      })
      .catch(err => {
        console.warn('ServiceWorker registration failed:', err);
      });
  });
}

// ----------------------------- Editor loader (lazy + robust) -----------------------------
let Editor;
try{
  Editor = (await import(new URL('./editor.js', import.meta.url).href)).default;
}catch(e){
  console.warn('Direct dynamic import failed for ./editor.js', e);
  try{
    const res = await fetch('./editor.js');
    if(res.ok){
      const src = await res.text();
      const blobUrl = URL.createObjectURL(new Blob([src], {type:'text/javascript'}));
      try{
        Editor = (await import(blobUrl)).default;
      }finally{
        URL.revokeObjectURL(blobUrl);
      }
    }else{
      throw new Error('Fetch returned ' + res.status);
    }
  }catch(fallbackErr){
    console.warn('Blob fallback failed, creating lightweight inline editor as fallback', fallbackErr);
    Editor = function(container){
      const ta = document.createElement('textarea');
      ta.style.width = '100%';
      ta.style.height = '100%';
      ta.style.background = 'transparent';
      ta.style.color = 'white';
      ta.style.border = 'none';
      ta.style.padding = '10px';
      ta.style.fontFamily = 'monospace';
      ta.style.fontSize = '13px';
      ta.wrap = 'off';
      container.innerHTML = '';
      container.appendChild(ta);
      let changeCb = ()=>{};
      ta.addEventListener('input', ()=> changeCb(ta.value));
      return {
        setValue(txt){ ta.value = txt; },
        getValue(){ return ta.value; },
        onChange(cb){ changeCb = cb; },
        setMode(name){ /* no-op for fallback */ }
      };
    };
  }
}

// ----------------------------- Persistent state & autosave -----------------------------
const STORAGE_KEY = 'robot-env-project-v1';
const state = {
  files: {},
  current: null,
  meta: { lastSaved: null }
};

function saveStateToStorage(){
  try{
    const snapshot = { files: state.files, current: state.current, meta: state.meta };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    smallLog('[storage] project saved');
  }catch(e){ smallLog('[storage] save failed', e.message); }
}
function loadStateFromStorage(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return false;
    const snap = JSON.parse(raw);
    if(snap && snap.files){
      state.files = snap.files;
      state.current = snap.current || Object.keys(state.files)[0];
      state.meta = snap.meta || state.meta;
      return true;
    }
  }catch(e){ console.warn('Failed to load state', e); }
  return false;
}

// Basic UI bindings
const fileList = document.getElementById('file-list');
const newFileBtn = document.getElementById('new-file');
const newProjectBtn = document.getElementById('new-project');
const saveBtn = document.getElementById('save-btn');
const buildBtn = document.getElementById('build-btn');
const uploadBtn = document.getElementById('upload-btn');
const runBtn = document.getElementById('run-btn');
const consoleEl = document.getElementById('console');
const templates = document.getElementById('templates');
const platformSelect = document.getElementById('platform-select');
const langSelect = document.getElementById('lang-select');
const boardSelect = document.getElementById('board-select');
const currentFileTitle = document.getElementById('current-file');

const runner = new Runner(smallLog);

// Keep the console trimmed to avoid runaway memory usage
function smallLog(...args){
  try{
    const line = args.join(' ');
    // append
    consoleEl.textContent += line + '\n';
    // trim to last ~2000 lines
    const lines = consoleEl.textContent.split('\n');
    if(lines.length > 2000){
      consoleEl.textContent = lines.slice(lines.length - 2000).join('\n');
    }
    consoleEl.scrollTop = consoleEl.scrollHeight;
  }catch(e){}
}

// Initialize with a starter project if none saved
function addFile(name, content=''){
  state.files[name] = {name, content};
  renderFileList();
  openFile(name);
  state.meta.lastSaved = Date.now();
  saveStateToStorage();
}
function renderFileList(){
  fileList.innerHTML = '';
  for(const name of Object.keys(state.files)){
    const el = document.createElement('div'); el.className='file';
    el.innerHTML = `<div>
      <div class="name">${name}</div>
      <small>${detectLanguage(name)}</small>
    </div><div><button class="open">Open</button><button class="del">×</button></div>`;
    el.querySelector('.open').onclick = ()=> openFile(name);
    el.querySelector('.del').onclick = ()=>{
      if(confirm('Delete '+name+' ?')){
        delete state.files[name];
        if(state.current === name) state.current = Object.keys(state.files)[0] || null;
        renderFileList();
        if(state.current) openFile(state.current);
        saveStateToStorage();
      }
    };
    fileList.appendChild(el);
  }
}
function detectLanguage(name){
  if(name.endsWith('.ino')||name.endsWith('.cpp')) return 'C/C++ (Arduino)';
  if(name.endsWith('.py')) return 'Python';
  if(name.endsWith('.js')) return 'JavaScript';
  return 'Text';
}

// Editor bridge
const editor = Editor(document.getElementById('editor'));
editor.onChange((txt)=> {
  if(state.current) state.files[state.current].content = txt;
});
function openFile(name){
  if(!state.files[name]) return;
  state.current = name;
  const content = state.files[name].content;
  editor.setValue(content||'');
  currentFileTitle.textContent = name;
  const indicator = document.getElementById('file-type-indicator');
  if(indicator) indicator.value = detectLanguage(name);
  // try to set mode for richer editor
  if(editor.setMode) editor.setMode(name);
  saveStateToStorage();
}

// Buttons
newFileBtn.onclick = ()=>{
  const name = `untitled${Object.keys(state.files).length+1}.ino`;
  addFile(name, `void setup(){\n  // setup\n}\n\nvoid loop(){\n  // loop\n}\n`);
};

// New Project: clear current project state and create a fresh starter set
newProjectBtn.onclick = ()=>{
  if(!confirm('Create a new project? This will clear the current project state (you can export first).')) return;
  // clear in-memory state and persistent storage
  state.files = {};
  state.current = null;
  state.meta = { lastSaved: Date.now() };
  try{ localStorage.removeItem(STORAGE_KEY); }catch(e){}
  // create a clean starter project
  addFile('README.md', '# New Robot Project\nStart by adding files or using templates.');
  addFile('main.ino', 'void setup(){}\nvoid loop(){}');
  smallLog('New project created.');
};
saveBtn.onclick = ()=>{
  if(!state.current) return;
  state.files[state.current].content = editor.getValue();
  state.meta.lastSaved = Date.now();
  saveStateToStorage();
  smallLog(`Saved ${state.current}`);
};
buildBtn.onclick = async ()=>{
  smallLog('Starting build...');
  const payload = {files: state.files, platform: platformSelect.value, language: langSelect.value, board: boardSelect.value};
  const res = await runner.build(payload);
  smallLog(res);
};
uploadBtn.onclick = async ()=>{
  smallLog('Preparing upload (simulated) ...');
  const res = await runner.upload({board: boardSelect.value});
  smallLog(res);
};
runBtn.onclick = async ()=>{
  smallLog('Running (simulated) ...');
  const res = await runner.run({language: langSelect.value, files: state.files});
  smallLog(res);
};

// Templates
templates.addEventListener('click', (e)=>{
  const btn = e.target.closest('.tpl');
  if(!btn) return;
  const lang = btn.dataset.lang;

  // Multi-file starter projects and richer realistic examples
  const projects = {
    'cpp': {
      files: {
        'main.ino': `// Motor control example (Arduino UNO)\n// Uses two digital pins to drive a simple H-bridge\nconst int pwmPin = 5;\nconst int dirPin = 4;\n\nvoid setup(){\n  pinMode(pwmPin, OUTPUT);\n  pinMode(dirPin, OUTPUT);\n  analogWrite(pwmPin, 0);\n}\n\nvoid loop(){\n  // forward\n  digitalWrite(dirPin, LOW);\n  for(int s=0;s<=200;s+=20){ analogWrite(pwmPin, s); delay(200); }\n  delay(500);\n  // reverse\n  digitalWrite(dirPin, HIGH);\n  for(int s=200;s>=0;s-=20){ analogWrite(pwmPin, s); delay(200); }\n  delay(500);\n}\n`,
        'README.md': `Arduino motor starter\n\nFiles:\n- main.ino : simple PWM motor control loop\n\nConnect motor driver PWM to pin 5 and direction to pin 4.\n`
      }
    },
    'python': {
      files: {
        'main.py': `# MicroPython: LED + button example for ESP32/ESP8266\nfrom machine import Pin\nimport time\n\nled = Pin(2, Pin.OUT)\nbtn = Pin(0, Pin.IN, Pin.PULL_UP)\n\nwhile True:\n    if not btn.value():\n        led.value(1)\n    else:\n        led.value(0)\n    time.sleep(0.05)\n`,
        'boot.py': `# boot file (optional)\nprint('Booting MicroPython project...')\n`
      }
    },
    'python3': {
      files: {
        'robot_sim.py': `# Python robot simulation (local). Simple simulated sensors and loop.\nimport time\n\nclass SimRobot:\n    def __init__(self):\n        self.pos = 0\n    def step(self):\n        self.pos += 1\n        print(f\"tick pos={self.pos}\")\n\nif __name__ == '__main__':\n    r = SimRobot()\n    print('Robot sim start')\n    for i in range(10):\n        r.step()\n        time.sleep(0.2)\n`,
        'README.md': `Python3 simulation project\nRun robot_sim.py with a local Python interpreter for a simple tick-based simulation.\n`
      }
    },
    'javascript': {
      files: {
        'index.js': `// Node-like example that logs simulated sensor data and uses a simple interval\nconsole.log('Node-style simulated environment');\nlet t = 0;\nsetInterval(()=>{\n  t++;\n  console.log('sim-sensor', {time:t, value: Math.round(Math.sin(t/3)*100)/100});\n  if(t>10) process && process.exit && process.exit(0);\n}, 500);\n`,
        'package.json': `{\n  \"name\": \"robot-sim\",\n  \"version\": \"0.0.0\",\n  \"main\": \"index.js\"\n}\n`
      }
    }
  };

  const project = projects[lang] || projects['python3'];
  // If single file project choose reasonable filename, else add multiple files
  for(const fname in project.files){
    addFile(fname, project.files[fname]);
  }
});

/* Import/Export simple robot JSON hooks delegated to robotDesigner
   Guarded attachments: designer creates buttons dynamically, so ensure elements exist before binding.
   If they are not present yet, a light MutationObserver will attach handlers once the designer injects them. */

function attachRobotIOHandlers(root=document){
  const exp = root.getElementById && root.getElementById('export-robot');
  const imp = root.getElementById && root.getElementById('import-robot');

  if(exp && !exp._bound){
    exp._bound = true;
    exp.onclick = ()=> {
      import('./robotDesigner.js').then(m=>{
        const json = m.exportRobot();
        const blob = new Blob([json], {type:'application/json'});
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download='robot.json'; a.click();
        setTimeout(()=> URL.revokeObjectURL(a.href), 2000);
      }).catch(err=> smallLog('[robotIO] export failed', err && err.message));
    };
  }

  if(imp && !imp._bound){
    imp._bound = true;
    imp.onclick = ()=> {
      const inp = document.createElement('input'); inp.type='file'; inp.accept='.json';
      inp.onchange = async (e)=>{
        const f = e.target.files[0]; if(!f) return;
        const txt = await f.text();
        import('./robotDesigner.js').then(m=> m.importRobot(txt)).catch(err=> smallLog('[robotIO] import failed', err && err.message));
      };
      inp.click();
    };
  }

  return !!(exp && imp);
}

// Try immediate attach (handles case buttons already exist)
if(!attachRobotIOHandlers()){
  // If buttons are created later by robotDesigner, observe designer-controls and attach once available
  const designerRoot = document.getElementById('designer-controls');
  if(designerRoot){
    const mo = new MutationObserver((mut)=>{
      if(attachRobotIOHandlers(designerRoot)){
        mo.disconnect();
      }
    });
    mo.observe(designerRoot, {childList:true, subtree:true});
  }
}

// Autosave and session persistence
let autosaveTimer = setInterval(()=>{
  // update current content then persist
  if(state.current && state.files[state.current]){
    state.files[state.current].content = editor.getValue();
  }
  state.meta.lastSaved = Date.now();
  saveStateToStorage();
}, 5000); // every 5s

window.addEventListener('beforeunload', ()=> {
  if(state.current && state.files[state.current]){
    state.files[state.current].content = editor.getValue();
  }
  state.meta.lastSaved = Date.now();
  saveStateToStorage();
});

// Restore or add starter content
const restored = loadStateFromStorage();
if(!restored || Object.keys(state.files).length === 0){
  addFile('README.md', '# Robot Project\nUse the templates to start.');
  addFile('main.ino', 'void setup(){}\nvoid loop(){}');
} else {
  // ensure UI reflects loaded files
  renderFileList();
  if(state.current) openFile(state.current);
}

smallLog('Environment ready. Session restored:', restored ? 'yes' : 'no');