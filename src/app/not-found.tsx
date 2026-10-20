import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-16 text-center">
      <h1 className="text-xl font-bold text-slate-900">Not found</h1>
      <p className="mt-2 text-sm text-slate-600">
        The CV, job description or pairing you are looking for does not exist. It may have been deleted.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <ButtonLink href="/">My CVs</ButtonLink>
        <ButtonLink href="/jobs" variant="secondary">
          Job descriptions
        </ButtonLink>
        <ButtonLink href="/prepare" variant="secondary">
          Prepare interview
        </ButtonLink>
      </div>
    </div>
  );
}
