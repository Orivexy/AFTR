export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.ENABLE_INPROCESS_JOBS === "false") return;
  const { startInProcessJobs } = await import("./server/jobs");
  startInProcessJobs();
}
