import { ASSISTANT_BUILT_IN } from "./flag";

/**
 * The assistant's place in a server-rendered shell (U5.5 §1). Without the build flag it renders
 * nothing and its client code is never referenced, so the storefront's budgets do not carry it.
 */
export async function AssistantEntry({ signedIn, signInHref }: { signedIn: boolean; signInHref: string }) {
  if (!ASSISTANT_BUILT_IN) return null;
  const { AssistantLauncher } = await import("./AssistantLauncher");
  return <AssistantLauncher signedIn={signedIn} signInHref={signInHref} />;
}
