import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<{ tab?: string }>;
};

export default async function AuthPage({ searchParams }: PageProps) {
  const params = await searchParams;
  if (params.tab === "signup") {
    redirect("/signup");
  }
  redirect("/signin");
}
