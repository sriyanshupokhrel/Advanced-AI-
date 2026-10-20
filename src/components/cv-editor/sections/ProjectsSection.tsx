"use client";

import { RepeatableSection } from "@/components/cv-editor/RepeatableSection";
import { ProjectImageGallery, type ImageCallbacks } from "@/components/images/ProjectImageGallery";
import { TextAreaField, TextField } from "@/components/ui/form-fields";
import { emptyProject, type WithClientKey } from "@/lib/cv/form-state";
import type { ProjectInput } from "@/types/cv";
import type { ListSectionProps } from "./types";

export function ProjectsSection({
  items,
  onChange,
  errorFor,
  sectionError,
  imageProps,
}: ListSectionProps<WithClientKey<ProjectInput>> & { imageProps: ImageCallbacks }) {
  return (
    <RepeatableSection
      title="Projects"
      description="University, personal or work projects that show your skills. Add screenshots or photos as visual evidence."
      items={items}
      onChange={onChange}
      createItem={emptyProject}
      itemLabel={(item, i) => item.name || `Project ${i + 1}`}
      addLabel="Add project"
      emptyMessage="No projects added yet."
      sectionError={sectionError}
      anchorId="projects"
      renderItem={(item, i, patch) => (
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            path={`projects.${i}.name`}
            label="Project name"
            required
            value={item.name}
            onChange={(name) => patch({ name })}
            error={errorFor(`${i}.name`)}
          />
          <TextField
            path={`projects.${i}.role`}
            label="Your role"
            value={item.role}
            onChange={(role) => patch({ role })}
            error={errorFor(`${i}.role`)}
            placeholder="e.g. Team lead"
          />
          <TextField
            path={`projects.${i}.technologies`}
            label="Technologies"
            value={item.technologies}
            onChange={(technologies) => patch({ technologies })}
            error={errorFor(`${i}.technologies`)}
            placeholder="e.g. React, PostgreSQL"
          />
          <TextField
            path={`projects.${i}.url`}
            label="Link"
            type="url"
            value={item.url}
            onChange={(url) => patch({ url })}
            error={errorFor(`${i}.url`)}
            placeholder="https://"
          />
          <TextAreaField
            path={`projects.${i}.description`}
            label="Description"
            required
            rows={3}
            className="sm:col-span-2"
            value={item.description}
            onChange={(description) => patch({ description })}
            error={errorFor(`${i}.description`)}
            hint="What the project does and what you contributed."
          />
          <div className="sm:col-span-2">
            <ProjectImageGallery projectId={item.id} {...imageProps} />
          </div>
        </div>
      )}
    />
  );
}
