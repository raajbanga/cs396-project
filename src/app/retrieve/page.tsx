import { type Metadata } from "next";
import { LocalOnly } from "~/app/_components/local-only";
import { RetrieveView } from "~/app/_components/retrieve-view";
import { env } from "~/env";

export const metadata: Metadata = { title: "Retrieve" };

export default function RetrievePage() {
  return env.READ_ONLY ? (
    <LocalOnly title="Retrieve from the EPA" />
  ) : (
    <RetrieveView />
  );
}
