import { type Metadata } from "next";
import { RetrieveView } from "~/app/_components/retrieve-view";

export const metadata: Metadata = { title: "Retrieve" };

export default function RetrievePage() {
  return <RetrieveView />;
}
