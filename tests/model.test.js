import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  calculate, geometry, mirrorMass, solarArray, battery, sizePropellant
} from '../calculations/model.js';

const project = JSON.parse(await readFile(new URL('../data/project.json', import.meta.url)));
const systems = Object.fromEntries(await Promise.all(project.subsystemOrder.map(async id => [
  id, JSON.parse(await readFile(new URL(`../data/${id}.json`, import.meta.url)))
])));
const clone = value => structuredClone(value);
const subsystem = (result, id) => result.subsystems.find(item => item.id === id);
const group = (data, subsystemId, groupId) => data[subsystemId].groups.find(item => item.id === groupId);
const near = (actual, expected, message) => assert.ok(
  Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(expected)),
  `${message ?? 'Value'}: expected ${expected}, received ${actual}`
);

test('true F2F geometry includes the centre and matches the actual outer vertices', () => {
  for (const [rings, count] of [[1, 1], [2, 7], [3, 19], [12, 397]]) {
    const geo = geometry(rings, 3);
    assert.equal(geo.segmentCount, count);
    assert.equal(geo.coordinates.length, count);
    assert.equal(new Set(geo.coordinates.map(({q, r}) => `${q},${r}`)).size, count);
    near(geo.segmentAreaM2, 7.794228634059947);
    near(geo.totalAreaM2, 7.794228634059947 * count);
    near(geo.circumradiusM, Math.sqrt(3));

    // Independently measure the emitted geometry rather than repeating its diameter formula.
    const vertices = geo.coordinates.flatMap(({x, y}) => Array.from({length: 6}, (_, i) => ({
      x: x + Math.sqrt(3) * Math.cos(i * Math.PI / 3),
      y: y + Math.sqrt(3) * Math.sin(i * Math.PI / 3)
    })));
    near(geo.diameterM, 2 * Math.max(...vertices.map(({x, y}) => Math.hypot(x, y))));
    near(geo.widthM, Math.max(...vertices.map(v => v.x)) - Math.min(...vertices.map(v => v.x)));
    near(geo.heightM, Math.max(...vertices.map(v => v.y)) - Math.min(...vertices.map(v => v.y)));
  }
});

test('geometry rejects invalid rings and nonpositive dimensions', () => {
  for (const rings of [0, -1, 1.5, NaN, 101]) assert.throws(() => geometry(rings, 3));
  for (const dimension of [0, -1, NaN, Infinity]) assert.throws(() => geometry(2, dimension));
});

test('workbook baseline counts leaf budgets once and keeps incomplete totals explicit', () => {
  const result = calculate(project, systems);
  const acs = subsystem(result, 'acs');
  near(acs.massPerSegmentKg, 67.625, 'ACS excludes the propulsion allowance');
  near(acs.powerPerSegmentW, 295.6);
  near(subsystem(result, 'cdh').massPerSegmentKg, 25);
  near(subsystem(result, 'cdh').powerPerSegmentW, 100);
  near(subsystem(result, 'comms').massPerSegmentKg, 10);
  near(subsystem(result, 'comms').powerPerSegmentW, 60);
  near(subsystem(result, 'propulsion').massPerSegmentKg, 25 + 329.8229451574279);
  near(result.powerPerSegmentW, 480.6, 'Identified consumption uses equipment loads, not mass proxies');
  near(result.sharedMassKg, 200, 'Science instrumentation is allocated once');
  near(result.totalMassKg, result.massPerSegmentKg * 7 + 200);
  near(result.totalPowerW, 480.6 * 7);
  assert.equal(result.massIncomplete, true);
  assert.equal(result.powerIncomplete, true);
  assert.equal(acs.massIncomplete, false);
  assert.equal(acs.powerIncomplete, false);
  assert.equal(result.generatedPowerPerSegmentW, null);
  assert.equal(result.totalGeneratedPowerW, null);
  assert.ok(subsystem(result, 'payload').missingMass.some(item => item.id === 'coating'));
  assert.ok(subsystem(result, 'payload').missingPower.some(item => item.id === 'detector'));

  const fgsItems = result.subsystems.flatMap(system => system.items).filter(item =>
    item.source?.includes('Payload!B9') || item.source?.includes('ACS!B4')
  );
  assert.equal(fgsItems.length, 1, 'The duplicated FGS source is assigned once');
});

