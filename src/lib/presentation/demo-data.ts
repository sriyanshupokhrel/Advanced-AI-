import {
  VERIFICATION_DISCLAIMER,
  type InterviewPreparationPayload,
  type PayloadImage,
  type SectionConfirmation,
} from "@/types/integration";
import type { InterviewPresentation } from "@/types/presentation";

const confirmed: SectionConfirmation = {
  status: "CONFIRMED",
  isConfirmed: true,
  confirmedAt: "2026-10-21T08:00:00.000Z",
  basis: "USER_REVIEW",
};

const demoImage = (imageId: string, url: string, altText: string, width: number, height: number): PayloadImage => ({
  imageId,
  kind: "PROJECT_SCREENSHOT",
  url,
  mimeType: "image/png",
  originalFileName: `${imageId}.png`,
  sizeBytes: 2048,
  width,
  height,
  sha256: imageId === "demo-image-orbit" ? "a".repeat(64) : "b".repeat(64),
  fileAvailable: true,
  description: { altText, caption: null, source: "USER_PROVIDED" },
  provenance: "USER_UPLOADED_UNVERIFIED",
  confirmation: confirmed,
  uploadedAt: "2026-10-21T07:00:00.000Z",
  updatedAt: "2026-10-21T08:00:00.000Z",
});

export const SYNTHETIC_PRESENTATION_CONTEXT: InterviewPreparationPayload = {
  contractVersion: "2.0",
  targetId: "demo-target-synthetic",
  generatedAt: "2026-10-21T08:05:00.000Z",
  verificationDisclaimer: VERIFICATION_DISCLAIMER,
  readiness: {
    status: "READY",
    isReady: true,
    readySince: "2026-10-21T08:00:00.000Z",
    sections: { confirmed: 7, total: 7 },
    images: { confirmed: 2, total: 2 },
    issues: [],
  },
  candidate: {
    cvProfileId: "demo-cv-nova-chen",
    createdAt: "2026-10-20T08:00:00.000Z",
    lastUpdatedAt: "2026-10-21T08:00:00.000Z",
    profile: {
      confirmation: confirmed,
      fullName: "Nova Chen",
      headline: "Synthetic graduate product engineer",
      contact: { email: "nova@example.invalid", phone: null, location: "Fictional Bay", website: null },
      professionalSummary: "Synthetic candidate used only to exercise the presentation editor.",
    },
    education: {
      confirmation: confirmed,
      items: [{
        id: "demo-education-design",
        institution: "Example Institute of Technology",
        qualification: "Bachelor of Computing",
        fieldOfStudy: "Human-centred systems",
        startDate: "2022-02",
        endDate: "2025-11",
        grade: null,
        description: "Studio-based coursework in accessible product design.",
      }],
    },
    workExperience: {
      confirmation: confirmed,
      items: [{
        id: "demo-experience-lumen",
        jobTitle: "Product Engineering Intern",
        employer: "Lumen Workshop (fictional)",
        location: "Fictional Bay",
        startDate: "2025-01",
        endDate: "2025-06",
        isCurrent: false,
        description: "Built and tested interface prototypes with a small multidisciplinary team.",
      }],
    },
    skills: {
      confirmation: confirmed,
      items: [
        { id: "demo-skill-typescript", name: "TypeScript", category: "Engineering" },
        { id: "demo-skill-research", name: "User research", category: "Product practice" },
        { id: "demo-skill-accessibility", name: "Accessibility testing", category: "Quality" },
      ],
    },
    projects: {
      confirmation: confirmed,
      items: [
        {
          id: "demo-project-orbit",
          name: "Orbit Planner",
          role: "Prototype developer",
          url: null,
          technologies: "Next.js, TypeScript",
          description: "A synthetic planning prototype that groups tasks into calm, readable daily views.",
          images: [demoImage("demo-image-orbit", "/dev-presentation-assets/screen-300x200.png", "Synthetic Orbit Planner interface sample", 300, 200)],
        },
        {
          id: "demo-project-signal",
          name: "Signal Map",
          role: "Research and interaction design",
          url: null,
          technologies: "React, service mapping",
          description: "A synthetic service-map prototype for comparing support pathways.",
          images: [demoImage("demo-image-signal", "/dev-presentation-assets/diagram-640x480.png", "Synthetic Signal Map diagram sample", 640, 480)],
        },
      ],
    },
    achievements: { confirmation: confirmed, items: [] },
    otherImages: [],
  },
  targetJob: {
    confirmation: confirmed,
    jobDescriptionId: "demo-job-product-engineer",
    jobTitle: "Graduate Product Engineer",
    company: { name: "Northstar Labs (fictional)", information: "Synthetic employer for UI testing." },
    jobReference: "DEMO-001",
    descriptionText: "Synthetic role seeking clear communication, TypeScript, research awareness and accessible product thinking.",
    createdAt: "2026-10-20T08:00:00.000Z",
    lastUpdatedAt: "2026-10-21T08:00:00.000Z",
  },
  fingerprints: {
    PROFILE: "1".repeat(64), EDUCATION: "2".repeat(64), EXPERIENCE: "3".repeat(64),
    SKILLS: "4".repeat(64), PROJECTS: "5".repeat(64), ACHIEVEMENTS: "6".repeat(64), TARGET_JOB: "7".repeat(64),
  },
};

