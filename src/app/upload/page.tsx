import { type Metadata } from "next";
import { LocalOnly } from "~/app/_components/local-only";
import { UploadView } from "~/app/_components/upload-view";
import { env } from "~/env";

export const metadata: Metadata = { title: "Upload" };

export default function UploadPage() {
  return env.READ_ONLY ? <LocalOnly title="Upload a file" /> : <UploadView />;
}
