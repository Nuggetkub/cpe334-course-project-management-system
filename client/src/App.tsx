import { useEffect, useState } from "react";
import { getHealth } from "./api";

type ApiStatus = "checking" | "ok" | "unreachable";

// Scaffold landing page. Login and role-based navigation replace it in F-01 (FR-04).
export function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");

  useEffect(() => {
    getHealth()
      .then((body) => setApiStatus(body.status === "ok" ? "ok" : "unreachable"))
      .catch(() => setApiStatus("unreachable"));
  }, []);

  return (
    <main>
      <h1>Course Project Management System</h1>
      <p role="status">API: {apiStatus}</p>
    </main>
  );
}
