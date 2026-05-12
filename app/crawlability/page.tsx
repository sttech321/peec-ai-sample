import DashboardLayout from "../../components/DashboardLayout";
import PlaceholderPage from "../../components/PlaceholderPage";

export default function Page() {
  return (
    <DashboardLayout currentPath="/crawlability">
      <PlaceholderPage 
        title="Crawlability Score" 
        description="Detailed analysis of your site's structure for AI compatibility. Ensure your content is easily digestible by LLM agents."
      />
    </DashboardLayout>
  );
}
