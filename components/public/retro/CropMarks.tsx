/** Print-sheet corner ticks under a chapter heading. The parent must be `relative`. */
export function CropMarks() {
  return (
    <>
      <span
        aria-hidden="true"
        className="absolute bottom-0 left-0 size-3 border-b border-l border-white/50"
      />
      <span
        aria-hidden="true"
        className="absolute right-0 bottom-0 size-3 border-r border-b border-white/50"
      />
    </>
  );
}
