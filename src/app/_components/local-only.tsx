import { buttonClass } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { PageTitle, PageView } from "~/components/ui/page";

export const REPO_URL = "https://github.com/raajbanga/cs396-project";

/** Stands in for a page that writes to the database when the hosted build is read-only. */
export function LocalOnly({ title }: { title: string }) {
  return (
    <PageView header={<PageTitle>{title}</PageTitle>}>
      <EmptyState
        className="border-edge rounded-lg border"
        title="This page only works when you run epaData locally"
        description="The hosted version is read-only: it can't save new records to the database. Download the project from GitHub and follow the README's Setup steps to use it."
        action={
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className={buttonClass({ size: "sm" })}
          >
            Download from GitHub
          </a>
        }
      />
    </PageView>
  );
}
