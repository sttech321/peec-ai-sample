import BrandProfileClient from "../../../components/BrandProfileClient";
import { loadBrandProfile } from "../../actions/profile";
import "../../profile/profile.css";

export default async function ProfilePage() {
  const { profile } = await loadBrandProfile();

  return (
    <BrandProfileClient initialProfile={profile} />
  );
}