test('ring scaling repeats segment equipment while keeping observatory equipment fixed', () => {
  const small = calculate(project, systems, {rings: 2});
  const large = calculate(project, systems, {rings: 3});
  near(large.massPerSegmentKg, small.massPerSegmentKg);
  near(large.powerPerSegmentW, small.powerPerSegmentW);
  near(large.sharedMassKg, 200);
  near(large.totalMassKg - small.totalMassKg, small.massPerSegmentKg * 12);
  near(large.totalPowerW - small.totalPowerW, small.powerPerSegmentW * 12);
});

test('F2F changes propagate into mirror, array and shell mass through their geometric models', () => {
  const normal = calculate(project, systems, {flatToFlatM: 3});
  const doubled = calculate(project, systems, {flatToFlatM: 6});
  near(subsystem(doubled, 'payload').metrics.substrateMassKg,
    4 * subsystem(normal, 'payload').metrics.substrateMassKg);
  near(subsystem(doubled, 'power').metrics.arrayAreaM2,
    4 * subsystem(normal, 'power').metrics.arrayAreaM2);

  // Source battery mass and fixed residual do not scale with mirror area.
  const powerFixedMass = 7.06 + 30.402985573365115;
  near(subsystem(normal, 'power').massPerSegmentKg,
    powerFixedMass + 3 * normal.geometry.segmentAreaM2);
  near(subsystem(doubled, 'power').massPerSegmentKg,
    powerFixedMass + 3 * doubled.geometry.segmentAreaM2);

  // Two face plates, perimeter walls and six F2F/4 supports, all 5 mm thick.
  const independentShellMass = f => (2 * (Math.sqrt(3) / 2 * f * f)
    + (2 * Math.sqrt(3) * f) + 6 * (f / 4)) * 0.005 * 2700;
  near(subsystem(normal, 'structure').metrics.structuralMassKg, independentShellMass(3));
  near(subsystem(doubled, 'structure').metrics.structuralMassKg, independentShellMass(6));
});

test('editing JSON trade values and selectedId propagates quantity-adjusted mass and power', () => {
  const modified = clone(systems);
  const wheels = group(modified, 'acs', 'reaction-wheels');
  Object.assign(wheels.options.find(option => option.id === 'candidate'), {massKg: 2, powerW: 3});
  wheels.selectedId = 'candidate';
  const before = calculate(project, systems);
  const after = calculate(project, modified);
  near(subsystem(after, 'acs').massPerSegmentKg - subsystem(before, 'acs').massPerSegmentKg, -40);
  near(subsystem(after, 'acs').powerPerSegmentW - subsystem(before, 'acs').powerPerSegmentW, -188);
  near(after.totalMassKg - before.totalMassKg, -280);
  near(after.totalPowerW - before.totalPowerW, -1316);
  const frontendSelection = calculate(project, modified, {selections: {'acs.reaction-wheels': 'workbook'}});
  near(frontendSelection.totalMassKg, before.totalMassKg);
  near(frontendSelection.totalPowerW, before.totalPowerW);
});

test('selecting TBD equipment preserves known subtotals and marks missing contributions', () => {
  const before = calculate(project, systems);
  const after = calculate(project, systems, {selections: {'acs.reaction-wheels': 'candidate'}});
  const acs = subsystem(after, 'acs');
  near(acs.massPerSegmentKg, 19.625);
  near(acs.powerPerSegmentW, 95.6);
  near(after.totalMassKg, before.totalMassKg - 48 * 7);
  near(after.totalPowerW, before.totalPowerW - 200 * 7);
  assert.equal(acs.massIncomplete, true);
  assert.equal(acs.powerIncomplete, true);
  assert.ok(acs.missingMass.some(item => item.id === 'reaction-wheels'));
  assert.ok(acs.missingPower.some(item => item.id === 'reaction-wheels'));
});

test('an unknown substrate stays TBD instead of becoming a massless complete option', () => {
  const before = calculate(project, systems);
  const after = calculate(project, systems, {selections: {'payload.substrate': 'zerodur'}});
  const payload = subsystem(after, 'payload');
  assert.equal(payload.metrics.substrateMassKg, null);
  assert.ok(payload.missingMass.some(item => item.id === 'substrate'));
  near(before.totalMassKg - after.totalMassKg, 40 * before.geometry.totalAreaM2);
});

