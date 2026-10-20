"use client";

import { RepeatableSection } from "@/components/cv-editor/RepeatableSection";
import { TextField } from "@/components/ui/form-fields";
import { emptySkill, type WithClientKey } from "@/lib/cv/form-state";
import type { SkillInput } from "@/types/cv";
import type { ListSectionProps } from "./types";

export function SkillsSection({
  items,
  onChange,
  errorFor,
  sectionError,
}: ListSectionProps<WithClientKey<SkillInput>>) {
  return (
    <RepeatableSection
      title="Skills"
      description="Technical and professional skills. Skills with the same category are grouped in the preview."
      items={items}
      onChange={onChange}
      createItem={emptySkill}
      itemLabel={(item, i) => item.name || `Skill ${i + 1}`}
      addLabel="Add skill"
      emptyMessage="No skills added yet."
      sectionError={sectionError}
      anchorId="skills"
      renderItem={(item, i, patch) => (
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            path={`skills.${i}.name`}
            label="Skill"
            required
            value={item.name}
            onChange={(name) => patch({ name })}
            error={errorFor(`${i}.name`)}
            placeholder="e.g. TypeScript"
          />
          <TextField
            path={`skills.${i}.category`}
            label="Category"
            value={item.category}
            onChange={(category) => patch({ category })}
            error={errorFor(`${i}.category`)}
            placeholder="e.g. Programming languages"
          />
        </div>
      )}
    />
  );
}
