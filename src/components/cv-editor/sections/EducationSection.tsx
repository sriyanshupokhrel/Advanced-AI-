"use client";

import { RepeatableSection } from "@/components/cv-editor/RepeatableSection";
import { TextAreaField, TextField } from "@/components/ui/form-fields";
import { emptyEducation, type WithClientKey } from "@/lib/cv/form-state";
import type { EducationInput } from "@/types/cv";
import type { ListSectionProps } from "./types";

export function EducationSection({
  items,
  onChange,
  errorFor,
  sectionError,
}: ListSectionProps<WithClientKey<EducationInput>>) {
  return (
    <RepeatableSection
      title="Education"
      description="Degrees, diplomas and other qualifications."
      items={items}
      onChange={onChange}
      createItem={emptyEducation}
      itemLabel={(item, i) => item.institution || `Education ${i + 1}`}
      addLabel="Add education"
      emptyMessage="No education added yet."
      sectionError={sectionError}
      anchorId="education"
      renderItem={(item, i, patch) => (
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            path={`education.${i}.institution`}
            label="Institution"
            required
            value={item.institution}
            onChange={(institution) => patch({ institution })}
            error={errorFor(`${i}.institution`)}
          />
          <TextField
            path={`education.${i}.degree`}
            label="Degree or qualification"
            required
            value={item.degree}
            onChange={(degree) => patch({ degree })}
            error={errorFor(`${i}.degree`)}
            placeholder="e.g. Bachelor of Science"
          />
          <TextField
            path={`education.${i}.fieldOfStudy`}
            label="Field of study"
            value={item.fieldOfStudy}
            onChange={(fieldOfStudy) => patch({ fieldOfStudy })}
            error={errorFor(`${i}.fieldOfStudy`)}
          />
          <TextField
            path={`education.${i}.grade`}
            label="Grade / WAM / GPA"
            value={item.grade}
            onChange={(grade) => patch({ grade })}
            error={errorFor(`${i}.grade`)}
          />
          <TextField
            path={`education.${i}.startDate`}
            label="Start"
            type="month"
            value={item.startDate}
            onChange={(startDate) => patch({ startDate })}
            error={errorFor(`${i}.startDate`)}
          />
          <TextField
            path={`education.${i}.endDate`}
            label="End (or expected)"
            type="month"
            value={item.endDate}
            onChange={(endDate) => patch({ endDate })}
            error={errorFor(`${i}.endDate`)}
          />
          <TextAreaField
            path={`education.${i}.description`}
            label="Details"
            rows={3}
            className="sm:col-span-2"
            value={item.description}
            onChange={(description) => patch({ description })}
            error={errorFor(`${i}.description`)}
            hint="Optional: relevant subjects, thesis, honours."
          />
        </div>
      )}
    />
  );
}
