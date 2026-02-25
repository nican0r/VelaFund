# React Patterns

## Async Effects — Never modify your own dependency array

Never include a state variable in a `useEffect` dependency array if the effect's async function sets that same variable. This creates a cleanup race condition: React re-runs the effect (triggering cleanup) before the async work completes, leaving state permanently stuck.

**Bad** — `isLoading` in deps triggers cleanup mid-flight:
```tsx
const [isLoading, setIsLoading] = useState(false);
useEffect(() => {
  if (isLoading) return;
  let cancelled = false;
  setIsLoading(true);
  async function run() {
    await fetchData();
    if (!cancelled) setIsLoading(false); // never reached
  }
  run();
  return () => { cancelled = true; };
}, [isLoading]); // re-runs → cleanup → cancelled = true
```

**Good** — ref guards without triggering re-run:
```tsx
const runningRef = useRef(false);
const [isLoading, setIsLoading] = useState(false);
useEffect(() => {
  if (runningRef.current) return;
  runningRef.current = true;
  setIsLoading(true);
  async function run() {
    await fetchData();
    runningRef.current = false;
    setIsLoading(false); // always reached
  }
  run();
}, [/* stable deps only */]);
```
