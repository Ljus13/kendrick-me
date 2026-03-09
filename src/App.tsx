import { Router, Route } from "@solidjs/router";
import Home from "./pages/Home";
import Lobby from "./pages/Lobby";
import Game from "./pages/Game";
import Stats from "./pages/Stats";
import MarryMeMary from "./pages/MarryMeMary";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import { AuthGuard } from "./components/admin/AuthGuard";

export default function App() {
  return (
    <Router>
      <Route path="/" component={Home} />
      <Route path="/lobby/:code" component={Lobby} />
      <Route path="/game/:code" component={Game} />
      <Route path="/stats" component={Stats} />
      <Route path="/marry" component={MarryMeMary} />
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin/dashboard" component={() => (
        <AuthGuard>
          <AdminDashboard />
        </AuthGuard>
      )} />
    </Router>
  );
}
