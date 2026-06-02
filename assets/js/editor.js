import {EditorState, EditorView, basicSetup} from "codemirror/";
import {javascript} from "codemirror/lang-javascript";
import {cpp} from "https://esm.sh/@codemirror/lang-cpp@6.1.0";
import {python} from "https://esm.sh/@codemirror/lang-python@6.1.1";

export default function(container){
  let onChangeCb = ()=>{};
  const view = new EditorView({
    state: EditorState.create({
      doc: '',
      extensions: [basicSetup, javascript()]
    }),
    parent: container
  });
  function setModeByName(name){
    let ext = javascript();
    if(name.match(/\\.py$/) || name==='python') ext = python();
    if(name.match(/\\.(ino|cpp|c)$/) || name==='cpp') ext = cpp();
    view.dispatch({effects: EditorState.reconfigure.of([basicSetup, ext])});
  }
  return {
    setValue(txt){ view.dispatch({changes:{from:0,to:view.state.doc.length,insert:txt}}); },
    getValue(){ return view.state.doc.toString(); },
    onChange(cb){
      onChangeCb = cb;
      view.dispatch({effects: EditorState.reconfigure.of([basicSetup, view.state.facet])});
      view.updateListener = (u)=>{ if(u.docChanged) onChangeCb(view.state.doc.toString()); };
      // Fallback event listener
      view.dom.addEventListener('input', ()=> onChangeCb(view.state.doc.toString()));
    },
    setMode(name){ setModeByName(name); }
  };
}