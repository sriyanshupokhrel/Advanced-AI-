"use client";

import { TextAreaField, TextField } from "@/components/ui/form-fields";
import type { CvFormState } from "@/lib/cv/form-state";

type PersonalField = "fullName" | "headline" | "email" | "phone" | "location" | "website" | "summary";

interface PersonalDetailsSectionProps {
  values: Pick<CvFormState, PersonalField>;
  onFieldChange: (field: PersonalField, value: string) => void;
  errors: Partial<Record<PersonalField, string>>;
}

export function PersonalDetailsSection({ values, onFieldChange, errors }: PersonalDetailsSectionProps) {
  const field = (name: PersonalField) => ({
    path: name,
    value: values[name],
    onChange: (value: string) => onFieldChange(name, value),
    error: errors[name],
  });

  return (
    <section id="profile" className="scroll-mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <header className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">Personal details</h2>
        <p className="text-sm text-slate-500">Who you are and how employers can contact you.</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField {...field("fullName")} label="Full name" required autoComplete="name" />
        <TextField
          {...field("headline")}
          label="Headline"
          placeholder="e.g. Graduate Software Engineer"
        />
        <TextField {...field("email")} label="Email" type="email" autoComplete="email" />
        <TextField {...field("phone")} label="Phone" type="tel" autoComplete="tel" />
        <TextField {...field("location")} label="Location" placeholder="e.g. Sydney, NSW" />
        <TextField
          {...field("website")}
          label="Website or LinkedIn"
          type="url"
          placeholder="https://"
        />
        <TextAreaField
          {...field("summary")}
          label="Professional summary"
          required
          rows={5}
          className="sm:col-span-2"
          hint="2–4 sentences about your background, strengths and what you are looking for."
        />
      </div>
    </section>
  );
}
