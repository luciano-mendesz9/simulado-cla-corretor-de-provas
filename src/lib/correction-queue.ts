/** Runs independent files with a bounded number of active requests. */
export async function runPool<T, R>(items: T[], concurrency: number, work: (item: T, index: number) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error("Concorrência inválida.");
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      try { results[index] = { status: "fulfilled", value: await work(items[index], index) }; }
      catch (reason) { results[index] = { status: "rejected", reason }; }
    }
  }));
  return results;
}
