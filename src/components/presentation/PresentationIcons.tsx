import type { SVGProps } from "react";

/** Decorative inline icons for the presentation editor. Always paired with visible text. */
function Icon({ children, className = "h-4 w-4", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`} {...props}>
      {children}
    </svg>
  );
}

export const InfoIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props}><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 7.5h.01" /></Icon>;

export const AlertIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5" /><path d="M12 16h.01" /></Icon>;

export const WarningIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props}><path d="M12 4 2.8 19.5h18.4Z" /><path d="M12 10v4" /><path d="M12 17h.01" /></Icon>;

export const CheckIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props}><path d="m5 12.5 4.5 4.5L19 7.5" /></Icon>;

export const PencilIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props}><path d="M4 20h4L19 9l-4-4L4 16Z" /><path d="m13.5 6.5 4 4" /></Icon>;

export const ImageIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props}><rect x="3.5" y="5" width="17" height="14" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="m20.5 16-5-5-8 8" /></Icon>;

export const ChevronIcon = (props: SVGProps<SVGSVGElement>) => <Icon {...props}><path d="m9 6 6 6-6 6" /></Icon>;
