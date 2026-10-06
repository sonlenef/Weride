---
version: 1
slug: "src-pages-producttree-tsx"
primary_target: "src/pages/ProductTree.tsx"
related_targets: []
---

# Product tree (/product-tree)

Scope: one page inside the established WeRide workspace world. Visitor mode: Operate (review and catch-up).
Audience and job: Madison BA/PM/Dev/UIUX learning which actor touches which of the 14 handover modules, and what each module contains. All content is a working assumption and must stay labelled as such.
Constraints: content in EN/VI/SV, no horizontal page scroll, keyboard parity for hover, reduced motion respected, no static many-to-many arrows (handover §30).

## Direction contract

THESIS: A three-tier org chart: actors, then modules, then submodules. Every module is drawn exactly once. Relations appear only when asked for, as live edges on hover or pin. This refuses both the duplicated per-actor columns and the static spaghetti of arrows.

OWN-WORLD: The incumbent workspace: deep green #1f3a2e root, white nodes on #f3f7f2, action green #235f47 for lit state, 1px #bfcec4 rules. Four group dots (green, blue, amber, violet) are the only extra hues. The signature details are six actor pips on every module node (filled = uses, dashed ring = indirect, empty = no) and SVG edges that draw themselves in 200ms.

STORY: Visitors scan six actors and fourteen modules in one viewport. Hovering an actor lights its modules and dims the rest. Hovering a module lights its actors and previews its submodules underneath. A click pins the selection and the URL keeps it for sharing.

FIRST VIEWPORT: The heading and assumption note sit on one quiet line. The filter is on the right. A centred WeRide root sits above a full-width row of 6 actor nodes. Below that are 14 module nodes in 4 group columns (5/4/3/2). The tier-3 submodule band waits underneath with a teaching empty state.

FORM: Structure 6 of 7 on the ordered list (three tiers with on-demand edges), surface concept seed 5416075e.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
