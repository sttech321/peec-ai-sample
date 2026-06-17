import DashboardLayout from "../../components/DashboardLayout";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