test('structural material selection changes geometric mass with density', () => {
  const aluminum = calculate(project, systems);
  const graphite = calculate(project, systems, {selections: {'structure.material': 'graphite'}});
  near(subsystem(graphite, 'structure').metrics.structuralMassKg,
    subsystem(aluminum, 'structure').metrics.structuralMassKg * 1600 / 2700);
  near(graphite.totalMassKg - aluminum.totalMassKg,
    (subsystem(graphite, 'structure').metrics.structuralMassKg
      - subsystem(aluminum, 'structure').metrics.structuralMassKg) * 7);
});

test('itemizing a tank replaces the overlapping package allowance with an explicit TBD core', () => {
  const modified = clone(systems);
  const tank = group(modified, 'propulsion', 'tank').options.find(option => option.id === 'diaphragm');
  Object.assign(tank, {massKg: 5, powerW: 2});
  group(modified, 'propulsion', 'tank').selectedId = 'diaphragm';
  const result = calculate(project, modified);
  const prop = subsystem(result, 'propulsion');
  near(prop.massPerSegmentKg, 329.8229451574279 + 5,
    'The combined 25 kg allowance must not also be counted');
  near(prop.powerPerSegmentW, 2);
  assert.equal(prop.metrics.packageScopeIncomplete, true);
  assert.equal(prop.massIncomplete, true);
  assert.equal(prop.powerIncomplete, true);
  assert.ok(prop.missingMass.some(item => item.id === 'technology'));
  assert.ok(prop.missingPower.some(item => item.id === 'technology'));
  assert.equal(prop.items.find(item => item.id === 'technology').massKg, null);
});

test('a nonoverlapping propulsion core, tank and pressurization roll up once after JSON itemization', () => {
  const modified = clone(systems);
  const technology = group(modified, 'propulsion', 'technology');
  Object.assign(technology.options.find(option => option.id === 'workbook'),
    {massKg: 20, powerW: 0, includesGroups: []});
  const tank = group(modified, 'propulsion', 'tank');
  Object.assign(tank.options.find(option => option.id === 'diaphragm'), {massKg: 5, powerW: 2});
  tank.selectedId = 'diaphragm';
  const pressurization = group(modified, 'propulsion', 'pressurization');
  Object.assign(pressurization.options.find(option => option.id === 'blowdown'), {massKg: 3, powerW: 1});
  pressurization.selectedId = 'blowdown';
  const result = calculate(project, modified);
  const prop = subsystem(result, 'propulsion');
  near(prop.massPerSegmentKg, 329.8229451574279 + 28);
  near(prop.powerPerSegmentW, 3);
  assert.equal(prop.massIncomplete, false);
  assert.equal(prop.powerIncomplete, false);
  near(result.totalMassKg - calculate(project, systems).totalMassKg, 3 * 7);
  near(result.totalPowerW - calculate(project, systems).totalPowerW, 3 * 7);
});

test('solar generation and battery energy stay separate from consumption', () => {
  const modified = clone(systems);
  const solar = group(modified, 'power', 'solar').options.find(option => option.id === 'workbook');
  const cell = group(modified, 'power', 'battery').options.find(option => option.id === 'liion');
  Object.assign(solar, {powerDensityWm2: 200, powerW: 0});
  Object.assign(cell, {energyWh: 900, powerW: 0});
  const result = calculate(project, modified);
  near(result.generatedPowerPerSegmentW, 200 * result.geometry.segmentAreaM2);
  near(result.totalGeneratedPowerW, 200 * result.geometry.totalAreaM2);
  near(subsystem(result, 'power').metrics.energyWh, 900);
  near(result.powerPerSegmentW, 480.6);
  assert.notEqual(result.generatedPowerPerSegmentW, 1093.7, 'Workbook system-load note is not generation');

  solar.powerDensityWm2 = 400;
  const doubled = calculate(project, modified);
  near(doubled.generatedPowerPerSegmentW, 2 * result.generatedPowerPerSegmentW);
  near(doubled.totalPowerW, result.totalPowerW);
});

