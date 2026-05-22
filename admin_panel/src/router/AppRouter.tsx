import { Navigate, Route, Routes } from "react-router-dom";
import AdminLayout from "../layouts/AdminLayout";
import BookingsPage from "../pages/BookingsPage";
import DashboardPage from "../pages/DashboardPage";
import NotFoundPage from "../pages/NotFoundPage";
import ClientsPage from "../pages/ClientsPage";
import ContractsPage from "../pages/ContractsPage";
import PostsPage from "../pages/PostsPage";
import SchedulePage from "../pages/SchedulePage";

function AppRouter() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="schedule" element={<SchedulePage />} />
        <Route path="bookings" element={<BookingsPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="contracts" element={<ContractsPage />} />
        <Route path="posts" element={<PostsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default AppRouter;
