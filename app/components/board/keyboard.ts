import { KeyboardCode, type KeyboardCoordinateGetter } from "@dnd-kit/core";

/**
 * Tastatur-Drag: ←/→ springt zur Mitte der Nachbarspalte (statt pixelweise zu schieben).
 * So reichen ein Tastendruck und Leertaste/Enter, um eine Karte zu verschieben.
 */
export const columnKeyboardCoordinates: KeyboardCoordinateGetter = (
  event,
  { context, currentCoordinates },
) => {
  const direction = event.code === KeyboardCode.Right ? 1 : event.code === KeyboardCode.Left ? -1 : 0;
  if (!direction) return undefined;
  event.preventDefault();

  const { collisionRect: activeRect, droppableRects, droppableContainers } = context;
  // Im ersten Frame nach dem Aufnehmen ist noch nicht gemessen – dann nichts tun.
  if (!activeRect) return currentCoordinates;
  const centerX = activeRect.left + activeRect.width / 2;

  const columns = droppableContainers
    .getEnabled()
    .map((c) => droppableRects.get(c.id) ?? c.node.current?.getBoundingClientRect())
    .filter((rect): rect is NonNullable<typeof rect> => Boolean(rect))
    .map((rect) => ({ rect, center: rect.left + rect.width / 2 }))
    .sort((a, b) => a.center - b.center);

  const target =
    direction > 0
      ? columns.find((c) => c.center > centerX + 1)
      : [...columns].reverse().find((c) => c.center < centerX - 1);
  if (!target) return currentCoordinates;

  return {
    x: currentCoordinates.x + (target.center - centerX),
    y: currentCoordinates.y + (target.rect.top + 48 - activeRect.top),
  };
};
