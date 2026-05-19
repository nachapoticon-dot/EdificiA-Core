import { redirect } from "next/navigation";
import type { Route } from "next";

export default function ContextDocumentsPage() {
  redirect("/dashboard/contexto/fuentes" as Route);
}
