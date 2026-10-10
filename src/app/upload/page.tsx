import { type Metadata } from "next";
import { UploadView } from "~/app/_components/upload-view";

export const metadata: Metadata = { title: "Upload" };

export default function UploadPage() {
  return <UploadView />;
}
