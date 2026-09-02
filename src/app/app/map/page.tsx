/**
 * MAP renders nothing of its own: the map IS the layout's base layer, and this
 * route simply means "no pane is covering it". Returning an empty fragment
 * rather than the map itself is what keeps the map mounted across module
 * changes — see the note in the layout.
 */
export default function MmmMapPage() {
  // The map itself is the layout's base layer; this route contributes only the
  // document's name, which it never had. See the music tab page for why hidden.
  return <h1 className="sr-only">Map</h1>;
}