export interface PresentationDemoScenario {
  id: string;
  label: string;
  description: string;
  presentation: InterviewPresentation;
}

export const PRESENTATION_DEMO_SCENARIOS: PresentationDemoScenario[] = [
  {
    id: "standard-four",
    label: "Standard · 4 slides",
    description: "Balanced synthetic content with one illustrated project slide.",
    presentation: {
      title: "Nova Chen · Graduate Product Engineer",
      slides: [
        { heading: "A thoughtful engineering introduction", bullets: ["Graduate candidate interested in useful, accessible digital products", "Combines TypeScript implementation with user research practice"], speakerNotes: "Introduce Nova as a synthetic candidate and explain the focus on clear product decisions.", sourceIds: ["demo-education-design", "demo-skill-typescript", "demo-skill-research"], imageIds: [] },
        { heading: "Learning through product delivery", bullets: ["Built and tested interface prototypes in a multidisciplinary internship", "Practised accessibility testing alongside iterative product work"], speakerNotes: "Keep the claim tied to the fictional internship and the confirmed skill record.", sourceIds: ["demo-experience-lumen", "demo-skill-accessibility"], imageIds: [] },
        { heading: "Project focus · Orbit Planner", bullets: ["A planning prototype organised around calm, readable daily views", "Built with Next.js and TypeScript"], speakerNotes: "Use the image as an illustration only. Do not imply independent verification or ownership proof.", sourceIds: ["demo-project-orbit", "demo-skill-typescript"], imageIds: ["demo-image-orbit"] },
        { heading: "Why this role", bullets: ["Relevant foundation in TypeScript and human-centred systems", "Ready to discuss trade-offs, feedback and responsible evidence use"], speakerNotes: "Close by connecting the cited background to the synthetic role without overstating fit.", sourceIds: ["demo-skill-typescript", "demo-education-design"], imageIds: [] },
      ],
    },
  },
  {
    id: "long-five",
    label: "Boundary · 5 slides",
    description: "Long headings, dense bullets and two images exercise fit warnings and scrolling.",
    presentation: {
      title: "Nova Chen · A deliberately long synthetic presentation title for responsive layout testing",
      slides: [
        { heading: "Introduction and the perspective I would bring to a collaborative graduate product engineering role", bullets: ["A synthetic computing graduate profile combining implementation, research awareness and accessibility testing", "Interested in explaining decisions clearly rather than presenting unsupported claims as established facts"], speakerNotes: "This intentionally long opening checks wrapping while remaining readable in the editor and preview.", sourceIds: ["demo-education-design", "demo-skill-research", "demo-skill-accessibility"], imageIds: [] },
        { heading: "Internship practice", bullets: ["Built interface prototypes with a fictional multidisciplinary workshop team", "Used feedback to revise interaction details", "Kept implementation and communication work closely connected"], speakerNotes: "Describe only the supplied internship record. The employer and candidate are synthetic.", sourceIds: ["demo-experience-lumen"], imageIds: [] },
        { heading: "Orbit Planner", bullets: ["Explored how a daily planning view could remain calm and readable when several tasks compete for attention", "Used Next.js and TypeScript for the synthetic prototype described in the confirmed sample context"], speakerNotes: "The screenshot illustrates the project record; it does not independently prove authorship.", sourceIds: ["demo-project-orbit", "demo-skill-typescript"], imageIds: ["demo-image-orbit"] },
        { heading: "Signal Map", bullets: ["Mapped fictional support pathways so differences could be compared without hiding uncertainty", "Combined interaction design with user research framing"], speakerNotes: "Use the diagram as an unverified user-provided illustration.", sourceIds: ["demo-project-signal", "demo-skill-research"], imageIds: ["demo-image-signal"] },
        { heading: "A careful close", bullets: ["Bring a practical TypeScript foundation", "Use research to clarify product decisions", "Include accessibility checks in normal delivery work", "Explain uncertainty instead of disguising it", "Treat every cited profile statement as user-confirmed information rather than independently verified evidence, especially when the wording has been edited after the original synthetic draft was prepared"], speakerNotes: "Summarise the evidence and remind the audience that this entire scenario is synthetic UI test data.", sourceIds: ["demo-skill-typescript", "demo-skill-research", "demo-skill-accessibility"], imageIds: [] },
      ],
    },
  },
];
