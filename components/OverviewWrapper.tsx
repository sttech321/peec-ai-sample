"use client";

import { useState } from "react";
import PageFilterBar, {
  PageFilterBrand,
  PageFilterDateRange,
  PageFilterTag,
} from "./PageFilterBar";
import OverviewClient from "./OverviewClient";
import { ChatFact } from "../lib/chat-aggregations";

interface ProjectBrand {
  name: string;
  isOwn: boolean;
  domains?: string[];
}

interface Props {
  projectName: string;
  chatFacts: ChatFact[];
  projectBrands: ProjectBrand[];
  filterBrands: PageFilterBrand[];
  availableTags: PageFilterTag[];
  addBrandAction: (name: string) => Promise<{ ok: boolean; error?: string }>;
  initialHiddenBrandIds: string[];
  updateBrandFilterAction: (hiddenBrandIds: string[] | null) => Promise<{ ok: boolean; error?: string }>;
  initialDomainTypeOverrides: Record<string, string>;
  updateDomainTypeOverrideAction: (domain: string, type: string | null) => Promise<{ ok: boolean; error?: string }>;
}

function makeDefaultDateRange(): PageFilterDateRange {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  return { start, end, preset: "7", label: "Last 7 days" };
}

const ALL_ENGINES = ["ChatGPT", "Claude", "Perplexity", "Gemini", "AI Overviews"];

export default function OverviewWrapper({
  projectName,
  chatFacts,
  projectBrands,
  filterBrands,
  availableTags,
  addBrandAction,
  initialHiddenBrandIds,
  updateBrandFilterAction,
  initialDomainTypeOverrides,
  updateDomainTypeOverrideAction,
}: Props) {
  const [dateRange, setDateRange] = useState<PageFilterDateRange>(makeDefaultDateRange);
  const [selectedModels, setSelectedModels] = useState<string[]>(ALL_ENGINES);

  // Initialize selectedBrandIds from DB hidden list:
  // null = all brands visible, array = only these IDs are visible
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[] | null>(() => {
    if (!initialHiddenBrandIds || initialHiddenBrandIds.length === 0) return null;
    // Select all brands EXCEPT the hidden ones
    const visibleIds = filterBrands
      .filter((b) => !initialHiddenBrandIds.includes(b.name))
      .map((b) => b.id);
    return visibleIds.length === filterBrands.length ? null : visibleIds;
  });

  // Called by PageFilterBar when user checks/unchecks brands
  async function handleBrandsChange(ids: string[] | null) {
    setSelectedBrandIds(ids);
    // Convert visible IDs → hidden brand names → save to DB
    const hiddenNames =
      ids === null
        ? []
        : filterBrands.filter((b) => !ids.includes(b.id)).map((b) => b.name);
    await updateBrandFilterAction(hiddenNames.length > 0 ? hiddenNames : null);
  }

  // Convert selected brand IDs → brand names for OverviewClient filtering
  const selectedBrandNames: string[] | null =
    selectedBrandIds === null
      ? null
      : selectedBrandIds
          .map((id) => filterBrands.find((b) => b.id === id)?.name)
          .filter((n): n is string => !!n);

  // Initial brand IDs to pass to PageFilterBar so UI stays in sync after refresh
  const initialBrandIds: string[] | null =
    !initialHiddenBrandIds || initialHiddenBrandIds.length === 0
      ? null
      : filterBrands
          .filter((b) => !initialHiddenBrandIds.includes(b.name))
          .map((b) => b.id);

  return (
    <>
      <PageFilterBar
        projectName={projectName}
        projectBrands={filterBrands}
        availableTags={availableTags}
        addBrandAction={addBrandAction}
        onDateChange={setDateRange}
        onModelsChange={setSelectedModels}
        onBrandsChange={handleBrandsChange}
        initialBrands={initialBrandIds}
      />
      <OverviewClient
        chatFacts={chatFacts}
        projectName={projectName}
        projectBrands={projectBrands}
        externalFilters={{
          dateRange,
          models: selectedModels,
          brandIds: selectedBrandNames,
        }}
        initialDomainTypeOverrides={initialDomainTypeOverrides}
        updateDomainTypeOverrideAction={updateDomainTypeOverrideAction}
      />
    </>
  );
}
