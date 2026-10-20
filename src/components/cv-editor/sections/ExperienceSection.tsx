"use client";

import { RepeatableSection } from "@/components/cv-editor/RepeatableSection";
import { CheckboxField, TextAreaField, TextField } from "@/components/ui/form-fields";
import { emptyExperience, type WithClientKey } from "@/lib/cv/form-state";
import type { ExperienceInput } from "@/types/cv";
import type { ListSectionProps } from "./types";

export function ExperienceSection({
  items,
  onChange,
  errorFor,
  sectionError,
}: ListSectionProps<WithClientKey<ExperienceInput>>) {
  return (
    <RepeatableSection
      title="Work experience"
      description="Jobs, internships and volunteer roles, most recent first."
      items={items}
      onChange={onChange}
      createItem={emptyExperience}
      itemLabel={(item, i) =>
        [item.role, item.employer].filter(Boolean).join(" at ") || `Experience ${i + 1}`
      }
      addLabel="Add experience"
      emptyMessage="No work experience added yet."
      sectionError={sectionError}
      anchorId="experience"
      renderItem={(item, i, patch) => (
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            path={`experience.${i}.role`}
            label="Job title"
            required
            value={item.role}
            onChange={(role) => patch({ role })}
            error={errorFor(`${i}.role`)}
          />
          <TextField
            path={`experience.${i}.employer`}
            label="Employer"
            required
            value={item.employer}
            onChange={(employer) => patch({ employer })}
            error={errorFor(`${i}.employer`)}
          />
          <TextField
            path={`experience.${i}.location`}
            label="Location"
            className="sm:col-span-2"
            value={item.location}
            onChange={(location) => patch({ location })}
            error={errorFor(`${i}.location`)}
          />
          <TextField
            path={`experience.${i}.startDate`}
            label="Start"
            type="month"
            required
            value={item.startDate}
            onChange={(startDate) => patch({ startDate })}
            error={errorFor(`${i}.startDate`)}
          />
          <TextField
            path={`experience.${i}.endDate`}
            label="End"
            type="month"
            required={!item.isCurrent}
            disabled={item.isCurrent}
            value={item.endDate}
            onChange={(endDate) => patch({ endDate })}
            error={errorFor(`${i}.endDate`)}
          />
          <CheckboxField
            path={`experience.${i}.isCurrent`}
            label="I currently work here"
            className="sm:col-span-2"
            checked={item.isCurrent}
            onChange={(isCurrent) => patch(isCurrent ? { isCurrent, endDate: "" } : { isCurrent })}
          />
          <TextAreaField
            path={`experience.${i}.description`}
            label="Responsibilities and achievements"
            rows={4}
            className="sm:col-span-2"
            value={item.description}
            onChange={(description) => patch({ description })}
            error={errorFor(`${i}.description`)}
            hint="Tip: one point per line. Line breaks are kept in the preview."
          />
        </div>
      )}
    />
  );
}
