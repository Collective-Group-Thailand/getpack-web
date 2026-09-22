import Editor from "@/features/designer/components/Editor";

export const metadata = { title: "ออกแบบกล่อง" };

export default async function DesignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Editor id={id} />;
}
