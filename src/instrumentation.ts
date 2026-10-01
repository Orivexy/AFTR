export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.ENABLE_INPROCESS_JOBS === "false") return;
  // Background jobs must never stop the server from starting.
  try {
    const { startInProcessJobs } = await import("./server/jobs");
    startInProcessJobs();
  } catch (err) {
    console.error("[jobs] no se pudieron iniciar:", err);
  }
}
