import {geometry} from './geometry.js';
import {known,resolveSubsystem,sizePropellant,propulsionPerformance} from './subsystems.js';

/** Aggregate known values while preserving each unknown contribution explicitly. */
function rollup(system,segmentCount) {
  const result={...system,massPerSegmentKg:0,powerPerSegmentW:0,sharedMassKg:0,sharedPowerW:0,massIncomplete:false,powerIncomplete:false,missingMass:[],missingPower:[]};
  for (const item of system.items) {
    const q=item.quantity??1;
    if (!known(q) || q<0) throw new Error(`Invalid quantity: ${system.id}.${item.id}`);
    if (q===0) continue;
    const shared=item.scope==='observatory';
    for (const [input,segment,common,missing,incomplete] of [
      ['massKg','massPerSegmentKg','sharedMassKg','missingMass','massIncomplete'],
      ['powerW','powerPerSegmentW','sharedPowerW','missingPower','powerIncomplete']
    ]) {
      if (known(item[input]) && item[input]>=0) result[shared?common:segment]+=item[input]*q;
      else {result[incomplete]=true;result[missing].push({id:item.id,name:item.name,scope:item.scope||'segment'});}
    }
  }
  result.totalMassKg=result.massPerSegmentKg*segmentCount+result.sharedMassKg;
  result.totalPowerW=result.powerPerSegmentW*segmentCount+result.sharedPowerW;
  // Concise aliases are useful to consume in small downstream reports.
  result.massKg=result.massPerSegmentKg;
  result.powerW=result.powerPerSegmentW;
  return result;
}

export function calculate(project, systems, state={}) {
  const geo=geometry(state.rings??project.geometry.rings,state.flatToFlatM??project.geometry.flatToFlatM);
  const sourceSystems=Array.isArray(systems)?systems:Object.values(systems);
  let subsystems=sourceSystems.map(system=>rollup(resolveSubsystem(system,geo,state),geo.segmentCount));
  const propulsion=subsystems.find(system=>system.id==='propulsion');
  const propulsionInput=sourceSystems.find(system=>system.id==='propulsion');
  if (propulsion && propulsionInput.parameters?.sizingMode==='rocketEquation') {
    const propellant=propulsion.items.find(item=>item.id==='propellant');
    const dryItems=subsystems.flatMap(system=>system.items.filter(item=>item.scope!=='observatory' && !(system.id==='propulsion'&&item.id==='propellant')));
    const dryComplete=dryItems.every(item=>(item.quantity??1)===0 || (known(item.massKg)&&item.massKg>=0));
    const dryMassKg=dryItems.reduce((sum,item)=>sum+(known(item.massKg)?item.massKg*(item.quantity??1):0),0);
    const params=propulsionInput.parameters;
    const option=propulsion.selected.find(selection=>selection.groupId==='technology')?.option||{};
    propellant.massKg=dryComplete?sizePropellant(dryMassKg,params.deltaVMs,params.specificImpulseS??option.specificImpulseS,params.reserveFraction??0):null;
    propulsion.metrics={...propulsion.metrics,...propulsionPerformance(params,option,propellant.massKg),sizingDryMassKg:dryMassKg,sizingDryMassIncomplete:!dryComplete};
    subsystems=subsystems.map(system=>system.id==='propulsion'?rollup(propulsion,geo.segmentCount):system);
  }
  const sum=key=>subsystems.reduce((total,system)=>total+system[key],0);
  const result={geometry:geo,subsystems,massPerSegmentKg:sum('massPerSegmentKg'),powerPerSegmentW:sum('powerPerSegmentW'),totalMassKg:sum('totalMassKg'),totalPowerW:sum('totalPowerW'),sharedMassKg:sum('sharedMassKg'),sharedPowerW:sum('sharedPowerW'),massIncomplete:subsystems.some(system=>system.massIncomplete),powerIncomplete:subsystems.some(system=>system.powerIncomplete)};
  result.arealDensityKgM2=result.totalMassKg/geo.totalAreaM2;
  result.geometry.arealDensityKgM2=result.arealDensityKgM2;
  result.generatedPowerPerSegmentW=subsystems.find(system=>system.id==='power')?.metrics.generatedPowerW??null;
  result.totalGeneratedPowerW=known(result.generatedPowerPerSegmentW)?result.generatedPowerPerSegmentW*geo.segmentCount:null;
  return result;
}

export {geometry, calculateGeometry} from './geometry.js';
export {sizePropellant,mirrorMass,solarArray,battery,structureMass} from './subsystems.js';
