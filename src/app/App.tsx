import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { AppStartup } from "./AppStartup";

export default function App() {
  return (
    <AppErrorBoundary>
      <AppStartup />
    </AppErrorBoundary>
  );
}
