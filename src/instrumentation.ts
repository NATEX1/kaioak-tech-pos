export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getServerEnv } = await import("@/lib/env");
    try {
      getServerEnv();
    } catch (error) {
      console.error("Critical: Invalid server environment variables:", error);
      if (process.env.NODE_ENV === "production") {
        throw error;
      }
    }
  }
}