test('solar efficiency model obeys inverse-square distance without applying losses twice', () => {
  const option = {massKg: 10, efficiency: 0.25};
  const parameters = {arrayAreaMode: 'fixed', arrayAreaM2: 4, solarFluxWm2: 1000,
    distanceAU: 1, arrayPointingFactor: 0.8, arrayTemperatureFactor: 0.9, pmadEfficiency: 0.95};
  const nearby = solarArray(option, geometry(2, 3), parameters);
  near(nearby.generatedPowerW, 684);
  near(nearby.massKg, 10);
  const distant = solarArray(option, geometry(2, 3), {...parameters, distanceAU: 2});
  near(distant.generatedPowerW, 171);
  assert.equal(solarArray(option, geometry(2, 3), {...parameters, pmadEfficiency: null}).generatedPowerW, null);
});

test('battery sizing converts Ah and specific energy while preserving unknown usability', () => {
  const output = battery({capacityAh: 20, voltageV: 28, specificEnergyWhKg: 140},
    {batteryDepthOfDischarge: 0.8, batteryDischargeEfficiency: 0.9});
  near(output.energyWh, 560);
  near(output.massKg, 4);
  near(output.usableEnergyWh, 403.2);
  assert.equal(battery({massKg: 7.06}).energyWh, null);
  assert.equal(battery({energyWh: 560}).usableEnergyWh, null);
});

test('mirror mass uses an areal or volumetric basis and keeps incomplete dimensions unknown', () => {
  near(mirrorMass({arealDensityKgM2: 40, densityKgM3: 9999}, 5), 200);
  near(mirrorMass({densityKgM3: 2000}, 5,
    {substrateThicknessM: 0.01, substrateSolidFraction: 0.5}), 50);
  near(mirrorMass({densityGcm3: 2.7}, 5, {coatingThicknessM: 1e-6}, 'coating'), 0.0135);
  assert.equal(mirrorMass({densityKgM3: 2530}, 5), null);
  assert.equal(mirrorMass({arealDensityKgM2: null, massKg: null}, 5), null);
});

test('ideal propellant sizing recovers a known mass ratio and rejects insufficient inputs', () => {
  const g0 = 9.80665;
  const deltaV = 300 * g0 * Math.log(1.5);
  near(sizePropellant(100, deltaV, 300), 50);
  near(sizePropellant(100, 0, 300), 0);
  assert.equal(sizePropellant(100, deltaV, null), null);
  assert.equal(sizePropellant(null, deltaV, 300), null);
  assert.equal(sizePropellant(100, deltaV, 0), null);
});

test('rocket-equation rollup requires complete dry mass rather than silently sizing on known subtotal', () => {
  const modified = clone(systems);
  Object.assign(modified.propulsion.parameters, {sizingMode: 'rocketEquation', deltaVMs: 20, specificImpulseS: 230});
  const incomplete = calculate(project, modified);
  const prop = subsystem(incomplete, 'propulsion');
  assert.equal(prop.metrics.loadedPropellantKg, null);
  assert.equal(prop.metrics.sizingDryMassIncomplete, true);
  assert.ok(prop.missingMass.some(item => item.id === 'propellant'));
});

test('unknown selections and invalid quantities fail with actionable errors', () => {
  assert.throws(() => calculate(project, systems, {selections: {'acs.reaction-wheels': 'missing'}}),
    /Unknown trade selection acs\.reaction-wheels/);
  const modified = clone(systems);
  group(modified, 'acs', 'reaction-wheels').quantity = -1;
  assert.throws(() => calculate(project, modified), /Invalid quantity/);
});

test('zero quantity excludes unknown equipment without inventing a missing contribution', () => {
  const fixture = {id: 'fixture', name: 'Fixture', groups: [], components: [
    {id: 'known', name: 'Known', quantity: 2, scope: 'segment', massKg: 3, powerW: 4},
    {id: 'unused', name: 'Unused unknown', quantity: 0, massKg: null, powerW: null},
    {id: 'shared', name: 'Shared', quantity: 1, scope: 'observatory', massKg: 5, powerW: 6}
  ]};
  const result = calculate(project, [fixture]);
  near(result.massPerSegmentKg, 6);
  near(result.powerPerSegmentW, 8);
  near(result.totalMassKg, 47);
  near(result.totalPowerW, 62);
  assert.equal(result.massIncomplete, false);
  assert.equal(result.powerIncomplete, false);
});
