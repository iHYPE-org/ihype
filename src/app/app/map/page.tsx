/**
 * MAP renders nothing of its own: the map IS the layout's base layer, and this
 * route simply means "no pane is covering it". Returning an empty fragment
 * rather than the map itself is what keeps the map mounted across module
 * changes — see the note in the layout.
 */
export default function MmmMapPage() {
  return null;
}
