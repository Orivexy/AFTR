/** Runs async tasks with bounded concurrency (image/video generation is CPU-bound). */
export async function pool<T>(tasks: Array<() => Promise<T>>, concurrency = 4): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]!();
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return results;
}
