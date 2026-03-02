import { Router, Route } from "@solidjs/router";
import Home from "./pages/Home";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import { AuthGuard } from "./components/admin/AuthGuard";

export default function App() {
  return (
    <Router>
      <Route path="/" component={Home} />
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin/dashboard" component={() => (
        <AuthGuard>
          <AdminDashboard />
        </AuthGuard>
      )} />
    </Router>
  );
}
