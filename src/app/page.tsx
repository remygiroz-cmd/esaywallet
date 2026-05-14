import { redirect } from "next/navigation";

// The middleware redirects unauthenticated visitors to /login, so reaching
// this point means the user has a valid session.
export default function RootPage() {
  redirect("/dashboard");
}
