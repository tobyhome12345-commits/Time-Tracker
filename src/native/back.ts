/* Android hardware back button: a stack of handlers (sheets register themselves while open). */
type Handler = () => void;
const stack: Handler[] = [];

export function pushBack(h: Handler): () => void {
  stack.push(h);
  return () => {
    const i = stack.lastIndexOf(h);
    if (i >= 0) stack.splice(i, 1);
  };
}

/** Runs the top handler. Returns false if nothing handled it. */
export function runBack(): boolean {
  const h = stack[stack.length - 1];
  if (!h) return false;
  h();
  return true;
}
