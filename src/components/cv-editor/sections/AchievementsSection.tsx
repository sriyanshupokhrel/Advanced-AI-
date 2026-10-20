"use client";

import { RepeatableSection } from "@/components/cv-editor/RepeatableSection";
import { TextAreaField, TextField } from "@/components/ui/form-fields";
import { emptyAchievement, type WithClientKey } from "@/lib/cv/form-state";
import type { AchievementInput } from "@/types/cv";
import type { ListSectionProps } from "./types";

export function AchievementsSection({
  items,
  onChange,
  errorFor,
  sectionError,
}: ListSectionProps<WithClientKey<AchievementInput>>) {
  return (
    <RepeatableSection
      title="Achievements"
      description="Awards, certifications, scholarships and other recognition."
      items={items}
      onChange={onChange}
      createItem={emptyAchievement}
      itemLabel={(item, i) => item.title || `Achievement ${i + 1}`}
      addLabel="Add achievement"
      emptyMessage="No achievements added yet."
      sectionError={sectionError}
      anchorId="achievements"
      renderItem={(item, i, patch) => (
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            path={`achievements.${i}.title`}
            label="Title"
            required
            value={item.title}
            onChange={(title) => patch({ title })}
            error={errorFor(`${i}.title`)}
            placeholder="e.g. Dean's List"
          />
          <TextField
            path={`achievements.${i}.issuer`}
            label="Awarded by"
            value={item.issuer}
            onChange={(issuer) => patch({ issuer })}
            error={errorFor(`${i}.issuer`)}
          />
          <TextField
            path={`achievements.${i}.date`}
            label="Date"
            type="month"
            value={item.date}
            onChange={(date) => patch({ date })}
            error={errorFor(`${i}.date`)}
          />
          <TextAreaField
            path={`achievements.${i}.description`}
            label="Details"
            rows={2}
            className="sm:col-span-2"
            value={item.description}
            onChange={(description) => patch({ description })}
            error={errorFor(`${i}.description`)}
          />
        </div>
      )}
    />
  );
}
