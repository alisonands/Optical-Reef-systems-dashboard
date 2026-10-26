/** Numeric nulls mean unknown, never zero. Inputs and output units are SI unless named otherwise. */
export const known = value => typeof value === 'number' && Number.isFinite(value);
const nonnegative = value => known(value) && value >= 0;
const positive = value => known(value) && value > 0;
const product = (...values) => values.every(nonnegative) ? values.reduce((a,b)=>a*b,1) : null;

export function selectedOption(system, group, state={}) {
  const key = `${system.id}.${group.id}`;
  const requested = state.selections?.[key] ?? group.selectedId;
  const result = group.options.find(option => option.id === requested);
  if (!result) throw new Error(`Unknown trade selection ${key}: ${requested}`);
  return result;
}

export function mirrorMass(option, areaM2, parameters={}, kind='substrate') {
  if (nonnegative(option.arealDensityKgM2)) return product(areaM2,option.arealDensityKgM2);
  if (nonnegative(option.massKg)) return option.massKg;
  const density = option.densityKgM3 ?? (known(option.densityGcm3) ? option.densityGcm3 * 1000 : null);
  const thickness = option.thicknessM ?? parameters[kind === 'coating' ? 'coatingThicknessM' : 'substrateThicknessM'];
  const solidFraction = kind === 'coating' ? 1 : option.solidFraction ?? parameters.substrateSolidFraction;
  return product(areaM2,density,thickness,solidFraction);
}

export function structureMass(option, geo, parameters={}) {
  const rho = option.densityKgM3 ?? (known(option.densityGcm3) ? option.densityGcm3*1000 : null);
  const {heightM,wallThicknessM,endFaceCount,radialSupportCount,radialSupportLengthF2FFraction,coverageFraction,extraMassKg} = parameters;
  if (![rho,heightM,wallThicknessM,endFaceCount,radialSupportCount,radialSupportLengthF2FFraction,coverageFraction,extraMassKg].every(nonnegative)) return {massKg:null,shellAreaM2:null,volumeM3:null};
  const shellAreaM2 = geo.perimeterM * heightM + endFaceCount * geo.segmentAreaM2 + radialSupportCount * radialSupportLengthF2FFraction * geo.flatToFlatM * heightM;
  const volumeM3 = shellAreaM2 * wallThicknessM * coverageFraction;
  return {massKg:volumeM3*rho+extraMassKg,shellAreaM2,volumeM3};
}

export function solarArray(option, geo, parameters={}) {
  const areaM2 = parameters.arrayAreaMode === 'segmentFace'
    ? product(geo.segmentAreaM2,parameters.arrayFaceFraction)
    : parameters.arrayAreaM2;
  const massKg = nonnegative(option.arealMassKgM2)
    ? product(areaM2,option.arealMassKgM2) : (nonnegative(option.massKg) ? option.massKg : null);
  let generatedPowerW = null;
  if (nonnegative(option.powerDensityWm2)) generatedPowerW = product(areaM2,option.powerDensityWm2);
  else {
    const {solarFluxWm2,distanceAU,arrayPointingFactor,arrayTemperatureFactor,pmadEfficiency} = parameters;
    if (positive(distanceAU)) {
      generatedPowerW = product(areaM2,solarFluxWm2,option.efficiency,arrayPointingFactor,arrayTemperatureFactor,pmadEfficiency);
      if (known(generatedPowerW)) generatedPowerW /= distanceAU ** 2;
    }
  }
  return {areaM2:nonnegative(areaM2)?areaM2:null,massKg,generatedPowerW};
}

export function battery(option, parameters={}) {
  let energyWh = nonnegative(option.energyWh) ? option.energyWh : null;
  let massKg = nonnegative(option.massKg) ? option.massKg : null;
  if (!known(energyWh) && known(massKg) && nonnegative(option.specificEnergyWhKg)) energyWh = massKg*option.specificEnergyWhKg;
  if (!known(energyWh) && nonnegative(option.capacityAh) && nonnegative(option.voltageV)) energyWh=option.capacityAh*option.voltageV;
  if (!known(massKg) && known(energyWh) && positive(option.specificEnergyWhKg)) massKg=energyWh/option.specificEnergyWhKg;
  const usableEnergyWh = product(energyWh,parameters.batteryDepthOfDischarge,parameters.batteryDischargeEfficiency);
  return {massKg,energyWh,usableEnergyWh};
}

export function sizePropellant(dryMassKg, deltaVMs, specificImpulseS, reserveFraction=0) {
  if (!nonnegative(dryMassKg) || !nonnegative(deltaVMs) || !positive(specificImpulseS) || !nonnegative(reserveFraction)) return null;
  // Ideal rocket equation. No dry-tank recursion, residual fractions or trajectories are implicit.
  return dryMassKg * Math.expm1(deltaVMs*(1+reserveFraction)/(9.80665*specificImpulseS));
}

