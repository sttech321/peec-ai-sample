import DashboardLayout from "../../components/DashboardLayout";
import PlaceholderPage from "../../components/PlaceholderPage";

export default function Page() {
  return (
    <DashboardLayout currentPath="/crawl-insights">
      <PlaceholderPage 
        title="Crawl Insights" 
        description="Monitor how AI agents and search crawlers interact with your website. Identify crawl frequency and access patterns."
      />
    </DashboardLayout>
  );
}
