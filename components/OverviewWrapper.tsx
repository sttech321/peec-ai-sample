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
  availableEngines?: string[];
  initialBrandColors: Record<string, string>;
  updateBrandColorAction: (brandId: string, color: string) => Promise<{ ok: boolean; error?: string }>;
}

function makeDefaultDateRange(): PageFilterDateRange {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  return { start, end, preset: "7", label: "Last 7 days" };
}

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
  availableEngines,
  initialBrandColors,
  updateBrandColorAction,
}: Props) {
  const [dateRange, setDateRange]     = useState<PageFilterDateRange>(makeDefaultDateRange);
  // Initialize with availableEngines from DB; fallback to engines in chatFacts; finally []
  const [selectedModels, setSelectedModels] = useState<string[]>(() => {
    if (availableEngines?.length) return availableEngines;
    // Derive from chatFacts if availableEngines not provided
    const fromData = [...new Set(chatFacts.map((c) => c.engine))];
    return fromData.length ? fromData : [];
  });

  // Brand filter — initialize from DB
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[] | null>(() => {
    if (!initialHiddenBrandIds?.length) return null;
    const visibleIds = filterBrands
      .filter((b) => !initialHiddenBrandIds.includes(b.name))
      .map((b) => b.id);
    return visibleIds.length === filterBrands.length ? null : visibleIds;
  });

  // Brand color overrides — initialize from DB saved colors
  const [brandColorOverrides, setBrandColorOverrides] = useState<Record<string, string>>(initialBrandColors);

  async function handleBrandsChange(ids: string[] | null) {
    setSelectedBrandIds(ids);
    const hiddenNames = ids === null
      ? []
      : filterBrands.filter((b) => !ids.includes(b.id)).map((b) => b.name);
    await updateBrandFilterAction(hiddenNames.length > 0 ? hiddenNames : null);
  }

  async function handleBrandColorChange(brandName: string, color: string) {
    setBrandColorOverrides(prev => ({ ...prev, [brandName]: color }));
    // Look up brand ID from filterBrands list
    const brand = filterBrands.find(b => b.name === brandName);
    if (brand) await updateBrandColorAction(brand.id, color);
  }

  const selectedBrandNames: string[] | null =
    selectedBrandIds === null
      ? null
      : selectedBrandIds
          .map((id) => filterBrands.find((b) => b.id === id)?.name)
          .filter((n): n is string => !!n);

  const initialBrandIds: string[] | null =
    !initialHiddenBrandIds?.length
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
        initialModels={availableEngines}
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
        brandColorOverrides={brandColorOverrides}
        onBrandColorChange={handleBrandColorChange}
      />
    </>
  );
}
