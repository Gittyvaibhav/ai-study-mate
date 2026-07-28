import { Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import DocUpload from "./pages/DocUpload";
import DocView from "./pages/DocView";
import DoubtSolver from "./pages/DoubtSolver";
import Login from "./pages/Login";
import Register from "./pages/Register";
import RevisionDashboard from "./pages/RevisionDashboard";

const App = () => {
  return (
    <div className="app-shell">
      <Navbar />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/docs/upload" element={<DocUpload />} />
          <Route path="/docs/:id" element={<DocView />} />
          <Route path="/doubt" element={<DoubtSolver />} />
          <Route path="/revision" element={<RevisionDashboard />} />
        </Route>
        <Route path="*" element={<Login />} />
      </Routes>
    </div>
  );
};

export default App;
