import NextLink from "next/link";
import DashboardLayout from "../../components/DashboardLayout";

export default function UnauthorizedPage() {
  return (
    <DashboardLayout currentPath="/unauthorized">
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", minHeight: "60vh", textAlign: "center",
        gap: 16, padding: "40px 24px",
      }}>
        <div style={{ fontSize: 48 }}>🔒</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", margin: 0 }}>
          Access Denied
        </h1>
        <p style={{ fontSize: 15, color: "#6b7280", maxWidth: 400, margin: 0, lineHeight: 1.6 }}>
          You don&apos;t have permission to access this page.
          Please contact your workspace admin if you think this is a mistake.
        </p>
        <NextLink
          href="/"
          style={{
            marginTop: 8, padding: "10px 24px",
            background: "#1a1a1a", color: "#fff",
            borderRadius: 8, fontSize: 14, fontWeight: 600,
            textDecoration: "none",
          }}
        >
          ← Go to Overview
        </NextLink>
      </div>
    </DashboardLayout>
  );
}
