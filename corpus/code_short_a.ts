export function processEvents(events: Event[]): Result {
  const output: Item[] = [];
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.type === 'ACTION') {
      output.push({ id: e.id, value: e.payload.amount * 1.05 });
    }
  }
  return { count: output.length, items: output };
}