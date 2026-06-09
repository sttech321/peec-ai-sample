import DashboardLayout from "../../components/DashboardLayout";
import BrandProfileClient from "../../components/BrandProfileClient";
import { loadBrandProfile } from "../actions/profile";
import "./profile.css";

export default async function ProfilePage() {
  const { profile } = await loadBrandProfile();

  return (
    <DashboardLayout currentPath="/profile">
      <BrandProfileClient initialProfile={profile} />
    </DashboardLayout>
  );
}
