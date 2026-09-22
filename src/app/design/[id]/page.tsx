import Editor from "@/components/editor/Editor";

export const metadata = { title: "ออกแบบกล่อง — BoxStudio" };

export default async function DesignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Editor id={id} />;
}
