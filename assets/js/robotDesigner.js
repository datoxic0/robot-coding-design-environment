let robot = {parts:[], meta:{tick:0}};
let canvas = null;
let ctx = null;
let dragPart = null;
let offset = {x:0,y:0};
let selected = null;
let playing = false;
let lastFrame = 0;
let speed = 1.0; // multiplier for animation speed

// Initialization is deferred until DOM ready to avoid null element errors when module is imported
function initDesigner(){
  // guard: only initialize once
  if(canvas) return;
  canvas = document.getElementById('designer-canvas');
  if(!canvas) return;
  ctx = canvas.getContext('2d');

  // Resize canvas for crispness on HiDPI screens
  function resizeCanvas(){
    const r = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || canvas.width;
    const h = canvas.clientHeight || canvas.height;
    canvas.width = w * r;
    canvas.height = h * r;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    if(ctx && ctx.setTransform) ctx.setTransform(r,0,0,r,0,0);
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  function drawGrid(){
    if(!ctx) return;
    ctx.save();
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    const step = 20;
    for(let x=0;x<canvas.width;x+=step){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke(); }
    for(let y=0;y<canvas.height;y+=step){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke(); }
    ctx.restore();
  }

  function draw(){
    if(!ctx) return;
    drawGrid();
    // parts (draw in order)
    robot.parts.forEach((p, idx)=>{
      ctx.save();
      ctx.translate(p.x, p.y);
      // subtle shadow
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 6;
      // highlight selected
      if(selected && selected.id === p.id){
        ctx.strokeStyle = '#ffd27f';
        ctx.lineWidth = 2;
      } else {
        ctx.strokeStyle = '#063a57';
        ctx.lineWidth = 1;
      }
      ctx.fillStyle = '#0f8fc7';
      // draw with simple animation for certain types
      if(p.type === 'wheel'){
        const rot = (robot.meta.tick * 0.12 * (p.speed||1) * speed) % (Math.PI*2);
        ctx.rotate(rot);
        ctx.beginPath(); ctx.arc(0,0,(p.w||16),0,Math.PI*2); ctx.fill(); ctx.stroke();
        // hub
        ctx.fillStyle = '#063a57';
        ctx.beginPath(); ctx.arc(0,0,(p.w||16)*0.35,0,Math.PI*2); ctx.fill();
      } else if(p.type === 'base'){
        ctx.fillStyle = '#0f8fc7';
        ctx.fillRect(-40,-10,80,20); ctx.strokeRect(-40,-10,80,20);
      } else if(p.type === 'arm'){
        // arms pivot around top; animate slight rotation
        const sway = Math.sin(robot.meta.tick * 0.03 + (idx*0.5)) * 0.25 * (p.swing||1) * speed;
        ctx.rotate(sway);
        ctx.fillRect(-6,-30,12,60); ctx.strokeRect(-6,-30,12,60);
        // gripper hint if attached
        ctx.fillStyle = '#063a57';
        ctx.fillRect(-6,28,12,6);
      } else if(p.type === 'servo'){
        const angle = Math.sin(robot.meta.tick * 0.04 + idx) * 0.8 * (p.range||1) * speed;
        ctx.rotate(angle);
        ctx.beginPath(); ctx.rect(-12,-8,24,16); ctx.fill(); ctx.stroke();
      } else if(p.type === 'gripper'){
        ctx.fillRect(-12,-4,24,8); ctx.strokeRect(-12,-4,24,8);
      } else if(p.type === 'sensor'){
        // sensor pulses
        const pulse = (Math.sin(robot.meta.tick * 0.06 + idx) + 1) * 0.5;
        ctx.beginPath(); ctx.arc(0,0,8 + pulse*4,0,Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#9fffbf';
        ctx.beginPath(); ctx.arc(0,0,3,0,Math.PI*2); ctx.fill();
      } else {
        // fallback
        ctx.fillRect(-8,-8,16,16); ctx.strokeRect(-8,-8,16,16);
      }
      // selection ring
      if(selected && selected.id === p.id){
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255,210,127,0.25)';
        ctx.lineWidth = 3;
        ctx.arc(0,0, (p.w||24)+8, 0, Math.PI*2);
        ctx.stroke();
      }
      ctx.restore();
    });
  }

  // add part with some sensible defaults for animation
  function addPart(type, x=100, y=100){
    const base = {id:Date.now()+Math.random(), type, x, y};
    if(type==='wheel'){ base.w = 18; base.speed = 1; }
    if(type==='arm'){ base.swing = 1; }
    if(type==='servo'){ base.range = 1; }
    if(type==='sensor'){ base.range = 1; }
    robot.parts.push(base);
    draw();
  }

  // Pointer handling (supports mouse & touch via pointer events)
  canvas.addEventListener('pointerdown', (e)=>{
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left);
    const y = (e.clientY - rect.top);
    const p = getAt(x, y);
    if(p){
      dragPart = p;
      selected = p;
      offset.x = x - p.x;
      offset.y = y - p.y;
      try{ canvas.setPointerCapture(e.pointerId); }catch(_) {}
      draw();
    } else {
      selected = null;
      draw();
    }
  });
  canvas.addEventListener('pointermove', (e)=>{
    if(!dragPart) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left);
    const y = (e.clientY - rect.top);
    dragPart.x = x - offset.x;
    dragPart.y = y - offset.y;
    draw();
  });
  canvas.addEventListener('pointerup', (e)=>{
    if(dragPart){ try{ canvas.releasePointerCapture(e.pointerId); }catch(e){} }
    dragPart = null;
  });

  // Hit test, improved: checks bounding boxes for base and distance for others
  function getAt(x,y){
    for(let i=robot.parts.length-1;i>=0;i--){
      const p = robot.parts[i];
      if(p.type==='base'){
        if(x > p.x - 40 && x < p.x + 40 && y > p.y - 10 && y < p.y + 10) return p;
      } else {
        const dx = p.x - x, dy = p.y - y;
        const r = p.w ? p.w + 8 : 24;
        if(Math.hypot(dx,dy) < r) return p;
      }
    }
    return null;
  }

  // Palette click -> add part (guard palette presence)
  const palette = document.getElementById('palette');
  if(palette){
    palette.addEventListener('click',(e)=>{
      const p = e.target.closest('.p-item'); if(!p) return; addPart(p.dataset.type, canvas.width*0.5/ (window.devicePixelRatio||1), canvas.height*0.4/ (window.devicePixelRatio||1));
    });
  }

  // Export/import are below (exportRobot/importRobot use robot and draw)

  // Animation loop and controls
  function stepAnimation(dt){
    robot.meta.tick += dt * 0.06 * speed;
    // simple collision-free visual interactions: wheels translate base slightly if attached
    // arms may sway (handled in draw)
  }

  function frame(ts){
    if(!lastFrame) lastFrame = ts;
    const dt = (ts - lastFrame) / 16.666; // ~frames
    lastFrame = ts;
    if(playing){
      stepAnimation(dt);
      draw();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Controls in DOM
  const simulateBtn = document.getElementById('simulate-kinematics');
  const playBtn = document.createElement('button');
  playBtn.textContent = 'Play';
  playBtn.style.marginRight = '6px';
  const stepBtn = document.createElement('button');
  stepBtn.textContent = 'Step';
  stepBtn.style.marginRight = '6px';
  const speedInput = document.createElement('input');
  speedInput.type = 'range';
  speedInput.min = '0.1'; speedInput.max = '3'; speedInput.step = '0.1'; speedInput.value = '1';
  speedInput.title = 'Animation speed';

  const controlsRoot = document.getElementById('designer-controls');
  if(controlsRoot){
    // clear existing and add enhanced controls
    controlsRoot.innerHTML = '';
    controlsRoot.appendChild(playBtn);
    controlsRoot.appendChild(stepBtn);
    const lbl = document.createElement('label'); lbl.style.color='#9aa6b2'; lbl.style.fontSize='12px'; lbl.style.display='flex'; lbl.style.alignItems='center'; lbl.style.gap='8px';
    lbl.textContent = 'Speed';
    lbl.appendChild(speedInput);
    controlsRoot.appendChild(lbl);
    const exportBtn = document.createElement('button'); exportBtn.id = 'export-robot'; exportBtn.textContent = 'Export JSON';
    const importBtn = document.createElement('button'); importBtn.id = 'import-robot'; importBtn.textContent = 'Import JSON';
    controlsRoot.appendChild(exportBtn);
    controlsRoot.appendChild(importBtn);
  }

  // play/pause toggle
  playBtn.onclick = ()=>{
    playing = !playing;
    playBtn.textContent = playing ? 'Pause' : 'Play';
    if(playing) lastFrame = performance.now();
  };

  // step executes one visual step
  stepBtn.onclick = ()=>{
    stepAnimation(1); // single step
    draw();
  };

  // speed control
  speedInput.addEventListener('input', (e)=>{ speed = parseFloat(e.target.value) || 1; });

  // keep existing simulate-kinematics as a one-shot animation trigger (for backward compatibility)
  if(simulateBtn){
    simulateBtn.onclick = ()=> {
      // small burst of motion: n ticks
      const burst = 40;
      const runBurst = (i)=>{
        if(i<=0) return;
        stepAnimation(1);
        draw();
        requestAnimationFrame(()=> runBurst(i-1));
      };
      runBurst(burst);
    };
  }

  // initial draw
  draw();
}

// ensure init runs after DOM is ready (safe no-op if elements missing)
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', initDesigner);
} else {
  setTimeout(initDesigner,0);
}

// Export/import
export function exportRobot(){ return JSON.stringify(robot, null, 2); }
export function importRobot(json){ try{ robot = JSON.parse(json); if(typeof draw === 'function') draw(); }catch(e){ alert('Invalid robot JSON'); } }