# Optical Reef model guide

The dashboard is a local concept-study model for an autonomously assembled, segmented space telescope. Each primary-mirror segment is a spacecraft. The detector is free-floating. The three-mirror anastigmat prescription, relative spacecraft positions and nonlinear wavefront-correction algorithms still need dedicated optical and dynamics models.

## Editing the model

Edit project geometry defaults and environmental assumptions in `data/project.json`. Edit equipment, trade properties, source references, notes and selected defaults in the subsystem JSON files under `data/`. The executable equations live under `calculations/`. The JSON files contain inputs; the calculation modules own the arithmetic; the frontend presents those results.

The frontend allows geometry changes and trade selection. Detailed hardware specifications, quantities, assumptions and equations are edited in the files. Reload the dashboard after changing the files. Browser selections are exploratory; update the corresponding JSON default to make a selection part of the baseline.

`docs/reference.json` contains the Requirements & cases planning register and provenance notes. Targets are TBD because the workbook does not contain approved numeric requirements. The former dashboard's 2000 kg module limit and EOL power threshold had no workbook source and are not adopted as requirements. The dashboard does not evaluate live requirement checks.

## Source and uncertainty

The source is `BUDGETS_final.xlsx`. Preserve its cell references when replacing preliminary values with manufacturer data. Record manufacturer, part number, source URL, rating conditions and notes where available. Enter `null` for an unknown numeric value. Use `0` only when zero is an intentional, defensible value.

Incomplete equipment estimates produce incomplete budgets. A sum of known values is useful for design exploration, but it is not a closed mass or electrical budget. Propulsion, solar generation, battery energy, thermal ratings, coating mass and detector spacecraft support remain important open inputs.

The workbook contains source issues that affect interpretation:

- The input labelled FTF is used as corner-to-corner diameter in the workbook's segment area formula. The dashboard uses true flat-to-flat distance.
- The main sheet includes the centre segment and the Mirror mass sheet omits it. Use one geometry definition across budgets.
- The source ACS total includes 25 kg of dry propulsion, which is also added in the bus summary. Allocate it to Propulsion and count it once.
- The fine guidance sensor appears in Payload and ACS with identical mass and power. The model assigns it once to ACS as an explicit assumption; confirm whether a separate payload unit is needed.
- An ACS computer, a separate computer and a C&DH estimate have unresolved processing allocations.
- Power!C3 is a system-load estimate. It is neither battery output nor solar generation.
- Thermal!B11:C11 gives a rough alternative mass/power note, separate from the 5 kg cooler estimate.

## Geometry

For a regular hexagon with flat-to-flat dimension \(f\), circumradius is \(f/\sqrt{3}\), and area is \(\sqrt{3} f^2/2\). The UI counts the centre as ring 1, matching `hex_mirror.html`. For \(R\) displayed rings, the array contains \(1+3(R-1)R\) segments. The default 2 rings therefore reproduce the workbook's 7 segments; the workbook labels that same arrangement as 1 surrounding ring.

Total primary area is the segment area times the segment count. This is the sum of mirror faces; it does not establish unobscured collecting area. Segment gaps, optical obscuration and throughput need their own inputs when specified.

The bus radius is the circumscribed radius of the segment footprint. Total array diameter must use the same axial coordinates and hexagon vertices as the visualization. A count-derived area-equivalent diameter is a different quantity and should not replace the outer array extent.

## Mass and power

Repeated equipment scales with the number of segment spacecraft. Observatory-level items, including a one-off detector spacecraft allocation, are added once. The 200 kg science instrumentation estimate is currently assigned once to the detector platform as an explicit architecture assumption. Its supporting spacecraft budget remains incomplete. Keep the scope visible when comparing total and per-segment values. A total divided by segment count can be a useful allocated average, but it must not imply that the detector is physically repeated on each segment.

For ordinary equipment, the known contribution is quantity times unit mass or unit power. A selected material or solar technology may instead use a geometry-based calculation. Subtotals should retain unresolved input flags all the way to the overview.

Substrate mass based on areal density is segment face area times substrate areal density. An areal-density trade already includes its stated lightweighting basis; do not also apply a volumetric density calculation to the same substrate. Coating mass needs areal mass or density and thickness. Coating reflectivity alone does not determine coating mass or the complete telescope throughput.

Electrical consumption, array generation and battery stored energy are separate quantities. A battery is not a net energy source over a repeatable charge/discharge cycle. The workbook does not supply sufficient ratings for a validated power or energy balance.

Ideal rocket sizing requires a defined dry mass, delta-v and specific impulse. Tank mass, unusable residuals, reserves and pressurant require explicit assumptions. A ratio-based propellant allowance must be labelled as an allowance; it should not be reported as a solved trajectory or finite-burn result.

The workbook's 25 kg propulsion allowance includes unspecified tanks and feed hardware. Its technology option therefore records `includesGroups: ["tank", "pressurization"]`; baseline child selections use `includedInPackage: true`. Selecting an itemized tank or pressurization option (`includedInPackage: false`) adds that option and marks the remaining combined package mass and power TBD. To finish the split, enter nonoverlapping core-hardware mass and power and set its `includesGroups` to `[]`. This prevents an itemized tank from being added on top of a package that already includes it.

## Suggested next model connections

For ACS, add disturbance torque, wheel geometry, pointing stability, sensor noise and relative-navigation performance. For Thermal, connect heater loads, optical temperature limits and a thermal network. For C&DH and Comms, define the processing architecture and distinguish science, metrology and formation-control data flows. For Structure and Payload, replace the concept preview with a sourced CAD model when one becomes available.

The Requirements & cases register separates these future analyses from the budget calculations. It stores planning objectives and verification ideas without implying that the current budget model has verified optical, control, thermal or communications performance.
