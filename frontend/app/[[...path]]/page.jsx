import Shell from "../../components/Shell";
import { notFound } from "next/navigation";

export default async function Page({ params }) {
  const parts = (await params).path || [];
  const [page = "home", id] = parts;
  if (
    parts.length > 2 ||
    ![
      "home",
      "signin",
      "signup",
      "create",
      "dashboard",
      "invite",
      "challenge",
      "practice",
    ].includes(page)
  )
    notFound();
  if (["invite", "challenge"].includes(page) !== Boolean(id)) notFound();
  return <Shell page={page} id={id} />;
}
