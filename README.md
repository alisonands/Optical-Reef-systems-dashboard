# Optical Reef dashboard

A local systems engineering playground for independent mirror spacecraft and a free-floating detector platform.

## Open

Double-click **start.command** on macOS. Or, from this folder:

```sh
python3 server.py
```

Open [the dashboard](http://127.0.0.1:8765). Stop the server with Control-C. Python 3 is the only runtime requirement; there is no install or build step. The server listens only on this computer. If the port is already in use, run `python3 server.py --port 8766` and open that port instead.

Opening the HTML directly shows launch instructions because browsers restrict direct reads of adjacent JSON files.

## Edit

| File | Purpose |
| --- | --- |
| `data/project.json` | Project description, ring/F2F defaults and slider ranges |
| `data/propulsion.json` | Technology, tanks, pressurization and propellant sizing inputs |
| `data/acs.json` | Sensors, reaction wheels and control equipment |
| `data/power.json` | Solar cells, batteries, generation, storage and hardware allowance |
| `data/structure.json` | Material trades and shell/support geometry |
| `data/cdh.json` | Command/data handling and computer estimates |
| `data/thermal.json` | Heat transport, passive control and active cooling |
| `data/comms.json` | Communications estimates and link-design inputs |
| `data/payload.json` | Substrates, coatings, actuators and one-off science equipment |
| `calculations/geometry.js` | Segment coordinates, area, radius and enclosing diameter |
| `calculations/subsystems.js` | Equipment selection and subsystem equations |
| `calculations/model.js` | Per-segment and observatory rollups |
| `calculations/equations.js` | Displayed LaTeX and links to executable equations |
| `docs/reference.json` | Requirements, study cases and source decisions |
| `data/workbook-source.json` | Snapshot of original workbook cells, formulas and references |

Save file changes, then click **Reload data**. This reloads the JSON and calculation modules and restores the file defaults. A normal browser refresh retains geometry and trade previews while the data is unchanged. Editing any input JSON automatically invalidates those saved previews on the next load.

Each trade group has `selectedId`, `quantity`, `columns` and `options`. Change `selectedId` to the exact ID of a candidate to set the default. Add a candidate by copying an option in the same group and giving it a unique ID. Add properties to `columns` to compare them in the trade table; every option property remains available in **Specifications & source**. Manufacturer, model, datasheet, source cells and notes are stored with each option.

Equipment mass and consumption are per unit. `quantity` applies once. Scope `segment` repeats with the aperture; `observatory` is counted once. Fixed equipment belongs in `components`; mutually exclusive candidates belong in trade `groups`. Power `inventory` records describe hardware already covered by the distribution allowance. Move them into `components` and reduce/remove that allowance when itemizing them.

Use JSON `null` for TBD values. Use numeric `0` only for an explicit zero contribution. A missing selected value stays incomplete through the overview; unknown equipment does not become massless hardware. Numbers carry units in their field names or column definitions. Keep comments in `notes` fields because standard JSON does not accept comments.

Calculations are plain JavaScript ES modules. Edit the executable equation in its owning module and update the display notation in `calculations/equations.js` if its meaning changes. Equations display as offline MathML generated from the stored LaTeX; expand an equation to inspect its LaTeX, expression and source.

## Model conventions

- Ring 1 is the central segment; ring 2 contains 7 segments. This matches `hex_mirror.html`. The workbook calls the same seven-segment arrangement one surrounding ring.
- F2F is true flat-to-flat distance. The workbook used a corner-to-corner area formula. The corrected area at 3 m F2F is 7.7942 m² per segment.
- The total diameter is the smallest circle enclosing all mirror vertices. The view also labels the horizontal span, which is a different dimension.
- Mass includes the stored loaded-propellant allowance. That allowance is a workbook heuristic; ideal rocket-equation mode requires complete dry mass, delta-v and specific impulse.
- The 200 kg science instrumentation allowance is assigned once to the free-floating science platform. Its complete spacecraft budget remains TBD.
- The duplicate FGS allowance is assigned once to ACS. Computer ownership, tank/feed allocations and other uncertain source assumptions are documented in Traceability.
- Generation, electrical consumption and stored battery energy are separate quantities. Missing array/battery ratings remain TBD.
- Structure and payload show rotatable conceptual geometry. Set `parameters.cadModelUrl` to link a CAD asset. A native CAD importer and the full TMA optical/dynamics models remain future work.

See [the model guide](docs/model-guide.md) for source interpretation and safe propulsion package itemization. The original HTML is preserved in `archive/optical-reef-dashboard-v1.html`; the workbook and original hex visualization remain unchanged.

## Verify

With Node.js installed, run:

```sh
node --test tests/*.test.js
```

Tests cover independent geometry checks, repeated/shared budgets, JSON trade edits, unknown inputs, source allocation, propulsion, and solar/battery calculations. Optional browser tests use an existing Playwright installation via `PLAYWRIGHT_MODULE_PATH`, with the local server running. No browser test dependencies are needed to use the dashboard.
