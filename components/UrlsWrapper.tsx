"use client";

import { useState } from "react";
import PageFilterBar, {
  PageFilterBrand,
  PageFilterTag,
  PageFilterTopic,
  PageFilterDateRange,
} from "./PageFilterBar";
import UrlsClient from "./UrlsClient";
import { ChatFact } from "../lib/chat-aggregations";
import { DateRangeValue } from "./DateRangeDropdown";

interface ProjectBrand {
  name: string;
  isOwn: boolean;
}

interface Props {
  projectName: string;
  chatFacts: ChatFact[];
  projectBrands: ProjectBrand[];
  filterBrands: PageFilterBrand[];
  availableTags: PageFilterTag[];
  availableTopics?: PageFilterTopic[];
  ownBrandName: string | null;
  ownDomains: string[];
  competitorDomains: string[];
  chatTopicMap?: Record<string, string>;
  chatTagsMap?: Record<string, string[]>;
  addBrandAction?: (name: string) => Promise<{ ok: boolean; error?: string }>;
  availableEngines?: string[];
}

function toDateRangeValue(r: PageFilterDateRange): DateRangeValue {
  return { start: r.start, end: r.end, preset: r.preset as DateRangeValue["preset"], label: r.label };
}

export default function UrlsWrapper({
  projectName, chatFacts, projectBrands, filterBrands,
  availableTags, availableTopics = [], ownBrandName, ownDomains,
  competitorDomains, chatTopicMap = {}, chatTagsMap = {},
  addBrandAction, availableEngines,
}: Props) {
  const [dateRange, setDateRange] = useState<DateRangeValue | null>(null);
  const [selectedModels, setSelectedModels] = useState<string[] | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[] | null>(null);
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[] | null>(null);

  const selectedTagNames: string[] | null =
    selectedTagIds === null
      ? null
      : selectedTagIds.map((id) => availableTags.find((t) => t.id === id)?.name).filter((n): n is string => !!n);

  const selectedTopicNames: string[] | null =
    selectedTopicIds === null
      ? null
      : selectedTopicIds.map((id) => availableTopics.find((t) => t.id === id)?.name).filter((n): n is string => !!n);

  return (
    <>
      <PageFilterBar
        projectName={projectName}
        projectBrands={filterBrands}
        availableTags={availableTags}
        availableTopics={availableTopics}
        addBrandAction={addBrandAction}
        onDateChange={(r) => setDateRange(toDateRangeValue(r))}
        onModelsChange={setSelectedModels}
        onTagsChange={setSelectedTagIds}
        onTopicsChange={setSelectedTopicIds}
        initialModels={availableEngines}
      />
      <UrlsClient
        chatFacts={chatFacts}
        projectName={projectName}
        projectBrands={projectBrands}
        ownBrandName={ownBrandName}
        ownDomains={ownDomains}
        competitorDomains={competitorDomains}
        externalDateRange={dateRange ?? undefined}
        externalModels={selectedModels ?? undefined}
        externalTagNames={selectedTagNames}
        externalTopicNames={selectedTopicNames}
        chatTopicMap={chatTopicMap}
        chatTagsMap={chatTagsMap}
      />
    </>
  );
}
