/** Props shared by every list-section editor (education, experience, ...). */
export interface ListSectionProps<T> {
  items: T[];
  onChange: (items: T[], changedPaths: string[] | null) => void;
  /** Error for a path relative to the section, e.g. "0.role". */
  errorFor: (path: string) => string | undefined;
  /** Error about the list as a whole, e.g. "too many items". */
  sectionError?: string;
}