export function propulsionPerformance(parameters={}, option={}, loadedPropellantKg=null) {
  const specificImpulseS=parameters.specificImpulseS ?? option.specificImpulseS;
  const thrustN=parameters.thrustN ?? option.thrustN;
  const densityKgL=parameters.densityKgL ?? option.densityKgL;
  const massFlowKgS=nonnegative(thrustN)&&positive(specificImpulseS) ? thrustN/(specificImpulseS*9.80665):null;
  return {
    loadedPropellantKg,
    specificImpulseS:specificImpulseS ?? null,
    thrustN:thrustN ?? null,
    massFlowKgS,
    propellantVolumeL:nonnegative(loadedPropellantKg)&&positive(densityKgL)?loadedPropellantKg/densityKgL:null,
    totalImpulseNs:product(loadedPropellantKg,specificImpulseS,9.80665),
    burnDurationS:nonnegative(loadedPropellantKg)&&positive(massFlowKgS)?loadedPropellantKg/massFlowKgS:null
  };
}

export function resolveSubsystem(system, geo, state={}) {
  const items=(system.components||[]).map(component=>({...component,quantity:component.quantity??1}));
  const metrics={};
  const selected=[];
  const parameters=system.parameters||{};
  const selections=new Map((system.groups||[]).map(group=>[group.id,selectedOption(system,group,state)]));
  const packageGroup=(system.groups||[]).find(group=>group.packageGroup===true);
  const packageOption=packageGroup?selections.get(packageGroup.id):null;
  for (const group of system.groups||[]) {
    const option=selections.get(group.id);
    const quantity=group.quantity??1;
    const coveredByPackage=option.includedInPackage===true && packageOption?.includesGroups?.includes(group.id);
    selected.push({groupId:group.id,groupName:group.name,quantity,option,budgeted:group.budgeted!==false&&!coveredByPackage});
    if (system.id==='structure' && group.id==='material') {
      const result=structureMass(option,geo,parameters);
      Object.assign(metrics,{structuralMassKg:result.massKg,shellAreaM2:result.shellAreaM2,volumeM3:result.volumeM3,shellVolumeM3:result.volumeM3,densityKgM3:option.densityKgM3??(known(option.densityGcm3)?option.densityGcm3*1000:null)});
      items.push({id:'shell',name:`${option.name} shell and supports`,scope:'segment',quantity:1,massKg:result.massKg,powerW:0,source:option.source,notes:'Geometric estimate; passive structure power is modeled as zero.'});
      continue;
    }
    if (group.budgeted===false || coveredByPackage) continue;
    let massKg=option.massKg??null;
    let powerW=option.powerW??null;
    let notes=option.notes;
    if (group.packageGroup===true) {
      const itemizedGroups=(option.includesGroups||[]).filter(id=> {
        const child=(system.groups||[]).find(candidate=>candidate.id===id);
        return child?.budgeted!==false && (child?.quantity??1)>0 && selections.get(id)?.includedInPackage===false;
      });
      if (itemizedGroups.length) {
        // A combined allowance cannot be summed with a newly itemized portion of itself.
        // Keep the remaining core explicitly unknown until its scope is split in JSON.
        massKg=null;
        powerW=null;
        notes=`${option.notes||''} Remaining package mass and power are TBD because ${itemizedGroups.join(', ')} is now itemized. Enter a nonoverlapping core-hardware option with includesGroups: [] to complete the split.`;
        metrics.packageScopeIncomplete=true;
      }
    }
    if (system.id==='payload' && ['substrate','coating'].includes(group.id)) {
      massKg=mirrorMass(option,geo.segmentAreaM2,parameters,group.id);
      metrics[group.id+'MassKg']=known(massKg)?massKg*quantity:null;
    }
    if (system.id==='power' && group.id==='solar') {
      const result=solarArray(option,geo,parameters);
      massKg=result.massKg;
      metrics.arrayAreaM2=known(result.areaM2)?result.areaM2*quantity:null;
      metrics.generatedPowerW=known(result.generatedPowerW)?result.generatedPowerW*quantity:null;
    }
    if (system.id==='power' && group.id==='battery') {
      const result=battery(option,parameters);
      massKg=result.massKg;
      metrics.energyWh=known(result.energyWh)?result.energyWh*quantity:null;
      metrics.usableEnergyWh=known(result.usableEnergyWh)?result.usableEnergyWh*quantity:null;
      metrics.batteryEnergyWh=metrics.energyWh;
      metrics.usableBatteryEnergyWh=metrics.usableEnergyWh;
    }
    items.push({id:group.id,name:option.name,scope:group.scope||'segment',quantity,massKg,powerW,source:option.source,notes,manufacturer:option.manufacturer,model:option.model});
  }
  if (system.id==='propulsion') {
    const loadedPropellantKg=parameters.sizingMode==='allowance'&&nonnegative(parameters.loadedPropellantKg)?parameters.loadedPropellantKg:null;
    items.push({id:'propellant',name:'Loaded propellant',quantity:1,scope:'segment',massKg:loadedPropellantKg,powerW:0,source:parameters.loadedPropellantSource,notes:parameters.sizingMode==='allowance'?'Workbook heuristic allowance; not a delta-v prediction.':'Ideal rocket-equation load, pending complete inputs.'});
    Object.assign(metrics,propulsionPerformance(parameters,selected.find(s=>s.groupId==='technology')?.option,loadedPropellantKg));
  }
  return {id:system.id,name:system.name,color:system.color,status:system.status,items,selected,metrics};
}
