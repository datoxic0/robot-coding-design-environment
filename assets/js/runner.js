export class Runner {
  constructor(logger){
    this.logger = logger;
    this._worker = null;
  }

  async build(payload){
    // keep lightweight simulated build checks
    this.logger('Build target:', payload.platform, payload.board, payload.language);
    await this._sleep(400);
    for(const n in payload.files){
      const txt = payload.files[n].content || '';
      if(n.endsWith('.py') && txt.includes('print(') && !txt.includes(')')){
        return 'Build failed: syntax error in ' + n;
      }
    }
    await this._sleep(300);
    return 'Build succeeded (simulated). Artifact: firmware.bin';
  }

  async upload(opts){
    this.logger('Flashing to', opts.board, '(simulated)');
    await this._sleep(600);
    return 'Upload completed (simulated).';
  }

  async run(opts){
    const language = opts.language;
    const files = opts.files || {};
    this.logger('Runner: launching execution language=', language);

    if(language === 'javascript' || language === 'node'){
      // Concatenate JS files in a safe order (index.js first if present)
      const order = Object.keys(files).sort((a,b)=>{
        if(a === 'index.js') return -1;
        if(b === 'index.js') return 1;
        return a.localeCompare(b);
      });
      let code = '';
      for(const name of order){
        code += `// file: ${name}\n` + (files[name].content || '') + '\n';
      }

      // Wrap console to forward logs to main thread
      const wrapped = `
        (function(){
          const origConsole = console;
          function send(type, args){
            try{ postMessage({type:'log', level:type, payload: args.map(a=>{ try{return JSON.stringify(a)}catch(e){return String(a)} }).join(' ') }); }catch(e){}
          }
          console.log = (...a)=> send('log', a);
          console.info = (...a)=> send('info', a);
          console.warn = (...a)=> send('warn', a);
          console.error = (...a)=> send('error', a);
          self.onmessage = (e)=> { if(e.data && e.data.cmd === 'stop'){ self.close(); } };
          // user code start
          try{
            ${code}
          }catch(err){
            postMessage({type:'error', payload: String(err && err.stack ? err.stack : err)});
          } finally {
            postMessage({type:'done'});
          }
        })();
      `;

      // Create worker from blob
      if(this._worker){
        try{ this._worker.terminate(); }catch(e){}
        this._worker = null;
      }
      const blob = new Blob([wrapped], {type:'application/javascript'});
      const url = URL.createObjectURL(blob);
      return await new Promise((resolve)=>{
        const worker = new Worker(url);
        this._worker = worker;
        const logs = [];
        const cleanup = ()=>{
          try{ worker.terminate(); }catch(e){}
          URL.revokeObjectURL(url);
          this._worker = null;
        };
        const timeout = setTimeout(()=>{
          logs.push('[runner] execution timeout, terminating.');
          cleanup();
          resolve(logs.join('\n'));
        }, 8000); // 8s safety timeout

        worker.onmessage = (ev)=>{
          const msg = ev.data || {};
          if(msg.type === 'log' || msg.type === 'info' || msg.type === 'warn' || msg.type === 'error'){
            const line = `[worker:${msg.level}] ${msg.payload}`;
            logs.push(line);
            this.logger(line);
          } else if(msg.type === 'error'){
            logs.push('[worker:error] ' + msg.payload);
            this.logger('[worker:error] ' + msg.payload);
          } else if(msg.type === 'done'){
            clearTimeout(timeout);
            cleanup();
            resolve(logs.join('\n') || 'Execution finished (worker).');
          }
        };
        worker.onerror = (err)=>{
          clearTimeout(timeout);
          logs.push('[worker] uncaught error: ' + err.message);
          this.logger('[worker] uncaught error: ' + err.message);
          cleanup();
          resolve(logs.join('\n'));
        };
      });
    }

    // Fallback simulated execution for other languages
    await this._sleep(200);
    let out = '';
    for(const n in files){
      if(n.endsWith('.py')) out += `[python:${n}] stdout: hello from ${n}\n`;
      if(n.endsWith('.ino')||n.endsWith('.cpp')) out += `[firmware:${n}] log: setup ok\n`;
    }
    return out || 'Execution finished (simulated).';
  }

  stop(){
    if(this._worker){
      try{ this._worker.terminate(); }catch(e){}
      this._worker = null;
      this.logger('Worker terminated.');
    }
  }

  _sleep(ms){ return new Promise(res=>setTimeout(res,ms)); }
}