"use client";

import { useState } from "react";
import PageFilterBar, {
  PageFilterBrand,
  PageFilterTag,
} from "./PageFilterBar";
import { DateRangeValue, makePresetRange as makeDR } from "./DateRangeDropdown";
import DomainsClient from "./DomainsClient";
import { ChatFact } from "../lib/chat-aggregations";

interface ProjectBrand {
  name: string;
  isOwn: boolean;
  domains?: string[] | null;
}

interface Props {
  projectName: string;
  chatFacts: ChatFact[];
  projectBrands: ProjectBrand[];
  filterBrands: PageFilterBrand[];
  availableTags: PageFilterTag[];
  ownDomains: string[];
  competitorDomains: string[];
  addBrandAction: (name: string) => Promise<{ ok: boolean; error?: string }>;
  availableEngines?: string[];
  initialDomainTypeOverrides?: Record<string, string>;
  updateDomainTypeOverrideAction?: (domain: string, type: string | null) => Promise<{ ok: boolean; error?: string }>;
  initialDomainBookmarks?: string[];
  updateDomainBookmarkAction?: (domain: string, bookmarked: boolean) => Promise<{ ok: boolean; error?: string }>;
}


export default function DomainsWrapper({
  projectName, chatFacts, projectBrands, filterBrands,
  availableTags, ownDomains, competitorDomains,
  addBrandAction, availableEngines,
  initialDomainTypeOverrides, updateDomainTypeOverrideAction,
  initialDomainBookmarks, updateDomainBookmarkAction,
}: Props) {
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => makeDR("30"));
  const [selectedModels, setSelectedModels] = useState<string[]>(
    availableEngines?.length ? availableEngines : []
  );

  return (
    <>
      <PageFilterBar
        projectName={projectName}
        projectBrands={filterBrands}
        availableTags={availableTags}
        addBrandAction={addBrandAction}
        onDateChange={setDateRange}
        onModelsChange={setSelectedModels}
        initialModels={availableEngines}
      />
      <DomainsClient
        chatFacts={chatFacts}
        projectName={projectName}
        projectBrands={projectBrands}
        ownDomains={ownDomains}
        competitorDomains={competitorDomains}
        externalDateRange={dateRange}
        externalModels={selectedModels}
        initialDomainTypeOverrides={initialDomainTypeOverrides}
        updateDomainTypeOverrideAction={updateDomainTypeOverrideAction}
        initialDomainBookmarks={initialDomainBookmarks}
        updateDomainBookmarkAction={updateDomainBookmarkAction}
      />
    </>
  );
}
