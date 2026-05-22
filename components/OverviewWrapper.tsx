"use client";

import React, { useState } from "react";
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
}: Props) {
  const [dateRange, setDateRange] = useState<PageFilterDateRange>(makeDefaultDateRange);
  const [selectedModels, setSelectedModels] = useState<string[]>(ALL_ENGINES);
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[] | null>(null);

  return (
    <>
      <PageFilterBar
        projectName={projectName}
        projectBrands={filterBrands}
        availableTags={availableTags}
        addBrandAction={addBrandAction}
        onDateChange={setDateRange}
        onModelsChange={setSelectedModels}
        onBrandsChange={setSelectedBrandIds}
      />
      <OverviewClient
        chatFacts={chatFacts}
        projectName={projectName}
        projectBrands={projectBrands}
        externalFilters={{
          dateRange,
          models: selectedModels,
          brandIds: selectedBrandIds,
        }}
      />
    </>
  );
}
