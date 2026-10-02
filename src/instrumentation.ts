export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.ENABLE_INPROCESS_JOBS === "false") return;
  // Not awaited: loading the jobs (discovery, images…) takes seconds and the
  // server must answer at once. They first run 15 s after start anyway.
  setTimeout(() => {
    import("./server/jobs")
      .then(({ startInProcessJobs }) => startInProcessJobs())
      .catch((err) => console.error("[jobs] no se pudieron iniciar:", err));
  }, 3000).unref?.();
}
