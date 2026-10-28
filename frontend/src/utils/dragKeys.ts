/* What a drag carries, by dataTransfer type, so drop targets can tell kinds apart while hovering. */

/** a snippet id: a built-in shape, "type:{json}", "stash:{json}" or "set:..." */
export const DRAG_SNIPPET_KEY = "jqzz-snippet";
/** a step being moved, by action id */
export const DRAG_ACTION_KEY = "jqzz-action";
/** a picture, by its library reference ("owner:handle", or "handle" once public) */
export const DRAG_IMAGE_KEY = "jqzz-image";
/** a whole question moved in the timeline: its step ids, as JSON */
export const DRAG_GROUP_KEY = "jqzz-group";

export const dragging = (e: { dataTransfer: DataTransfer }, key: string) => e.dataTransfer.types.includes(key);
