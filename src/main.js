import './styles.css';
import { DX } from './dx.js';
import { uid, listVisitsByDate, upsertVisit, deleteVisit, listAllDates, clearDay, getSetting, setSetting, exportBackup, importBackup } from './db.js';
import { computeStats, isSurgicalDx, AGE_GROUPS, DISPOSITIONS } from './stats.js';
import { exportDayXlsx } from './excelExport.js';

const $ = (sel, el=document) => el.querySelector(sel);

const state = {
  tab: 'summary',
  date: toDateStr(new Date()),
  visits: [],
  editingId: null,
  doctorName: '',
};

function toDateStr(d){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function h(tag, attrs={}, ...kids){
  const el = document.createElement(tag);
  for(const [k,v] of Object.entries(attrs||{})){
    if(k==='class') el.className = v;
    else if(k==='html') el.innerHTML = v;
    else if(k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if(v !== null && v !== undefined) el.setAttribute(k, v);
  }
  for(const kid of kids){
    if(kid===null || kid===undefined) continue;
    if(typeof kid === 'string') el.appendChild(document.createTextNode(kid));
    else el.appendChild(kid);
  }
  return el;
}

async function load(){
  state.doctorName = await getSetting('doctorName','');
  await loadDay(state.date);
  render();
  registerSW();
}

async function loadDay(date){
  state.date = date;
  state.visits = await listVisitsByDate(date);
}

function registerSW(){
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }
}

function render(){
  const boot = document.getElementById('boot');
  if(boot) boot.style.display='none';
  const app = $('#app');
  app.innerHTML = '';
  app.appendChild(
    h('div',{class:'app'},
      topbar(),
      h('div',{class:'container'}, mainView()),
      nav()
    )
  );
}

function topbar(){
  const dateInput = h('input',{type:'date', value: state.date, onchange: async (e)=>{
    await loadDay(e.target.value);
    state.editingId = null;
    render();
  }});
  dateInput.style.color = '#fff';
  dateInput.style.fontWeight = '900';

  const todayBtn = h('button',{class:'chip', onclick: async ()=>{
    await loadDay(toDateStr(new Date()));
    state.editingId = null;
    render();
  }}, 'Today');

  const yBtn = h('button',{class:'chip', onclick: async ()=>{
    const d = new Date(); d.setDate(d.getDate()-1);
    await loadDay(toDateStr(d));
    state.editingId = null;
    render();
  }}, 'Yesterday');

  return h('div',{class:'topbar'},
    h('div',{class:'topbar-row'},
      h('div',{class:'brand'}, 'OPD LoggerX'),
      h('div',{class:'row'},
        h('label',{class:'chip'}, dateInput),
        todayBtn,
        yBtn
      )
    )
  );
}

function nav(){
  return h('div',{class:'nav'},
    h('button',{class: state.tab==='summary'?'active':'', onclick: ()=>{state.tab='summary'; state.editingId=null; render();}}, 'Summary'),
    h('button',{class: state.tab==='entry'?'active':'', onclick: ()=>{state.tab='entry'; render();}}, 'New/Edit'),
    h('button',{class: state.tab==='data'?'active':'', onclick: ()=>{state.tab='data'; state.editingId=null; render();}}, 'Data/Export')
  );
}

function mainView(){
  if(state.tab==='summary') return SummaryPage();
  if(state.tab==='entry') return EntryPage();
  return DataPage();
}

function SummaryPage(){
  const stats = computeStats(state.visits);

  return h('div',{class:'grid', style:'gap:12px;'},
    h('div',{class:'card'},
      h('div',{class:'grid grid-4'},
        kpi('Total', stats.total),
        kpi('Male', stats.male),
        kpi('Female', stats.female),
        kpi('Surgical', `${stats.surgical} (${stats.ww}/${stats.nww})`)
      )
    ),
    h('div',{class:'card'},
      h('div',{class:'grid grid-4'},
        kpi('Disch', stats.disp.Discharged),
        kpi('Adm', stats.disp.Admitted),
        kpi('ED', stats.disp.ED),
        kpi('Out', stats.disp.Out)
      )
    ),
    h('div',{class:'card'},
      h('div',{class:'section-title'}, 'Age by gender'),
      h('table',{class:'table'},
        h('thead',{}, h('tr',{}, h('th',{},'Age'), h('th',{},'M'), h('th',{},'F'))),
        h('tbody',{},
          ...AGE_GROUPS.map(ag => h('tr',{},
            h('td',{},ag),
            h('td',{}, String(stats.ageGender[ag].M)),
            h('td',{}, String(stats.ageGender[ag].F))
          ))
        )
      )
    ),
    h('div',{class:'card'},
      h('div',{class:'section-title'}, 'Diagnoses (tap for full name)'),
      h('div',{class:'dx-grid'},
        ...DX.map(dx => h('div',{class:'dx-tile', onclick: ()=>{
          alert(`${dx.id} ${dx.code}\n${dx.name}\nCount: ${stats.dxCounts[dx.id]}`);
        }},
          h('div',{class:'name'}, `${dx.id} ${dx.code}`),
          h('div',{class:'count'}, String(stats.dxCounts[dx.id]))
        ))
      )
    ),
    h('div',{class:'small'}, `Day: ${state.date} • Records: ${state.visits.length}`)
  );
}

function kpi(label, value){
  return h('div',{class:'kpi'},
    h('div',{class:'label'}, label),
    h('div',{class:'value'}, String(value))
  );
}

function EntryPage(){
  const editing = state.editingId ? state.visits.find(v=>v.id===state.editingId) : null;

  const formState = {
    patientId: editing?.patientId || '',
    time: editing?.time || new Date().toTimeString().slice(0,5),
    gender: editing?.gender || 'M',
    ageGroup: editing?.ageGroup || '>=18',
    dx1: editing?.dx1 || null,
    dx2: editing?.dx2 || null,
    wwFlag: editing?.wwFlag || '',
    disposition: editing?.disposition || 'Discharged',
  };

  const card = h('div',{class:'card'},
    h('div',{class:'section-title'}, state.editingId ? 'Edit visit' : 'New visit'),
    h('div',{class:'form'},
      h('div',{class:'row'},
        h('input',{class:'input', placeholder:'Patient ID', value: formState.patientId, inputmode:'numeric', oninput:(e)=>{formState.patientId = e.target.value;}}),
        h('input',{class:'input', type:'time', value: formState.time, oninput:(e)=>{formState.time = e.target.value;}})
      ),
      h('div', {class:'row'},
        h('div', {style:'flex:1;'},
          h('div',{class:'small'},'Gender'),
          pills(['M','F'], formState.gender, (v)=>{formState.gender=v;})
        ),
        h('div', {style:'flex:1;'},
          h('div',{class:'small'},'Age group'),
          pills(AGE_GROUPS, formState.ageGroup, (v)=>{formState.ageGroup=v;})
        )
      ),
      h('div',{},
        h('div',{class:'small'}, 'Disposition'),
        pills(DISPOSITIONS, formState.disposition, (v)=>{formState.disposition=v;})
      ),
      h('div',{},
        h('div',{class:'small'}, 'Diagnosis 1'),
        dxSelect(formState.dx1, (id)=>{formState.dx1=id; updateWW();})
      ),
      h('div',{},
        h('div',{class:'small'}, 'Diagnosis 2 (optional)'),
        dxSelect(formState.dx2, (id)=>{formState.dx2=id; updateWW();}, true)
      ),
      h('div',{id:'wwBlock'})
    )
  );

  function updateWW(){
    const surgical = [formState.dx1, formState.dx2].filter(Boolean).some(isSurgicalDx);
    const wwBlock = card.querySelector('#wwBlock');
    wwBlock.innerHTML = '';
    if(surgical){
      wwBlock.appendChild(h('div',{},
        h('div',{class:'small'}, 'WW / Non-WW (required for surgical)'),
        pills([{key:'WW',label:'WW'},{key:'NWW',label:'Non-WW'}].map(x=>x.key), formState.wwFlag, (v)=>{formState.wwFlag=v;})
      ));
    }else{
      formState.wwFlag = '';
    }
  }
  updateWW();

  const actions = h('div',{class:'actions'},
    h('button',{class:'btn primary', onclick: async ()=>{
      const surgical = [formState.dx1, formState.dx2].filter(Boolean).some(isSurgicalDx);
      if(!formState.patientId.trim()) return alert('Patient ID is required');
      if(!formState.dx1) return alert('Diagnosis 1 is required');
      if(surgical && !formState.wwFlag) return alert('WW/Non-WW is required for surgical cases');

      const v = {
        id: state.editingId || uid(),
        visitDate: state.date,
        time: formState.time,
        patientId: formState.patientId.trim(),
        gender: formState.gender,
        ageGroup: formState.ageGroup,
        dx1: formState.dx1,
        dx2: formState.dx2,
        wwFlag: formState.wwFlag,
        disposition: formState.disposition
      };
      await upsertVisit(v);
      await loadDay(state.date);
      state.editingId = null;
      render();
    }}, state.editingId ? 'Save' : 'Save & stay'),
    h('button',{class:'btn secondary', onclick: ()=>{
      state.editingId = null;
      render();
    }}, 'Reset'),
    h('button',{class:'btn danger', onclick: async ()=>{
      if(!state.editingId) return alert('Select a record to delete from Data page.');
      if(!confirm('Delete this record?')) return;
      await deleteVisit(state.editingId);
      await loadDay(state.date);
      state.editingId = null;
      render();
    }}, 'Delete')
  );

  return h('div',{class:'grid', style:'gap:12px;'}, card, actions,
    h('div',{class:'small'}, 'Tip: tap a record in Data/Export to edit.')
  );
}

function pills(options, current, onPick){
  const norm = options.map(o => typeof o === 'string' ? ({key:o,label:o}) : ({key:o.key,label:o.label}));
  const wrap = h('div',{class:'pills'});
  for(const o of norm){
    wrap.appendChild(h('button',{class: current===o.key ? 'on':'' , onclick: ()=>{ onPick(o.key); render(); }}, o.label));
  }
  return wrap;
}

function dxSelect(currentId, onPick, allowEmpty=false){
  const select = h('select',{class:'input', onchange:(e)=> onPick(e.target.value ? Number(e.target.value) : null)});
  if(allowEmpty) select.appendChild(h('option',{value:''}, '— none —'));
  for(const dx of DX){
    const opt = h('option',{value:String(dx.id)}, `${dx.id}. ${dx.code} — ${dx.name}`);
    if(dx.id===currentId) opt.selected = true;
    select.appendChild(opt);
  }
  return select;
}

function DataPage(){
  const stats = computeStats(state.visits);

  const settingsCard = h('div',{class:'card'},
    h('div',{class:'section-title'}, 'Settings'),
    h('div',{class:'row'},
      h('input',{class:'input', placeholder:'Doctor name (saved on device)', value: state.doctorName, oninput: async (e)=>{
        state.doctorName = e.target.value;
        await setSetting('doctorName', state.doctorName);
      }})
    ),
    h('div',{class:'small'}, 'Doctor name will be included in Excel export.')
  );

  const exportCard = h('div',{class:'card'},
    h('div',{class:'section-title'}, 'Export / Backup (selected day only)'),
    h('div',{class:'row'},
      h('button',{class:'btn primary', onclick: async ()=>{
        if(!state.visits.length) return alert('No records for this day.');
        const blob = await exportDayXlsx({date: state.date, doctorName: state.doctorName, visits: state.visits});
        const a = document.createElement('a');
        const safeName = (state.doctorName || 'Doctor').replace(/[^a-z0-9]+/gi,'_');
        a.href = URL.createObjectURL(blob);
        a.download = `OPD_LoggerX_${state.date}_${safeName}.xlsx`;
        a.click();
        URL.revokeObjectURL(a.href);
      }}, 'Export Excel (.xlsx)'),
      h('button',{class:'btn secondary', onclick: async ()=>{
        const data = await exportBackup();
        const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `OPD_LoggerX_Backup_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
      }}, 'Backup JSON')
    ),
    h('div',{class:'row'},
      h('input',{class:'input', type:'file', accept:'application/json', onchange: async (e)=>{
        const file = e.target.files?.[0];
        if(!file) return;
        const obj = JSON.parse(await file.text());
        if(!confirm('Restore backup? This will replace all local data.')) return;
        await importBackup(obj);
        state.doctorName = await getSetting('doctorName','');
        await loadDay(state.date);
        render();
      }})
    ),
    h('div',{class:'row'},
      h('button',{class:'btn danger', onclick: async ()=>{
        if(!confirm(`Clear all records for ${state.date}?`)) return;
        await clearDay(state.date);
        await loadDay(state.date);
        render();
      }}, 'Clear this day')
    ),
    h('div',{class:'small'}, `Totals today: ${stats.total} (Surg: ${stats.surgical})`)
  );

  const listCard = h('div',{class:'card'},
    h('div',{class:'section-title'}, `Records for ${state.date} (tap to edit)`),
    state.visits.length ? h('div',{class:'list'},
      ...state.visits.map(v => recordItem(v))
    ) : h('div',{class:'small'}, 'No records yet for this day.')
  );

  const datesCard = h('div',{class:'card'},
    h('div',{class:'section-title'}, 'Previous days'),
    h('div',{id:'dates', class:'small'}, 'Loading...')
  );

  // async fill dates
  (async ()=>{
    const dates = await listAllDates();
    const el = datesCard.querySelector('#dates');
    el.innerHTML = '';
    if(!dates.length){ el.textContent = 'No previous days yet.'; return; }
    const chips = h('div',{class:'pills'});
    dates.slice(0,24).forEach(d=>{
      chips.appendChild(h('button',{class: d===state.date?'on':'', onclick: async ()=>{
        await loadDay(d);
        state.tab = 'summary';
        state.editingId = null;
        render();
      }}, d));
    });
    el.appendChild(chips);
  })();

  return h('div',{class:'grid', style:'gap:12px;'}, settingsCard, exportCard, listCard, datesCard);
}

function recordItem(v){
  const dx1 = DX.find(d=>d.id===v.dx1);
  const dx2 = DX.find(d=>d.id===v.dx2);
  return h('div',{class:'item', onclick: ()=>{
    state.editingId = v.id;
    state.tab = 'entry';
    render();
  }},
    h('div',{class:'item-top'},
      h('div',{}, `${v.time || ''} • ID ${v.patientId}`),
      h('div',{class:'badge'}, `${v.gender}${v.ageGroup}`)
    ),
    h('div',{class:'small'}, `${dx1?.code||''}${dx2 ? ' + '+dx2.code : ''} • ${v.disposition}${v.wwFlag ? ' • '+v.wwFlag : ''}`)
  );
}

load();
