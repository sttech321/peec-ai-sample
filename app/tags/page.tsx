import DashboardLayout from "../../components/DashboardLayout";
import PlaceholderPage from "../../components/PlaceholderPage";

export default function Page() {
  return (
    <DashboardLayout currentPath="/tags">
      <PlaceholderPage 
        title="Tags & Taxonomy" 
        description="Organize your prompts and insights using custom tags. Create a semantic hierarchy for better project management."
      />
    </DashboardLayout>
  );
}
