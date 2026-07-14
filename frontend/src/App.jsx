import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ProblemList from "./pages/ProblemList";
import ProblemDetail from "./pages/ProblemDetail";
import Submissions from "./pages/Submissions";
import Profile from "./pages/Profile";
import AdminCreateProblem from "./pages/AdminCreateProblem";
import AdminManageProblems from "./pages/AdminManageProblems";
import AdminEditProblem from "./pages/AdminEditProblem";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<ProblemList />} />
        <Route path="/problems/:slug" element={<ProblemDetail />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route
          path="/submissions"
          element={
            <ProtectedRoute>
              <Submissions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/new-problem"
          element={
            <ProtectedRoute adminOnly>
              <AdminCreateProblem />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/problems"
          element={
            <ProtectedRoute adminOnly>
              <AdminManageProblems />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/problems/:slug/edit"
          element={
            <ProtectedRoute adminOnly>
              <AdminEditProblem />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
