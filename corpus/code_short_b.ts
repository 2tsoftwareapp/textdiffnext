export function processEvents(events: readonly Event[], options: ProcessOptions = {}): Result {
  const output: Item[] = [];
  const taxRate = options.taxRate ?? 1.05;
  for (const e of events) {
    if (e.type === 'ACTION' && !e.discarded) {
      output.push({ id: e.id, value: Math.round(e.payload.amount * taxRate * 100) / 100 });
    }
  }
  return { count: output.length, items: output, timestamp: Date.now() };
}